#include "QuicheCore.h"
#include "quiche/quic/core/crypto/proof_source.h"
#include "quiche/quic/core/crypto/proof_verifier.h"
#include "quiche/quic/core/crypto/proof_source_x509.h"
#include <fstream>

namespace quiche 
{
    std::unique_ptr<quic::ProofSource> CreateStratusDevProofSourceImpl();
}
