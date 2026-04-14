#ifndef CAPTURE_SHM_BUFFERS_PRIV_H
#define CAPTURE_SHM_BUFFERS_PRIV_H

#include "video-output-priv.h"

// shm-specific functions used by generic wl_buffer functions in video-capture.c
void wl_shm_buffer_free(struct wl_shm_buffer *buf);

#endif
