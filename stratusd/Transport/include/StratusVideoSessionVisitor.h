#include "quiche/quic/core/web_transport_interface.h"
#include "quiche/web_transport/web_transport.h"

namespace quic {

class StratusVideoSessionVisitor : public WebTransportStreamVisitor {
    public:
    void OnCanWrite() override;
};

}