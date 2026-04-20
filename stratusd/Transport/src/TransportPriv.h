#pragma once

#include <cstddef>

#include "QuicheCore.h"
#include "StratusWebTransportSessionVisitor.h"
#include "rbuf2.h"

struct transport_session
{
    int port;
    quic::QuicSocketAddress* QuicAddr;
    quic::QuicServer* QuicServer;
    quic::QuicSimpleServerBackend* WebTransportBackend;
    quic::StratusWebTransportSessionVisitor* WebTransportSession;
    struct rbuf *video_queue;
};

// Something Something Global vars bad. Will refactor after MVP maybe.
struct transport_session* StaticTransportSession = NULL;
