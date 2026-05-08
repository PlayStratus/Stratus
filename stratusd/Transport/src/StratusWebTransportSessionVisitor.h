#pragma once

#include <arpa/inet.h>

#include "quiche/quic/core/web_transport_interface.h"
#include "rbuf2.h"

enum TransportStreamType
{
    Stream_Control,
    Stream_Video,
    Stream_Audio,
    Stream_Input
};

enum VideoMessageType
{
    Codec_Description,
    Codec_Payload
};


namespace quic {

class StratusWebTransportSessionVisitor : public WebTransportVisitor {
 public:
  StratusWebTransportSessionVisitor(WebTransportSession* session,
          rbuf *input_queue);

  void OnSessionReady() override;

  void OnSessionClosed(WebTransportSessionError error_code, const std::string& error_message) override;

  void OnIncomingBidirectionalStreamAvailable() override;

  void OnIncomingUnidirectionalStreamAvailable() override ;

  void OnDatagramReceived(absl::string_view datagram) override;

  void OnCanCreateNewOutgoingBidirectionalStream() override;

  void OnCanCreateNewOutgoingUnidirectionalStream() override;

  absl::Status SubmitDataToStream(enum TransportStreamType Stream, enum VideoMessageType MessageType, void* Buffer, int Length);
  absl::Status SubmitAudioDataToStream(enum TransportStreamType Stream, void* Buffer, int Length);

 private:
  static void FreeBuffer(absl::string_view Buffer);

  WebTransportSession* session_;
  WebTransportStream* ControlStream;
  WebTransportStream* InputStream;
  WebTransportStream* VideoStream;
  WebTransportStream* AudioStream;
  rbuf *input_queue;
};

}
