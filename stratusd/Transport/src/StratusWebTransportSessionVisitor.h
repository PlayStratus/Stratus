#include <arpa/inet.h>
#include <cstdlib>
#include <iostream>

#include "quiche/quic/core/web_transport_interface.h"
#include "quiche/web_transport/web_transport.h"
#include "Common.h"
#include "TransportPriv.h"

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

  absl::Status SubmitDataToStream(enum TransportStreamType Stream, enum VideoMessageType MessageType, void* Buffer, int Length);

 private:
  static void FreeBuffer(absl::string_view Buffer);

  WebTransportSession* session_;
  WebTransportStream* ControlStream;
  WebTransportStream* InputStream;
  WebTransportStream* VideoStream;
};

}