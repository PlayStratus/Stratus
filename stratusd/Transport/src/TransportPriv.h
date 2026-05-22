#pragma once

#include <cstddef>

#include "QuicheCore.h"
#include "StratusWebTransportSessionVisitor.h"
#include "rbuf2.h"

static bool transport_logging_initialized = false;

/*
 * Represent how much of a frame has already been transported so we don't
 * retransmit anything by mistake
 */
enum frame_progress {
    FRAME_PROGRESS_NONE = 0,
    FRAME_PROGRESS_STREAM_TYPE,
    FRAME_PROGRESS_MESSAGE_TYPE,
    FRAME_PROGRESS_LENGTH,
    FRAME_PROGRESS_DATA,
};

struct transport_session
{
    const bool *is_session_active; // used to shutdown in response to SideCar
    bool is_thread_active;         // used to shutdown in response to client
    bool *client_connected;
    bool debug;
    int port;
    quic::QuicSocketAddress* QuicAddr;
    quic::QuicServer* QuicServer;
    quic::QuicSimpleServerBackend* WebTransportBackend;
    quic::StratusWebTransportSessionVisitor* WebTransportSession;
    struct rbuf *video_queue;
    struct rbuf *audio_queue;
    struct rbuf *input_queue;
};

// Something Something Global vars bad. Will refactor after MVP maybe.
struct transport_session* StaticTransportSession = NULL;
