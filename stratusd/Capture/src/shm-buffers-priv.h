#ifndef CAPTURE_SHM_BUFFERS_PRIV_H
#define CAPTURE_SHM_BUFFERS_PRIV_H

#include "capture-priv.h"
#include "video-output-priv.h"

// shm-specific functions used by generic wl_buffer functions in video-capture.c
void wl_shm_buffer_free(struct wl_shm_buffer *buf);
enum proxy_actions wl_shm_surface_commit(struct capture_data *data,
                                         struct wl_surface *surf);

#endif
