#include "QuicheCore.h"
#include "Transport.h"
#include "Certs.h"
#include "StratusWebTransportSessionVisitor.cpp"
#include <assert.h>
#include <iostream>
#include "TransportPriv.h"
#include "video-transport-queue.h"
#include "input-queue.h"


namespace quic {

absl::StatusOr<std::unique_ptr<webtransport::SessionVisitor>> ProcessRequest(
    absl::string_view path, WebTransportSession* wt_session) {

    if (StaticTransportSession->WebTransportSession == NULL) {
        return std::make_unique<StratusWebTransportSessionVisitor>
            (wt_session, StaticTransportSession->input_queue);
    } else {
        std::cerr << "[Transport] Warning: A client attempted to establish a "
            << "connection but was rejected." << std::endl;
        return absl::AlreadyExistsError("Client already connected");
    }
}

}

transport_session* transport_init(int port, struct StratusCertificate *cert)
{
    // Session init
    transport_session* session = new transport_session();
    StaticTransportSession = session;

    session->port = port;

    session->WebTransportSession = NULL;

    // Storing as void PTRs for C Backwards Compat.
    session->WebTransportBackend = new quic::WebTransportOnlyBackend(quic::ProcessRequest);
    session->QuicServer = new quic::QuicServer(std::move(cert->proof_source), nullptr, session->WebTransportBackend);
    session->QuicAddr = new quic::QuicSocketAddress(quic::QuicIpAddress::Any6(), port);

    return session;
}

void transport_thread(struct transport_session* session)
{
    quic::QuicServer* server = session->QuicServer;
    if (!server->CreateUDPSocketAndListen(*session->QuicAddr)) {
        std::cerr << "[Transport] Failed to create UDP socket" << std::endl;
    }

    std::cerr << "[Transport] Starting WebTransport on port: " << (int)session->port << std::endl;

    while (*session->is_session_active && session->is_thread_active) {
        server->WaitForEvents();

        struct video_transport_queue_frame *frame = (struct video_transport_queue_frame *)
            rbuf_try_peak(session->video_queue);
        if (frame != NULL) {
            if (StaticTransportSession->WebTransportSession != NULL) {
                quic::StratusWebTransportSessionVisitor *CurrentSession = StaticTransportSession->WebTransportSession;
                absl::Status ret = CurrentSession->SubmitDataToStream(Stream_Video,
                                                                      frame->is_description ? Codec_Description : Codec_Payload,
                                                                      frame->data, frame->length);
                if (!ret.ok()) {
                    std::cerr << "[Transport] " << ret;
                }
            }
            rbuf_pop(session->video_queue);
        }
    }
}

void transport_destroy(struct transport_session* session)
{
    session->QuicServer->Shutdown();
    delete session->QuicServer;
    delete session->WebTransportBackend;
    delete session->QuicAddr;
    delete session;
    return;
}

static void transport_free_input_msg(void *msg) {
    delete (std::string*)(((input_queue_msg*)msg)->cpp_str);
    delete (input_queue_msg*)msg;
}

int transport_main(struct session_args *args) {
    char *raw_port;
    int ret = 0, port;
    struct transport_session *session;

    // Get WebTransport port
    raw_port = getenv("STRATUSD_PORT");
    if (raw_port == NULL)
        port = 4433;
    else
        port = std::stoi(raw_port);

    session = transport_init(port, args->cert);
    if (session == NULL) {
        std::cerr << "[Transport] transport_init failed\n";
        return -1; // No need to jump to end outside of pthread_cleanup_* macro
    }
    session->is_session_active = &args->is_active;
    session->is_thread_active = true;
    session->client_connected = &args->client_connected;
    session->video_queue = args->video_transport_queue;
    session->input_queue = args->input_queue;
    rbuf_set_free(session->input_queue, &transport_free_input_msg);

    pthread_cleanup_push((void (*)(void*))transport_destroy, session);

    transport_thread(session);

    // If is_thread_active was set to zero, then we should exit immediately so
    // the SideCar detects that the client has disconnected. Otherwise, we must
    // have exited due to the is_session_active flag and so we should wait to be
    // killed by the SideCar.
    while (session->is_thread_active)
        sleep(1);

end:
    pthread_cleanup_pop(1);
    return 0;
}
