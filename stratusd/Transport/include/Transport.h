#pragma once

// Despite QuicheLib and the Transport module's use of C++. This header MUST stay in C.
// This file header abuses the "Opaque Pointer Pattern" to hide C++ impl details (Quiche Classes)
#ifdef __cplusplus
extern "C" {
#endif

struct transport_session
{
    int port;
    void* QuicAddr;
    void* QuicServer;
    void* WebTransportBackend;
    short ShutdownInitiated;
    void* WebTransportSessionArray[10];
    int   WebTransportSessionCount;
};

enum TransportStreamType
{
    Stream_Control,
    Stream_Video,
    Stream_Audio,
    Stream_Input
};

enum VideoMessageType
{
    Codec_Decsription,
    Codec_Payload
};

#include <SideCar.h>

int transport_main(struct session_args *args);

#ifdef __cplusplus
}
#endif
