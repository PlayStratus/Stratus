#include "StratusWebTransportOutboundStreamVisitor.h"
#include <cstddef>
#include <iostream>
#include <netinet/in.h>

extern "C" {
#include "Common.h"
}


quic::StratusWebTransportOutboundStreamVisitor::StratusWebTransportOutboundStreamVisitor(WebTransportStream* Stream, struct TransportMessageQueue* VideoMessageQueue)
{
    this->Stream = Stream;
    this->VideoMessageQueue = VideoMessageQueue;
}

void quic::StratusWebTransportOutboundStreamVisitor::OnCanRead()
{
    std::cout << "[Transport]" << "OnCanRead" << std::endl;
}

void quic::StratusWebTransportOutboundStreamVisitor::OnCanWrite()
{
    std::cout << "[Transport]" << "OnCanWrite" << std::endl;
}

void quic::StratusWebTransportOutboundStreamVisitor::OnResetStreamReceived(webtransport::StreamErrorCode error)
{
    std::cout << "[Transport]" << "OnResetStreamReceived" << std::endl;
}

void quic::StratusWebTransportOutboundStreamVisitor::OnStopSendingReceived(webtransport::StreamErrorCode error)
{
    std::cout << "[Transport]" << "OnStopSendingReceived" << std::endl;
}

void quic::StratusWebTransportOutboundStreamVisitor::OnWriteSideInDataRecvdState()
{
    std::cout << "[Transport]" << "OnWriteSideInDataRecvdState" << std::endl;
}

void quic::StratusWebTransportOutboundStreamVisitor::FlushMessageQueue()
{

    if (Stream && Stream->CanWrite())
    {
        struct TransportMessage* Message = RecieveTransportMessage(VideoMessageQueue);

        if (!Message)
        {
            return;
        }

        webtransport::StreamWriteOptions CurrentWriteOptions;

        uint8_t NetMessageType = Message->Type;
        quiche::QuicheMemSlice* MessageTypeData = new quiche::QuicheMemSlice((char*)&NetMessageType, 1, nullptr);
        absl::Status ret = Stream->Writev(absl::MakeSpan(MessageTypeData, 1), CurrentWriteOptions);
        delete MessageTypeData;
        if (!ret.ok()) return;

        int NetLength = htonl(Message->Length);
        quiche::QuicheMemSlice* SizeData = new quiche::QuicheMemSlice((char*)&NetLength, 4, nullptr);
        ret = Stream->Writev(absl::MakeSpan(SizeData, 1), CurrentWriteOptions);
        delete SizeData;
        if (!ret.ok()) return;

        quiche::QuicheMemSlice* Data = new quiche::QuicheMemSlice((char*)Message->Data, Message->Length, NULL);
        ret = Stream->Writev(absl::MakeSpan(Data, 1), CurrentWriteOptions);
        delete Data;
        if (!ret.ok()) return;
    }
}