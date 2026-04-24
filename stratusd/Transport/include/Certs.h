#include "QuicheCore.h"
#include "quiche/quic/core/crypto/proof_source.h"

#define FINGERPRINT_LEN 45  // Including padding & NULL-terminator

struct StratusCertificate {
    char der_hash[FINGERPRINT_LEN];
    char spki_hash[FINGERPRINT_LEN];
    std::unique_ptr<quic::ProofSource> proof_source;
};
