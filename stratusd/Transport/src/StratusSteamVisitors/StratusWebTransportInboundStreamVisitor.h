#include "quiche/quic/core/web_transport_interface.h"
extern "C" {
#include "Common.h"
}
namespace quic
{
class StratusWebTransportInboundStreamVisitor : public webtransport::StreamVisitor {
 public:
    StratusWebTransportInboundStreamVisitor(WebTransportStream* Stream, struct TransportMessageQueue* InputMessageQueue);

    void OnCanRead() override;
    void OnCanWrite() override;
    void OnResetStreamReceived(webtransport::StreamErrorCode error) override;
    void OnStopSendingReceived(webtransport::StreamErrorCode error) override;
    void OnWriteSideInDataRecvdState() override;

private:
WebTransportStream* Stream;
struct TransportMessageQueue* InputMessageQueue;
};
}