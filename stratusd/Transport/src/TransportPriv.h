#pragma once
#include <cstddef>
#include <stdbool.h>
#include "SideCar.h"

struct transport_session
{
    int port;
    void* QuicAddr;
    void* QuicServer;
    void* WebTransportBackend;
    void* WebTransportSession;
};

// Something Something Global vars bad. Will refactor after MVP maybe.
struct transport_session* StaticTransportSession = NULL;

struct session_args* StaticSessionArgs = NULL;
