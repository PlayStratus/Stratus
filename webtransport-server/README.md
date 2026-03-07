# This is a server to test WebTransport connections.

Works with frontend web app `http://localhost:3000/mvp`

> Taken from [here](https://github.com/googlechrome/samples/tree/gh-pages/webtransport)

## System Flow (H.264 – avc1.42C01E)

1. The frontend connects to the WebTransport server  
   (`./mvp/page.tsx – handleConnecting()`).
1. The server accepts the WebTransport connection.
1. The server opens a unidirectional WebTransport stream and sends a
   configuration message containing the H.264 avcC description
   (SPS/PPS packaged as an `AVCDecoderConfigurationRecord`).  
   (`webtransport_server.py – _loop()` / session handler)
1. The client receives the configuration message and:
   - creates a `VideoDecoder` (if it does not already exist)
   - calls `decoder.configure({ codec: "avc1.42C01E", description: avcC })`  
     (`./mvp/page.tsx – handleStream()` + `ensureVideoDecoder()`)
   - an `isKey` flag (IDR keyframe vs. delta frame)
   - AVCC-formatted frame bytes (length-prefixed NAL units, not Annex-B)
1. The client buffers and parses incoming stream data, then:
   - ignores frame messages until a keyframe is received after
     `decoder.configure()`
   - creates `EncodedVideoChunk` objects with:
     - `type: "key"` or `"delta"`
     - monotonically increasing timestamps
     - the received AVCC frame bytes
   - calls `decoder.decode(chunk)`
1. The `VideoDecoder` outputs decoded `VideoFrame` objects.
1. The client renders each `VideoFrame` to the canvas and closes the frame.

## How to use

> Tested only on MacOS with M1 chip

1. `cd webtransport-server`
1. `openssl req -newkey rsa:2048 -nodes -keyout certificate.key -x509 -out certificate.pem -subj '/CN=Test Certificate' -addext "subjectAltName = DNS:localhost"` creates the certificates for handshake and encrypting
1. `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certificate.pem` Again Gonna be different on windows but this is to make sure that your computer knows to it can trust the certificate you generated
1. `python3 webtransport_server.py certificate.pem certificate.key` This is run the file
1. `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --origin-to-force-quic-on=localhost:4433` This will open Chrome with with the flags that it needs. This is gonna be different on windows
1. Open a new terminal tab and `cd frontend`
1. `npm run dev` to start the frontend server
1. Open `http://localhost:3000/mvp` in the Chrome instance you opened with the flags
