#pragma once

#include "quiche/quic/core/web_transport_interface.h"

extern "C" {
#include "rbuf2.h"
}

class InputStreamVisitor : public webtransport::StreamVisitor {
    public:
        InputStreamVisitor(quic::WebTransportStream *stream,
                           struct rbuf *queue);

        void OnCanRead() override;

        // Not used:
        void OnCanWrite() override;
        void OnResetStreamReceived(webtransport::StreamErrorCode error) override;
        void OnStopSendingReceived(webtransport::StreamErrorCode error) override;
        void OnWriteSideInDataRecvdState() override;

    private:
        quic::WebTransportStream *stream;
        struct rbuf *queue;
};
