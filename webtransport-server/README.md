# This is a server to test WebTransport connections.

Works with frontend web app `http://localhost:3000/mvp`

> Taken from [here](https://github.com/googlechrome/samples/tree/gh-pages/webtransport)

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

## Notes

- How I think is going to work:
  1. Client spins up a game instance on Stratus D server
  1. Client connects to WebTransport server on Stratus D and starts a bidirectional stream
  1. Compositor D has game frames and uses some codec to encode them
  1. WebTransport server sends the encoded frames to the client using the bidirectional stream
  1. Client decodes the frames using WebCodecs API and displays them
  1. Client sends input events to the server using the same bidirectional stream
- What schemas we need
  - What the client sends to the server to spin up a game instance
    - User ID
    - Game ID
    - Resolution
    - usable Codecs
  - 'Header bytes' for each frame so the client knows how to decode them
    - Size of the frame
    - Timestamp
    - Codec used
  - Input event schema
    - Type of event (mouse, keyboard, etc)
    - Event data (key code, mouse position, etc)
  - Updated resolution schema
    - New resolution (width, height)
