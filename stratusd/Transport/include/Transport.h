#pragma once

// Despite QuicheLib and the Transport module's use of C++. This header MUST stay in C.
// This file header abuses the "Opaque Pointer Pattern" to hide C++ impl details (Quiche Classes)
#ifdef __cplusplus
extern "C" {
#endif


void TransportTest();

#ifdef __cplusplus
}
#endif