#include "QuicheTools.h"

namespace quiche {

// Will need to generate Certificate key pair via BoringSSL for prod. 
std::unique_ptr<quic::ProofSource> CreateStratusDevProofSourceImpl() {
  std::string certificate_file = "StratusDevCert.pem";
  std::string key_file = "StratusDevCert.key";

  std::ifstream cert_stream(certificate_file, std::ios::binary);

  std::vector<std::string> certs = quic::CertificateView::LoadPemFromStream(&cert_stream);
  if (certs.empty()) {
    QUICHE_LOG(FATAL)
        << "Failed to load certificate chain from "
        << certificate_file;
  }

  std::ifstream key_stream(key_file, std::ios::binary);
  std::unique_ptr<quic::CertificatePrivateKey> private_key =
      quic::CertificatePrivateKey::LoadPemFromStream(&key_stream);
  if (private_key == nullptr) {
    QUICHE_LOG(FATAL) << "Failed to load private key from "
                      << key_file;
  }

  QuicheReferenceCountedPointer<quic::ProofSource::Chain> chain(
      new quic::ProofSource::Chain({certs}));
  return quic::ProofSourceX509::Create(chain, std::move(*private_key));
}

}
