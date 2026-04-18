#pragma once

// Despite QuicheLib and the Transport module's use of C++. This header MUST stay in C.
// This file header abuses the "Opaque Pointer Pattern" to hide C++ impl details (Quiche Classes)
#ifdef __cplusplus
extern "C" {
#endif

#include <SideCar.h>

int transport_main(struct session_args *args);

struct StratusCertificate *create_certificate();

void destroy_certificate(struct StratusCertificate *cert);

char *get_der_hash(struct StratusCertificate *cert);

char *get_spki_hash(struct StratusCertificate *cert);

#ifdef __cplusplus
}
#endif
