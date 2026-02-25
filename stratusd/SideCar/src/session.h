#ifndef SIDECAR_SESSION_H
#define SIDECAR_SESSION_H

#include <pthread.h>

#include "Capture.h"
// #include "Encode.h"
#include "Input.h"

/*
 * Contains data for a single stream session
 */
struct session {
    pthread_t capture_thread;
    struct capture_session *capture;    // internal data for Capture module

    // Encode is managed by Capture for now, see comment in capture_run
    // encoder_context *encode;            // internal data for Encode module

    pthread_t input_thread;
    struct input_session *input;        // internal data for Input module
};

struct session *session_start(int width, int height, char *encode_output);

void session_wait(struct session *session);

void session_teardown(struct session *session);

#endif
