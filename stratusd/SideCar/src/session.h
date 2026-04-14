#ifndef SIDECAR_SESSION_H
#define SIDECAR_SESSION_H

#include <pthread.h>

#include "SideCar.h"
#include "sidecar-priv.h"

/*
 * Contains data for a single stream session
 */
struct session {
    char id[UUID_LEN];

    struct session_args args; // Arguments passed to every module

    char game_id[UUID_LEN];
    int game_pid;

    pthread_t capture_thread;
    pthread_t capture_pw_thread;
    pthread_t audio_encoder_thread;
    pthread_t encode_thread;
    pthread_t input_thread;
    pthread_t transport_thread;
};

struct session *session_start(char *session_id, char *game_uuid, int width,
                              int height, char *encode_output);

int session_poll(struct session *session);

void session_teardown(struct session *session);

#endif
