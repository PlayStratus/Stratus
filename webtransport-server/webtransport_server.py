import argparse
import asyncio
import io
import logging
from collections import defaultdict
from typing import Dict, Optional

import av

from aioquic.asyncio import QuicConnectionProtocol, serve
from aioquic.h3.connection import H3_ALPN, H3Connection
from aioquic.h3.events import H3Event, HeadersReceived, WebTransportStreamDataReceived, DatagramReceived
from aioquic.quic.configuration import QuicConfiguration
from aioquic.quic.connection import stream_is_unidirectional
from aioquic.quic.events import ProtocolNegotiated, StreamReset, QuicEvent

BIND_ADDRESS = '::1'
BIND_PORT = 4433

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logger.propagate = False
handler = logging.StreamHandler()
formatter = logging.Formatter('[%(asctime)s] %(name)s [%(levelname)s] %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.info("Logger initialized: %s", logger)


class VideoHandler:

    def __init__(self, session_id, http: H3Connection, protocol: QuicConnectionProtocol) -> None:
        self._session_id = session_id
        self._http = http
        self._protocol = protocol
        self._counters = defaultdict(int)
        self._datagram_stream_id: Optional[int] = None
        
        # self._loop = asyncio.create_task(self._loop())

    def _encode_png_to_vp9_frame(self) -> bytes:
        """
        Encode `photo.png` as a single VP9 frame (raw bitstream).
        Uses container-based encoding and extracts VP9 payload.
        Profile: vp09.00.10.08 (VP9 Profile 0, Level 1.0, 8-bit)
        """
        # Decode PNG into a frame
        in_container = av.open("photo.png")
        in_stream = in_container.streams.video[0]
        frame = next(in_container.decode(in_stream))
        width, height = frame.width, frame.height
        in_container.close()

        # Encode to WebM container with VP9 codec
        buffer = io.BytesIO()
        out_container = av.open(buffer, mode="w", format="webm")
        try:
            out_stream = out_container.add_stream("libvpx-vp9", rate=1)  # Try libvpx-vp9 first
        except Exception:
            try:
                out_stream = out_container.add_stream("vp9", rate=1)  # Fallback to vp9
            except Exception as e:
                out_container.close()
                logger.error(f"VP9 encoder not available. Install FFmpeg with libvpx-vp9 support: {e}")
                raise
        
        out_stream.width = width
        out_stream.height = height
        out_stream.pix_fmt = "yuv420p"
        # Configure VP9 Profile 0 (vp09.00.10.08: Profile 0, Level 1.0, 8-bit)
        out_stream.options = {"profile": "0"}

        # Encode the frame
        for packet in out_stream.encode(frame):
            out_container.mux(packet)
        # Flush encoder
        for packet in out_stream.encode():
            out_container.mux(packet)
        out_container.close()

        # Extract VP9 frame from WebM: decode the WebM we just created
        buffer.seek(0)
        webm_container = av.open(buffer, mode="r")
        webm_stream = webm_container.streams.video[0]
        
        # Get the VP9 packet data
        vp9_data = b""
        for packet in webm_container.demux(webm_stream):
            if packet:
                # In current PyAV versions, bytes(packet) returns the encoded payload.
                vp9_data += bytes(packet)
        webm_container.close()
        
        return vp9_data

    def h3_event_received(self, event: H3Event) -> None:
        if isinstance(event, DatagramReceived):
            logger.info(f"Datagram received: {event.data}")

        if isinstance(event, WebTransportStreamDataReceived):
            logger.info(f"Stream data received on stream {event.stream_id}: {event.data}")
            self._counters[event.stream_id] += len(event.data)
            if event.stream_ended:
                if stream_is_unidirectional(event.stream_id):
                    response_id = self._http.create_webtransport_stream(
                        self._session_id, is_unidirectional=True
                    )
                else:
                    response_id = event.stream_id
                payload = str(self._counters[event.stream_id]).encode("ascii")
                self._http._quic.send_stream_data(
                    response_id, payload, end_stream=True
                )
                self.stream_closed(event.stream_id)
                
    async def _loop(self):
        while True:
            frame_bytes = self._encode_png_to_vp9_frame()
            frame_len = len(frame_bytes)

            # 4-byte big-endian length prefix, as expected by the client.
            length_prefix = bytes(
                [
                    (frame_len >> 24) & 0xFF,
                    (frame_len >> 16) & 0xFF,
                    (frame_len >> 8) & 0xFF,
                    frame_len & 0xFF,
                ]
            )
            payload = length_prefix + frame_bytes

            if self._datagram_stream_id is None:
                self._datagram_stream_id = self._http.create_webtransport_stream(
                    self._session_id, is_unidirectional=True
                )

            # Send the single length-prefixed VP9 keyframe.
            self._http._quic.send_stream_data(
                self._datagram_stream_id, payload, end_stream=False
            )
            
            self._protocol.transmit()
            
            await asyncio.sleep(1/30)  # 30 FPS

    def stream_closed(self, stream_id: int) -> None:
        if self._datagram_stream_id == stream_id:
            self._datagram_stream_id = None
        try:
            del self._counters[stream_id]
        except KeyError:
            pass


# WebTransportProtocol handles the beginning of a WebTransport connection: it
# responses to an extended CONNECT method request, and routes the transport
# events to a relevant handler (in this example, CounterHandler).
class WebTransportProtocol(QuicConnectionProtocol):

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._http: Optional[H3Connection] = None
        self._handler: Optional[VideoHandler] = None

    def quic_event_received(self, event: QuicEvent) -> None:
        if isinstance(event, ProtocolNegotiated):
            self._http = H3Connection(self._quic, enable_webtransport=True)
        elif isinstance(event, StreamReset) and self._handler is not None:
            # Streams in QUIC can be closed in two ways: normal (FIN) and
            # abnormal (resets).  FIN is handled by the handler; the code
            # below handles the resets.
            self._handler.stream_closed(event.stream_id)

        if self._http is not None:
            for h3_event in self._http.handle_event(event):
                self._h3_event_received(h3_event)

    def _h3_event_received(self, event: H3Event) -> None:
        if isinstance(event, HeadersReceived):
            headers = {}
            for header, value in event.headers:
                headers[header] = value
            if (headers.get(b":method") == b"CONNECT" and
                    headers.get(b":protocol") == b"webtransport"):
                self._handshake_webtransport(event.stream_id, headers)
            else:
                self._send_response(event.stream_id, 400, end_stream=True)

        if self._handler:
            self._handler.h3_event_received(event)

    def _handshake_webtransport(self,
                                stream_id: int,
                                request_headers: Dict[bytes, bytes]) -> None:
        authority = request_headers.get(b":authority")
        path = request_headers.get(b":path")
        if authority is None or path is None:
            # `:authority` and `:path` must be provided.
            self._send_response(stream_id, 400, end_stream=True)
            return
        if path == b"/":
            assert(self._handler is None)
            self._handler = VideoHandler(stream_id, self._http, protocol=self)
            self._send_response(stream_id, 200)
        else:
            self._send_response(stream_id, 404, end_stream=True)

    def _send_response(self,
                       stream_id: int,
                       status_code: int,
                       end_stream=False) -> None:
        headers = [(b":status", str(status_code).encode())]
        if status_code == 200:
            headers.append((b"sec-webtransport-http3-draft", b"draft02"))
        self._http.send_headers(
            stream_id=stream_id, headers=headers, end_stream=end_stream)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('certificate')
    parser.add_argument('key')
    args = parser.parse_args()

    configuration = QuicConfiguration(
        alpn_protocols=H3_ALPN,
        is_client=False,
        max_datagram_frame_size=65536,
    )
    configuration.load_cert_chain(args.certificate, args.key)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(
        serve(
            BIND_ADDRESS,
            BIND_PORT,
            configuration=configuration,
            create_protocol=WebTransportProtocol,
        ))
    try:
        logging.info(
            "Listening on https://{}:{}".format(BIND_ADDRESS, BIND_PORT))
        loop.run_forever()
    except KeyboardInterrupt:
        pass
    