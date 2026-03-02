#ifndef SIDECAR_H
#define SIDECAR_H

#include "Capture.h"
#include "Encode.h"
#include <stdint.h>

/*
 * Contains data for a single stream session
 */
struct session {
    struct capture_session *capture;    // internal data for Capture module
    encoder_context *encode;            // internal data for Encode module
};

int sidecar_session_run(int width, int height);

#endif
