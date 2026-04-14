#include "StratusWebTransportSessionVisitor.h"
#include "quiche/web_transport/web_transport.h"
#include "TransportPriv.h"
#include <memory>

namespace quic {

StratusWebTransportSessionVisitor::StratusWebTransportSessionVisitor(WebTransportSession* session)
{
    session_ = session;
    ControlStream = nullptr;
    InputStream = nullptr;
    VideoStream = nullptr;

    if (StaticTransportSession->WebTransportSession) {
      std::cerr << "[Transport] Warning: A client attempted to establish a connection but was rejected." << std::endl;

      DropSession = true;
      return;
    }

    StaticTransportSession->WebTransportSession = this;

    std::cerr << "[Transport] Info: Session Established" << std::endl;
}

void StratusWebTransportSessionVisitor::OnSessionReady()
{
    if (DropSession)
    {
        session_->CloseSession(webtransport::SessionErrorCode(1), "[Transport] Error: A client has already established a connection to this node.");
    }

    if (session_->CanOpenNextOutgoingUnidirectionalStream()) {
      OnCanCreateNewOutgoingUnidirectionalStream();
    }
}

void StratusWebTransportSessionVisitor::OnSessionClosed(WebTransportSessionError error_code, const std::string& error_message)
{
    std::cerr << "[Transport] Session closed with Error Code " << error_code << " " << error_message << std::endl;
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
    std::cerr << "[Transport] OnIncomingBidirectionalStreamAvailable()" << std::endl;

    if (!InputStream){
        InputStream = session_->AcceptIncomingUnidirectionalStream();
        InputStream->SetVisitor(std::make_unique<StratusWebTransportInboundStreamVisitor>(InputStream, StaticSessionArgs->InputMessageQueue));
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

    VideoStream->SetVisitor(std::make_unique<StratusWebTransportOutboundStreamVisitor>(VideoStream, StaticSessionArgs->VideoMessageQueue));

    webtransport::SessionStats SessionStats = session_->GetSessionStats();

    std::cerr << "Current Session Stats are Bytes Recieved: " << SessionStats.application_bytes_acknowledged << " Round Trip Latency " << SessionStats.smoothed_rtt << std::endl;
}

void StratusWebTransportSessionVisitor::FlushMessageQueue()
{


    if (VideoStream)
    {
        StratusWebTransportOutboundStreamVisitor* StreamVisitor = (StratusWebTransportOutboundStreamVisitor*)VideoStream->visitor();
        if (StreamVisitor)
        {

            StreamVisitor->FlushMessageQueue();
        }
    }
}

}