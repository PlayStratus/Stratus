#include <curl/curl.h>
#include <cstdlib>

#include "quiche/quic/core/crypto/certificate_util.h"
#include "quiche/quic/core/crypto/proof_source_x509.h"

#include "Certs.h"
#include "Transport.h"

// Just ripped from lib/curlx/base64.c in curl
static char table64[]=
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
static char padbyte = '=';
static void base64_encode(const uint8_t *in, size_t insize, char *output) {
    size_t outlen = 0;

    while(insize >= 3) {
        *output++ = table64[in[0] >> 2];
        *output++ = table64[((in[0] & 0x03) << 4) | (in[1] >> 4)];
        *output++ = table64[((in[1] & 0x0F) << 2) | ((in[2] & 0xC0) >> 6)];
        *output++ = table64[in[2] & 0x3F];
        insize -= 3;
        in += 3;
    }
    if(insize) {
        /* this is only one or two bytes now */
        *output++ = table64[in[0] >> 2];
        if(insize == 1) {
            *output++ = table64[((in[0] & 0x03) << 4)];
            if(padbyte) {
                *output++ = padbyte;
                *output++ = padbyte;
            }
        }
        else {
            /* insize == 2 */
            *output++ = table64[((in[0] & 0x03) << 4) | ((in[1] & 0xF0) >> 4)];
            *output++ = table64[((in[1] & 0x0F) << 2)];
            if(padbyte)
                *output++ = padbyte;
        }
    }

    /* Null-terminate */
    *output = '\0';
}

struct StratusCertificate *create_certificate() {
    // Generate certificate options
    quic::CertificateOptions options = {};
    options.subject = "CN=subject";
    options.serial_number = 0x12345678;

    time_t tt_start = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
    time_t tt_end = tt_start + 7 * 24*60*60; // Cert valid for 7 days
    tm tm_start = *gmtime(&tt_start);
    tm tm_end = *gmtime(&tt_end);

    options.validity_start.year = tm_start.tm_year + 1900;
    options.validity_start.month = tm_start.tm_mon + 1;
    options.validity_start.day = tm_start.tm_mday;
    options.validity_start.hour = options.validity_start.minute =
        options.validity_start.minute = 0;

    options.validity_end.year = tm_end.tm_year + 1900;
    options.validity_end.month = tm_end.tm_mon + 1;
    options.validity_end.day = tm_end.tm_mday;
    options.validity_end.hour = options.validity_end.minute =
        options.validity_end.minute = 0;

    // Construct certificate
    quic::CertificatePrivateKey private_key(
        quic::MakeKeyPairForSelfSignedCertificate());
    std::string der_cert = quic::CreateSelfSignedCertificate(
        *private_key.private_key(), options);
    quiche::QuicheReferenceCountedPointer<quic::ProofSource::Chain>
    chain(new quic::ProofSource::Chain({ der_cert }));

    // Construct ProofSource
    auto proof_source =
        quic::ProofSourceX509::Create(chain, std::move(private_key));
    if (proof_source == nullptr) {
        return nullptr;
    }

    StratusCertificate *cert = new StratusCertificate();
    cert->proof_source = std::move(proof_source);

    // Dump fingerprints
    std::string raw_der_hash = quic::RawSha256(der_cert);
    base64_encode((uint8_t*)raw_der_hash.c_str(), 32, cert->der_hash);
    std::string raw_spki_hash = quic::RawSha256(
        quic::CertificateView::ParseSingleCertificate(der_cert)->raw_spki()
    );
    base64_encode((uint8_t*)raw_spki_hash.c_str(), 32, cert->spki_hash);

    return cert;
}

void destroy_certificate(struct StratusCertificate *cert) {
    delete cert;
}

char *get_der_hash(struct StratusCertificate *cert) {
    return cert->der_hash;
};

char *get_spki_hash(struct StratusCertificate *cert) {
    return cert->spki_hash;
};
