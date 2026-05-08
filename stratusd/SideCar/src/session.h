#ifndef SIDECAR_SESSION_H
#define SIDECAR_SESSION_H

#include <pthread.h>

#include "SideCar.h"
#include "sidecar-priv.h"

/*
 * Used to index arrays of per-thread data
 */
enum threads {
    THREAD_CAPTURE = 0,
    THREAD_CAPTURE_PW,
    THREAD_AUDIO_ENCODER,
    THREAD_ENCODER,
    THREAD_INPUT,
    THREAD_TRANSPORT,

    THREAD_COUNT,
};

/*
 * Contains data for a single stream session
 */
struct session {
    char id[UUID_LEN];

    struct session_args args; // Arguments passed to every module

    char game_id[UUID_LEN];
    int game_pid;

    pthread_t threads[THREAD_COUNT];
    char thread_states[THREAD_COUNT]; // 1 for running, 0 for not
};

struct session *session_start(char *session_id, char *game_uuid, int width,
                              int height);

int session_poll(struct session *session);

void session_teardown(struct session *session);

#endif
