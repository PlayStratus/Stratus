#include "QuicheCore.h"
#include "Transport.h"
#include "QuicheTools.h"
#include "StratusWebTransportSessionVisitor.h"
#include <assert.h>
#include <iostream>

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
    session->port = port;

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

    server->HandleEventsForever();
}

void transport_destroy(transport_session* session)
{
  quic::QuicServer* server = (quic::QuicServer*)session->QuicServer;

  server->Shutdown();

  delete (quic::QuicServer*)session->QuicServer;
  delete (quic::QuicSimpleServerBackend*)session->WebTransportBackend;
  delete (quic::QuicSocketAddress*)session->QuicAddr;

  free(session);
  return;
}
