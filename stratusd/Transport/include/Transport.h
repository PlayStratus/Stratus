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

struct transport_session* transport_init(int port);
void transport_thread(struct transport_session* session);
void transport_destroy(struct transport_session* session, pthread_t* transport_thread);
void transport_submit(enum TransportStreamType Stream, enum VideoMessageType MessageType, void* Buffer, __int64_t Length);

#ifdef __cplusplus
}
#endif