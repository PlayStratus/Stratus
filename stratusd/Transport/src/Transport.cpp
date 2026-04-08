#include "QuicheCore.h"
#include "Transport.h"
#include "QuicheTools.h"
#include "StratusWebTransportSessionVisitor.cpp"
#include <assert.h>
#include <iostream>
#include <vector>
#include "TransportPriv.h"

extern "C" {
    #include "Common.h"
}

namespace quic {

absl::StatusOr<std::unique_ptr<webtransport::SessionVisitor>> ProcessRequest(absl::string_view path, WebTransportSession* session) {
  GURL url(absl::StrCat("https://localhost", path));

  if (!url.is_valid()) {
    return absl::InvalidArgumentError("Unable to parse the :path");
  }

  if (url.path() == "/") {
    return std::make_unique<StratusWebTransportSessionVisitor>(session);
  }


  return absl::NotFoundError("Path not found");
}

}

transport_session* transport_init(int port)
{
    // Session init
    transport_session* session = (transport_session*)malloc(sizeof(transport_session));
    StaticTransportSession = session;

    session->port = port;

    memset(session->WebTransportSessionArray, 0, sizeof(session->WebTransportSessionArray));
    session->WebTransportSessionCount = 0;

    // Storing as void PTRs for C Backwards Compat.
    session->WebTransportBackend = new quic::WebTransportOnlyBackend(quic::ProcessRequest);
    session->QuicServer = new quic::QuicServer(quiche::CreateStratusDevProofSourceImpl(), nullptr, (quic::QuicSimpleServerBackend*)session->WebTransportBackend);
    session->QuicAddr = new quic::QuicSocketAddress(quic::QuicIpAddress::Any6(), port);

    return session;
}

void transport_thread(struct transport_session* session)
{
    quic::QuicServer* server = (quic::QuicServer*)session->QuicServer;
    if (!server->CreateUDPSocketAndListen(*(quic::QuicSocketAddress*)session->QuicAddr)) {
        std::cerr << "[transport] Failed to create UDP socket" << std::endl;
    }

    std::cerr << "[transport] Starting WebTransport on port: " << (int)session->port;

    while (1) {
      server->WaitForEvents();

      struct Letter* CurrentLetter = CheckMail();

      if (CurrentLetter && StaticTransportSession->WebTransportSessionArray[0]) {
        quic::StratusWebTransportSessionVisitor* CurrentSession = (quic::StratusWebTransportSessionVisitor*)StaticTransportSession->WebTransportSessionArray[0];
        absl::Status ret = CurrentSession->SubmitDataToStream(CurrentLetter->Stream, CurrentLetter->MessageType, CurrentLetter->Data, CurrentLetter->DataLength);
        if (!ret.ok()) {
          std::cerr << "[Transport] " << ret;
        }
      }

      free(CurrentLetter);
    }
}

void transport_destroy(struct transport_session* session)
{
  ((quic::QuicServer*)session->QuicServer)->Shutdown();
  delete (quic::QuicServer*)session->QuicServer;
  delete (quic::QuicSimpleServerBackend*)session->WebTransportBackend;
  delete (quic::QuicSocketAddress*)session->QuicAddr;

  free(session);
  return;
}

int transport_main(struct session_args *args) {
    int ret = 0;
    struct transport_session *session;

    session = transport_init(4433);
    if (session == NULL) {
        std::cerr << "[Transport] transport_init failed\n";
        return -1; // No need to jump to end outside of pthread_cleanup_* macro
    }

    pthread_cleanup_push((void (*)(void*))transport_destroy, session);

    transport_thread(session);

end:
    pthread_cleanup_pop(1);
    return 0;
}
