import argparse
import asyncio
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

from avcC_utils import annexb_au_to_avcc, make_avcc_description

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

        self._loop_task = asyncio.create_task(self._loop())

    def h3_event_received(self, event: H3Event) -> None:
        if isinstance(event, DatagramReceived):
            logger.info("Datagram received: %s", event.data)

            self._http._quic.send_datagram_frame("Datagram response".encode("ascii"))

        if isinstance(event, WebTransportStreamDataReceived):
            if stream_is_unidirectional(event.stream_id):
                if event.data:
                    logger.info("Uni [%s] received: %s", event.stream_id, event.data)

                if event.stream_ended:
                    self.stream_closed(event.stream_id)
            else:
                # Bidirectional control streams can stay open (e.g. resize updates),
                # so process chunks as they arrive instead of waiting for FIN.
                if event.data:
                    logger.info("Bidirectional [%s] received: %s", event.stream_id, event.data)
                    self._http._quic.send_stream_data(
                        event.stream_id, b"Bidirectional response", end_stream=False
                    )
                if event.stream_ended:
                    self.stream_closed(event.stream_id)

    def _get_frames_bytes(self) -> list[bytes]:
        frames = []

        container = av.open("encode_output.h264", format="h264")
        stream = next((s for s in container.streams if s.type == "video"), None)

        for packet in container.demux(stream):
            if packet is None:
                continue

            encoded_bytes = bytes(packet)
            frames.append(encoded_bytes)
        return frames

    async def _loop(self):
        frames = self._get_frames_bytes()
        total = len(frames)
        logger.info("Total packets to stream: %s", total)

        # Create uni stream once
        if self._datagram_stream_id is None:
            self._datagram_stream_id = self._http.create_webtransport_stream(
                self._session_id, is_unidirectional=True
            )

        # 1) Find SPS/PPS and build description
        description = None
        start_index = 0
        for i, pkt in enumerate(frames):
            avcc, is_idr, sps, pps = annexb_au_to_avcc(pkt)
            # Often SPS/PPS appear near the beginning (or right before IDR).
            if sps and pps:
                description = make_avcc_description(sps, pps)
            if description and is_idr:
                start_index = i
                break

        if not description:
            logger.error("Could not find SPS/PPS in the stream. Can't build avcC description.")
            return

        # 2) Send CONFIG message once
        def send_msg(msg_type: int, payload: bytes):
            header = bytes([msg_type]) + len(payload).to_bytes(4, "big")
            self._http._quic.send_stream_data(self._datagram_stream_id, header + payload, end_stream=False)

        send_msg(0x00, description)   # config
        self._protocol.transmit()
        logger.info("Sent avcC description (%d bytes).", len(description))

        # 3) Stream frames, starting at an IDR
        idx = start_index
        while True:
            pkt = frames[idx]

            if not pkt:
                idx += 1
                if idx >= total:
                    idx = start_index
                continue

            avcc, is_idr, _, _ = annexb_au_to_avcc(pkt)

            # Send FRAME message: type(1) + isKey(1) + len(4) + data
            payload = bytes([1 if is_idr else 0]) + avcc
            send_msg(0x01, payload)
            self._protocol.transmit()

            idx += 1
            if idx >= total:
                # IMPORTANT: looping safely means restarting at an IDR and
                # ideally resending config + telling client to flush/reconfigure.
                # Simplest: restart at the same start_index (known IDR).
                idx = start_index
                send_msg(0x00, description)   # resend config at loop boundary
                self._protocol.transmit()

            await asyncio.sleep(1 / 15)

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
        logging.info("Listening on https://%s:%s", BIND_ADDRESS, BIND_PORT)
        loop.run_forever()
    except KeyboardInterrupt:
        pass
