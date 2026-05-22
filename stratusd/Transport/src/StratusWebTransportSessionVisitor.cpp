#include "StratusWebTransportSessionVisitor.h"
#include "InputStreamVisitor.h"
#include "TransportPriv.h"

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
    if (!VideoStream && !VideoStream->CanWrite()) {
        return absl::UnavailableError("Can't write to video stream");
    }

    absl::Status ret;
    webtransport::StreamWriteOptions CurrentWriteOptions;

    if (frame->transport_progress < FRAME_PROGRESS_STREAM_TYPE) {
        uint8_t NetStreamType = Stream_Video;
        quiche::QuicheMemSlice* StreamTypeData = new quiche::QuicheMemSlice((char*)&NetStreamType, 1, nullptr);
        ret = VideoStream->Writev(absl::MakeSpan(StreamTypeData, 1), CurrentWriteOptions);
        delete StreamTypeData;
        if (!ret.ok())
            return ret;
        else
            frame->transport_progress = FRAME_PROGRESS_STREAM_TYPE;
    }

    if (frame->transport_progress < FRAME_PROGRESS_MESSAGE_TYPE) {
        uint8_t NetMessageType = frame->is_description ? Codec_Description : Codec_Payload;
        quiche::QuicheMemSlice* MessageTypeData = new quiche::QuicheMemSlice((char*)&NetMessageType, 1, nullptr);
        ret = VideoStream->Writev(absl::MakeSpan(MessageTypeData, 1), CurrentWriteOptions);
        delete MessageTypeData;
        if (!ret.ok()) {
            std::cerr << "[Transport] Failed to send video frame type\n";
            return ret;
        } else
            frame->transport_progress = FRAME_PROGRESS_MESSAGE_TYPE;
    }

    if (frame->transport_progress < FRAME_PROGRESS_LENGTH) {
        int NetLength = htonl(frame->length);
        quiche::QuicheMemSlice* SizeData = new quiche::QuicheMemSlice((char*)&NetLength, 4, nullptr);
        ret = VideoStream->Writev(absl::MakeSpan(SizeData, 1), CurrentWriteOptions);
        delete SizeData;
        if (!ret.ok()) {
            std::cerr << "[Transport] Failed to send video frame length\n";
            return ret;
        } else
            frame->transport_progress = FRAME_PROGRESS_LENGTH;
    }

    if (frame->transport_progress < FRAME_PROGRESS_DATA) {
        quiche::QuicheMemSlice* Data = new quiche::QuicheMemSlice((char*)frame->data, frame->length, FreeBuffer);
        ret = VideoStream->Writev(absl::MakeSpan(Data, 1), CurrentWriteOptions);
        delete Data;
        if (!ret.ok()) {
            // TODO: If we fail to send data, we will likely get a memory error on the
            // next call.
            std::cerr << "[Transport] Failed to send video frame data!\n";
            return ret;
        } else
            frame->transport_progress = FRAME_PROGRESS_DATA;
    }

    return absl::OkStatus();
}

absl::Status StratusWebTransportSessionVisitor::SubmitAudioDataToStream(struct audio_transport_queue_frame *frame)
{
    if (!AudioStream || !AudioStream->CanWrite()) {
        return absl::UnavailableError("Can't write to audio stream");
    }

    absl::Status ret;
    webtransport::StreamWriteOptions CurrentWriteOptions;

    if (frame->transport_progress < FRAME_PROGRESS_STREAM_TYPE) {
        uint8_t NetStreamType = Stream_Audio;
        quiche::QuicheMemSlice *StreamTypeData = new quiche::QuicheMemSlice((char *)&NetStreamType, 1, nullptr);
        ret = AudioStream->Writev(absl::MakeSpan(StreamTypeData, 1), CurrentWriteOptions);
        delete StreamTypeData;
        if (!ret.ok())
            return ret;
        else
            frame->transport_progress = FRAME_PROGRESS_STREAM_TYPE;
    }

    if (frame->transport_progress < FRAME_PROGRESS_LENGTH) {
        int NetLength = htonl(frame->length);
        quiche::QuicheMemSlice *SizeData = new quiche::QuicheMemSlice((char *)&NetLength, 4, nullptr);
        ret = AudioStream->Writev(absl::MakeSpan(SizeData, 1), CurrentWriteOptions);
        delete SizeData;
        if (!ret.ok())
            return ret;
        else
            frame->transport_progress = FRAME_PROGRESS_LENGTH;
    }

    if (frame->transport_progress < FRAME_PROGRESS_DATA) {
        quiche::QuicheMemSlice *Data = new quiche::QuicheMemSlice((char *)frame->data, frame->length, FreeBuffer);
        ret = AudioStream->Writev(absl::MakeSpan(Data, 1), CurrentWriteOptions);
        delete Data;
        if (!ret.ok())
            return ret;
        else
            frame->transport_progress = FRAME_PROGRESS_DATA;
    }

    return absl::OkStatus();
}

void StratusWebTransportSessionVisitor::FreeBuffer(absl::string_view test)
{
    free((void*)test.data());
}

}
