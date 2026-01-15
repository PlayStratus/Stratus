# This is a server to test WebTransport connections.

Works with frontend web app `http://localhost:3000/mvp`

> Taken from [here](https://github.com/googlechrome/samples/tree/gh-pages/webtransport)

## How to use

> Tested only on MacOS with M1 chip

1. `cd webtransport-server`
1. `openssl req -newkey rsa:2048 -nodes -keyout certificate.key -x509 -out certificate.pem -subj '/CN=Test Certificate' -addext "subjectAltName = DNS:localhost"` creates the certificates for handshake and encrypting
1. `openssl x509 -pubkey -noout -in certificate.pem | openssl rsa -pubin -outform der | openssl dgst -sha256 -binary | base64` IDK what this really does but in the .py file it says to run this and I don't know what it really does and didn't really look into it

1. `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certificate.pem` Again Gonna be different on windows but this is to make sure that your computer knows to it can trust the certificate you generated
1. `python3 test.py certificate.pem certificate.key` This is run the file
1. `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --origin-to-force-quic-on=localhost:4433 --ignore-certificate-errors` This will open Chrome with with the flags that it needs. This is gonna be different on windows
1. Open a new terminal tab and `cd frontend`
1. `npm run dev` to start the frontend server
1. Open `http://localhost:3000/mvp` in the Chrome instance you opened with the flags

## Next steps

- Get a video on the server and encode it using some codec with ffmpeg
- Have the server send the video on loop to every client that connects
- Get the frontend to decode and play the video using WebCodecs API
