#ifndef SIDECAR_H
#define SIDECAR_H

#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>

#include "Common.h"
#include "rbuf2.h"

/*
 * Contains arguments that are provided to each module on startup
 *
 * In the future, this will also contain e.g. pointers to shared ring buffers.
 */
struct audio_context {
    uint32_t sample_rate;
    uint32_t channels;
    uint32_t buffer_capacity_frames;
    struct ring_buffer *ring_buffer;
    pthread_mutex_t format_mutex;
    pthread_cond_t format_cond;
    int format_ready;
};

struct session_args {
    bool is_active;
    bool client_connected; // Owned by Transport
    char *encode_output;
    uint32_t width;
    uint32_t height;
    struct StratusCertificate *cert;
    struct audio_context audio_context;
    struct rbuf *video_encode_queue;
    struct rbuf *video_transport_queue;
    struct rbuf *input_queue;
};

int sidecar_main();

#endif
