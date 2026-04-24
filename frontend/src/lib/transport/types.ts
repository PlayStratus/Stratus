type StatusType = "NOT_STARTED" | "LOADING" | "STREAMING" | "ERROR"

enum TransportStreamType {
  Stream_Control,
  Stream_Video,
  Stream_Audio,
  Stream_Input,
}

enum VideoMessageType {
  Codec_Description,
  Codec_Payload,
}

export { TransportStreamType, VideoMessageType }
export type { StatusType }
