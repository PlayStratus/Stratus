#ifndef SIDECAR_H
#define SIDECAR_H

#include <pthread.h>

#include "Capture.h"
#include "Encode.h"
#include "Input.h"

/*
 * Contains data for a single stream session
 */
struct session {
    pthread_t capture_thread;
    struct capture_session *capture;    // internal data for Capture module

    encoder_context *encode;            // internal data for Encode module

    pthread_t input_thread;
    struct input_session *input;        // internal data for Input module
};

int sidecar_session_run(int width, int height, char *encode_output);

#endif
