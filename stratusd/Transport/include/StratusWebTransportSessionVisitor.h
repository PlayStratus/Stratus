#include "quiche/quic/core/web_transport_interface.h"
#include "quiche/web_transport/web_transport.h"
#include <iostream>
#include "TransportPriv.h"
#include <arpa/inet.h>

void Test(absl::string_view test)
{
  //std::cerr << "[Transport] TEST" << std::endl;
}


namespace quic {

class StratusWebTransportSessionVisitor : public WebTransportVisitor {
 public:
  StratusWebTransportSessionVisitor(WebTransportSession* session)
  {
    session_ = session;
    ControlStream = nullptr;
    InputStream = nullptr;
    VideoStream = nullptr;

    assert(StaticTransportSession->WebTransportSessionCount < 10);
    StaticTransportSession->WebTransportSessionArray[StaticTransportSession->WebTransportSessionCount] = this;
    StaticTransportSession->WebTransportSessionCount++;
  }

  void OnSessionReady() override {
    if (session_->CanOpenNextOutgoingUnidirectionalStream()) {
      OnCanCreateNewOutgoingUnidirectionalStream();
    }
  }

  void OnSessionClosed(WebTransportSessionError error_code, const std::string& error_message) override {
    std::cerr << "[Transport] Session closed with Error Code " << error_code << " " << error_message << std::endl;
  }

  void OnIncomingBidirectionalStreamAvailable() override {
    std::cerr << "[Transport] OnIncomingBidirectionalStreamAvailable()" << std::endl;

    if (!ControlStream){
        ControlStream = session_->AcceptIncomingBidirectionalStream();
    }
    else
    {
        std::cerr << "[Transport] ControlStream is Already Open!" << std::endl;
    }

  }

  void OnIncomingUnidirectionalStreamAvailable() override {
    std::cerr << "[Transport] OnIncomingBidirectionalStreamAvailable()" << std::endl;

    if (!InputStream){
        InputStream = session_->AcceptIncomingUnidirectionalStream();
    }
    else
    {
        std::cerr << "[Transport] InputStream is Already Open!" << std::endl;
    }
  }

  void OnDatagramReceived(absl::string_view datagram) override {
    std::cerr << "[Transport] OnDatagramReceived()" << std::endl;
  }

  void OnCanCreateNewOutgoingBidirectionalStream() override {
    std::cerr << "[Transport] OnCanCreateNewOutgoingBidirectionalStream()" << std::endl;
  }

  void OnCanCreateNewOutgoingUnidirectionalStream() override {
    std::cerr << "[Transport] OnCanCreateNewOutgoingUnidirectionalStream()" << std::endl;

    VideoStream = session_->OpenOutgoingUnidirectionalStream();

    webtransport::SessionStats SessionStats = session_->GetSessionStats();

    std::cerr << "Current Session Stats are Bytes Recieved: " << SessionStats.application_bytes_acknowledged << " Round Trip Latency " << SessionStats.smoothed_rtt << std::endl;
  }

  void SubmitDataToStream(enum TransportStreamType Stream, enum VideoMessageType MessageType, void* Buffer, int Length) {
    if (VideoStream && VideoStream->CanWrite())
    {
      // Huuge Mem leak will fix.
      uint8_t NetMessageType = MessageType;
      int NetLength = htonl(Length);

      quiche::QuicheMemSlice* Data = new quiche::QuicheMemSlice((char*)Buffer, Length, Test);
      quiche::QuicheMemSlice* SizeData = new quiche::QuicheMemSlice((char*)&NetLength, 4, Test);
      quiche::QuicheMemSlice* MessageTypeData = new quiche::QuicheMemSlice((char*)&NetMessageType, 1, Test);

      quiche::StreamWriteOptions CurrentWriteOptions;
      VideoStream->Writev(absl::MakeSpan(MessageTypeData, 1), CurrentWriteOptions);
      VideoStream->Writev(absl::MakeSpan(SizeData, 1), CurrentWriteOptions);
      VideoStream->Writev(absl::MakeSpan(Data, 1), CurrentWriteOptions);
    }
  }

 private:
  WebTransportSession* session_;
  WebTransportStream* ControlStream;
  WebTransportStream* InputStream;
  WebTransportStream* VideoStream;
};

}
