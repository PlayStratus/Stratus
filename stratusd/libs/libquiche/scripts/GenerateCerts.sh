#!/bin/bash
echo "Generating Stratus Development Certificates"

openssl req -newkey rsa:2048 -nodes -keyout StratusDevCert.key \
-x509 -out StratusDevCert.pem -subj '/CN=Stratus Development Certificate' \
                   -addext "subjectAltName = DNS:localhost" # Production certs will need the Stratusd node's IP Address as the SubjectAltName

# Generating Certificate Thumbprint (Necessary for Whitelisting WebTransport Public Key)
Thumbprint=$(openssl x509 -pubkey -noout -in StratusDevCert.pem |
                   openssl rsa -pubin -outform der |
                   openssl dgst -sha256 -binary | base64)


echo "Google Chrome Launch Option:"
echo "./chromium -origin-to-force-quic-on=localhost:4433 --ignore-certificate-errors-spki-list=${Thumbprint}"
