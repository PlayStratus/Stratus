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
    std::cerr << "[Transport] Session closed with Error Code " << error_code << " " << error_message << std::endl;
    StaticTransportSession->is_thread_active = false;
}


void StratusWebTransportSessionVisitor::OnIncomingBidirectionalStreamAvailable()
{
    std::cerr << "[Transport] OnIncomingBidirectionalStreamAvailable()" << std::endl;

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
    std::cerr << "[Transport] OnIncomingUnidirectionalStreamAvailable()" << std::endl;

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
    std::cerr << "[Transport] OnDatagramReceived()" << std::endl;
}

void StratusWebTransportSessionVisitor::OnCanCreateNewOutgoingBidirectionalStream()
{
    std::cerr << "[Transport] OnCanCreateNewOutgoingBidirectionalStream()" << std::endl;
}

void StratusWebTransportSessionVisitor::OnCanCreateNewOutgoingUnidirectionalStream()
{
    std::cerr << "[Transport] OnCanCreateNewOutgoingUnidirectionalStream()" << std::endl;

    VideoStream = session_->OpenOutgoingUnidirectionalStream();

    webtransport::SessionStats SessionStats = session_->GetSessionStats();

    std::cerr << "Current Session Stats are Bytes Recieved: " << SessionStats.application_bytes_acknowledged << " Round Trip Latency " << SessionStats.smoothed_rtt << std::endl;
}

absl::Status StratusWebTransportSessionVisitor::SubmitDataToStream(enum TransportStreamType StreamType, enum VideoMessageType MessageType, void* Buffer, int Length)
{
    if (VideoStream && VideoStream->CanWrite()) {
        // Huuge Mem leak will fix.

        webtransport::StreamWriteOptions CurrentWriteOptions;

        uint8_t NetStreamType = StreamType;
        quiche::QuicheMemSlice* StreamTypeData = new quiche::QuicheMemSlice((char*)&NetStreamType, 1, nullptr);
        absl::Status ret = VideoStream->Writev(absl::MakeSpan(StreamTypeData, 1), CurrentWriteOptions);
        delete StreamTypeData;
        if (!ret.ok()) return ret;

        uint8_t NetMessageType = MessageType;
        quiche::QuicheMemSlice* MessageTypeData = new quiche::QuicheMemSlice((char*)&NetMessageType, 1, nullptr);
        ret = VideoStream->Writev(absl::MakeSpan(MessageTypeData, 1), CurrentWriteOptions);
        delete MessageTypeData;
        if (!ret.ok()) return ret;

        int NetLength = htonl(Length);
        quiche::QuicheMemSlice* SizeData = new quiche::QuicheMemSlice((char*)&NetLength, 4, nullptr);
        ret = VideoStream->Writev(absl::MakeSpan(SizeData, 1), CurrentWriteOptions);
        delete SizeData;
        if (!ret.ok()) return ret;

        quiche::QuicheMemSlice* Data = new quiche::QuicheMemSlice((char*)Buffer, Length, FreeBuffer);
        ret = VideoStream->Writev(absl::MakeSpan(Data, 1), CurrentWriteOptions);
        delete Data;
        if (!ret.ok()) return ret;
    } else {
        std::cerr << "[Transport] Can't write to video stream!\n";
    }

    return absl::OkStatus();
}

void StratusWebTransportSessionVisitor::FreeBuffer(absl::string_view test)
{
  free((void*)test.data());
}

}
