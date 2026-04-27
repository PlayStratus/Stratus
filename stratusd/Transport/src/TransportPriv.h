#pragma once

#include <cstddef>

#include "QuicheCore.h"
#include "StratusWebTransportSessionVisitor.h"
#include "rbuf2.h"

struct transport_session
{
    const bool *is_session_active; // used to shutdown in response to SideCar
    bool is_thread_active;         // used to shutdown in response to client
    bool *client_connected;
    int port;
    quic::QuicSocketAddress* QuicAddr;
    quic::QuicServer* QuicServer;
    quic::QuicSimpleServerBackend* WebTransportBackend;
    quic::StratusWebTransportSessionVisitor* WebTransportSession;
    struct rbuf *video_queue;
    struct rbuf *input_queue;
};

// Something Something Global vars bad. Will refactor after MVP maybe.
struct transport_session* StaticTransportSession = NULL;
