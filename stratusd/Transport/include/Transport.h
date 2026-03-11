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
};

enum VideoMessageType
{
    Codec_Decsription,
    Codec_Payload
};

struct transport_session* transport_init(int port);
void transport_thread(struct transport_session* session);
void transport_destroy(struct transport_session* session);

#ifdef __cplusplus
}
#endif