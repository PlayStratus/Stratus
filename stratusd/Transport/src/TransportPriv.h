#pragma once
#include <cstddef>

struct transport_session
{
    int port;
    void* QuicAddr;
    void* QuicServer;
    void* WebTransportBackend;
    void* WebTransportSessionArray[10];
    int   WebTransportSessionCount;
};

// Something Something Global vars bad. Will refactor after MVP maybe.
struct transport_session* StaticTransportSession = NULL;
