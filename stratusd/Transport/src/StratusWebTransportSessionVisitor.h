#include "quiche/quic/core/web_transport_interface.h"
#include "StratusSteamVisitors/StratusWebTransportOutboundStreamVisitor.h"
#include "StratusSteamVisitors/StratusWebTransportInboundStreamVisitor.h"



namespace quic {

class StratusWebTransportSessionVisitor : public WebTransportVisitor {
 public:
  StratusWebTransportSessionVisitor(WebTransportSession* session);

  void OnSessionReady() override;

  void OnSessionClosed(WebTransportSessionError error_code, const std::string& error_message) override;

  void OnIncomingBidirectionalStreamAvailable() override;

  void OnIncomingUnidirectionalStreamAvailable() override ;

  void OnDatagramReceived(absl::string_view datagram) override;

  void OnCanCreateNewOutgoingBidirectionalStream() override;

  void OnCanCreateNewOutgoingUnidirectionalStream() override; 

  void FlushMessageQueue();
 private:

  bool DropSession = false;
  WebTransportSession* session_;
  WebTransportStream* ControlStream;
  WebTransportStream* InputStream;
  WebTransportStream* VideoStream;

  StratusWebTransportOutboundStreamVisitor* VideoVisitor;
};

}