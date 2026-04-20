#include "QuicheCore.h"
#include "Transport.h"
#include "Certs.h"
#include "StratusWebTransportSessionVisitor.cpp"
#include <assert.h>
#include <iostream>
#include "TransportPriv.h"
#include "video-transport-queue.h"

namespace quic {

absl::StatusOr<std::unique_ptr<webtransport::SessionVisitor>> ProcessRequest(absl::string_view path, WebTransportSession* session) {
  GURL url(absl::StrCat("https://localhost", path));

  if (!url.is_valid()) {
    return absl::InvalidArgumentError("Unable to parse the :path");
  }

  if (url.path() == "/") {
    if (!StaticTransportSession->WebTransportSession) {
      return std::make_unique<StratusWebTransportSessionVisitor>(session);
    } else {
      std::cerr << "[Transport] Warning: A client attempted to establish a connection but was rejected." << std::endl;
      return absl::AlreadyExistsError("[Transport] Error: A client has already established a connection to this node.");
    }
  }


  return absl::NotFoundError("Path not found");
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
        std::cerr << "[transport] Failed to create UDP socket" << std::endl;
    }

    std::cerr << "[transport] Starting WebTransport on port: " << (int)session->port;

    while (1) {
      server->WaitForEvents();
      struct video_transport_queue_frame *frame = (struct video_transport_queue_frame *)rbuf_try_peak_latest(session->video_queue);
      if (frame != NULL) {
        if (StaticTransportSession->WebTransportSession != NULL) {
          quic::StratusWebTransportSessionVisitor* CurrentSession = StaticTransportSession->WebTransportSession;
          absl::Status ret = CurrentSession->SubmitDataToStream(Stream_Video,
            frame->is_description ? Codec_Decsription : Codec_Payload,
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

int transport_main(struct session_args *args) {
    int ret = 0;
    struct transport_session *session;

    session = transport_init(4433, args->cert);
    if (session == NULL) {
        std::cerr << "[Transport] transport_init failed\n";
        return -1; // No need to jump to end outside of pthread_cleanup_* macro
    }
    session->video_queue = args->video_transport_queue;

    pthread_cleanup_push((void (*)(void*))transport_destroy, session);

    transport_thread(session);

end:
    pthread_cleanup_pop(1);
    return 0;
}
