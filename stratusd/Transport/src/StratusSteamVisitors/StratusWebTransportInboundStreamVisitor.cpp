#include "StratusWebTransportInboundStreamVisitor.h"
#include <cstddef>
#include <iostream>
#include <netinet/in.h>

extern "C" {
#include "Common.h"
}


quic::StratusWebTransportInboundStreamVisitor::StratusWebTransportInboundStreamVisitor(WebTransportStream* Stream, struct TransportMessageQueue* InputMessageQueue)
{
    this->Stream = Stream;
    this->InputMessageQueue = InputMessageQueue;
}

void quic::StratusWebTransportInboundStreamVisitor::OnCanWrite()
{
    std::cout << "[Transport]" << "OnCanRead" << std::endl;
}

void quic::StratusWebTransportInboundStreamVisitor::OnCanRead()
{
    std::string Message;
    webtransport::Stream::ReadResult MessageReadResult = Stream->Read(&Message);

    SendTransportMessage(InputMessageQueue, Input_GamepadStateUpdate, (void*)Message.c_str(), Message.length());
}

void quic::StratusWebTransportInboundStreamVisitor::OnResetStreamReceived(webtransport::StreamErrorCode error)
{
    std::cout << "[Transport]" << "OnResetStreamReceived" << std::endl;
}

void quic::StratusWebTransportInboundStreamVisitor::OnStopSendingReceived(webtransport::StreamErrorCode error)
{
    std::cout << "[Transport]" << "OnStopSendingReceived" << std::endl;
}

void quic::StratusWebTransportInboundStreamVisitor::OnWriteSideInDataRecvdState()
{
    std::cout << "[Transport]" << "OnWriteSideInDataRecvdState" << std::endl;
}