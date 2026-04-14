#include "quiche/quic/core/web_transport_interface.h"
extern "C" {
#include "Common.h"
}
namespace quic
{
class StratusWebTransportOutboundStreamVisitor : public webtransport::StreamVisitor {
 public:
    StratusWebTransportOutboundStreamVisitor(WebTransportStream* Stream, struct TransportMessageQueue* VideoMessageQueue);

    void OnCanRead() override;
    void OnCanWrite() override;
    void OnResetStreamReceived(webtransport::StreamErrorCode error) override;
    void OnStopSendingReceived(webtransport::StreamErrorCode error) override;
    void OnWriteSideInDataRecvdState() override;
    void FlushMessageQueue();

private:
WebTransportStream* Stream;
struct TransportMessageQueue* VideoMessageQueue;
};
}