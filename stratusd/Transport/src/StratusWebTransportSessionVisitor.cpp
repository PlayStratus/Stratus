#include "StratusWebTransportSessionVisitor.h"
#include "InputStreamVisitor.h"
#include "TransportPriv.h"

/*
 * The offsets of each component of a video stream packet
 */
enum video_packet {
    VIDEO_PKT_STREAM_TYPE    = 0,
    VIDEO_PKT_FRAME_TYPE     = VIDEO_PKT_STREAM_TYPE + sizeof(uint8_t),
    VIDEO_PKT_LENGTH         = VIDEO_PKT_FRAME_TYPE  + sizeof(uint8_t),
    VIDEO_PKT_DATA           = VIDEO_PKT_LENGTH      + sizeof(int),
};

/*
 * The offsets of each component of a video stream packet
 */
enum audio_packet {
    AUDIO_PKT_STREAM_TYPE    = 0,
    AUDIO_PKT_LENGTH         = AUDIO_PKT_STREAM_TYPE + sizeof(uint8_t),
    AUDIO_PKT_DATA           = AUDIO_PKT_LENGTH      + sizeof(int),
};

namespace quic {

StratusWebTransportSessionVisitor::StratusWebTransportSessionVisitor(WebTransportSession* session,
        rbuf *input_queue)
{
    session_ = session;
    ControlStream = nullptr;
    InputStream = nullptr;
    VideoStream = nullptr;
    AudioStream = nullptr;
    this->input_queue = input_queue;

    assert(StaticTransportSession->WebTransportSession == NULL);
    StaticTransportSession->WebTransportSession = this;
    *StaticTransportSession->client_connected = true;
    std::cerr << "[Transport] Client connected" << std::endl;
}

void StratusWebTransportSessionVisitor::OnSessionReady()
{
    if (session_->CanOpenNextOutgoingUnidirectionalStream()) {
      OnCanCreateNewOutgoingUnidirectionalStream();
    }
}

void StratusWebTransportSessionVisitor::OnSessionClosed(WebTransportSessionError error_code, const std::string& error_message)
{
    std::cerr << "[Transport] Session closed with exit code " << error_code << " " << error_message << std::endl;
    StaticTransportSession->is_thread_active = false;
}


void StratusWebTransportSessionVisitor::OnIncomingBidirectionalStreamAvailable()
{
    if (!ControlStream){
        ControlStream = session_->AcceptIncomingBidirectionalStream();
    }
    else
    {
        std::cerr << "[Transport] ControlStream is Already Open!" << std::endl;
    }

}

void StratusWebTransportSessionVisitor::OnIncomingUnidirectionalStreamAvailable()
{
    if (!InputStream){
        InputStream = session_->AcceptIncomingUnidirectionalStream();
        InputStream->SetVisitor(std::make_unique<InputStreamVisitor>(InputStream, input_queue));

    }
    else
    {
        std::cerr << "[Transport] InputStream is Already Open!" << std::endl;
    }
}

void StratusWebTransportSessionVisitor::OnDatagramReceived(absl::string_view datagram)
{
}

void StratusWebTransportSessionVisitor::OnCanCreateNewOutgoingBidirectionalStream()
{
}

void StratusWebTransportSessionVisitor::OnCanCreateNewOutgoingUnidirectionalStream()
{
    VideoStream = session_->OpenOutgoingUnidirectionalStream();
    AudioStream = session_->OpenOutgoingUnidirectionalStream();

    webtransport::SessionStats SessionStats = session_->GetSessionStats();

    std::cerr << "[Transport] Current round trip latency: " << SessionStats.smoothed_rtt << std::endl;
}

absl::Status StratusWebTransportSessionVisitor::SubmitVideoDataToStream(struct video_transport_queue_frame *frame)
{
    absl::Status ret;
    webtransport::StreamWriteOptions CurrentWriteOptions;

    if (!VideoStream || !VideoStream->CanWrite()) {
        return absl::UnavailableError("Can't write to video stream");
    }

    // Construct video packet
    ssize_t buffer_len = VIDEO_PKT_DATA + frame->length;
    quiche::QuicheBuffer buffer(quiche::SimpleBufferAllocator::Get(), buffer_len);
    buffer.data()[VIDEO_PKT_STREAM_TYPE] = Stream_Video;
    buffer.data()[VIDEO_PKT_FRAME_TYPE] = frame->is_description ?
        Codec_Description : Codec_Payload;
    *((int*)(buffer.data() + VIDEO_PKT_LENGTH)) = htonl(frame->length);
    memcpy(buffer.data() + VIDEO_PKT_DATA, frame->data, frame->length);

    // Send packet
    quiche::QuicheMemSlice* Data = new quiche::QuicheMemSlice(std::move(buffer));
    ret = VideoStream->Writev(absl::MakeSpan(Data, 1), CurrentWriteOptions);
    delete Data;

    return ret;
}

absl::Status StratusWebTransportSessionVisitor::SubmitAudioDataToStream(struct audio_transport_queue_frame *frame)
{
    absl::Status ret;
    webtransport::StreamWriteOptions CurrentWriteOptions;

    if (!AudioStream || !AudioStream->CanWrite()) {
        return absl::UnavailableError("Can't write to audio stream");
    }

    // Construct audio packet
    ssize_t buffer_len = AUDIO_PKT_DATA + frame->length;
    quiche::QuicheBuffer buffer(quiche::SimpleBufferAllocator::Get(), buffer_len);
    buffer.data()[AUDIO_PKT_STREAM_TYPE] = Stream_Audio;
    *((int*)(buffer.data() + AUDIO_PKT_LENGTH)) = htonl(frame->length);
    memcpy(buffer.data() + AUDIO_PKT_DATA, frame->data, frame->length);

    // Send packet
    quiche::QuicheMemSlice* Data = new quiche::QuicheMemSlice(std::move(buffer));
    ret = AudioStream->Writev(absl::MakeSpan(Data, 1), CurrentWriteOptions);
    delete Data;

    return ret;
}

}
