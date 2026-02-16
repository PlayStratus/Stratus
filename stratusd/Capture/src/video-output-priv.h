#ifndef CAPTURE_VIDEO_OUTPUT_PRIV_H
#define CAPTURE_VIDEO_OUTPUT_PRIV_H

#include <stdbool.h>
#include <stdint.h>

/*
 * Contains data for a wl_surface object
 */
struct wl_surface {
    uint32_t id;
    struct wl_buffer *buf;          // The currently attached buffer
    uint32_t dependents;
};

/*
 * Contains data for a wl_buffer object
 *
 * Note: we do not process all methods that create buffers, so not every
 * wl_buffer object will correspond to an instance of the wl_buffer struct.
 */
struct wl_buffer {
    uint32_t id;
    int32_t width;
    int32_t height;
    struct wl_shm_buffer *shm_buf; // NULL if buffer is not shm-backed
    uint32_t dependents;
};

#endif
