#include "QuicheCore.h"
#include "Transport.h"

namespace quic {

absl::StatusOr<std::unique_ptr<webtransport::SessionVisitor>> ProcessRequest(absl::string_view path, WebTransportSession* session) {
  GURL url(absl::StrCat("https://localhost", path));

  if (!url.is_valid()) {
    return absl::InvalidArgumentError("Unable to parse the :path");
  }

  if (url.path() == "/stratus/dev/video") {
    return std::make_unique<EchoWebTransportSessionVisitor>(session);
  }                                
  

  return absl::NotFoundError("Path not found");
}

}

void TransportTest()
{
    quic::WebTransportOnlyBackend backend(quic::ProcessRequest);
    // TODO: Create custom proof source that generates keys for session. 
    quic::QuicServer server(quiche::CreateDefaultProofSource(), nullptr, &backend);
    quic::QuicSocketAddress addr(quic::QuicIpAddress::Any6(), 6767);
  
    if (!server.CreateUDPSocketAndListen(addr)) {
        QUICHE_LOG(ERROR) << "Failed to bind the port address";
    }

    QUICHE_LOG(INFO) << "Bound the server on " << addr;
    server.HandleEventsForever();
}


