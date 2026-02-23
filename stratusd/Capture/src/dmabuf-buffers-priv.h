#ifndef CAPTURE_DMABUF_BUFFERS_PRIV_H
#define CAPTURE_DMABUF_BUFFERS_PRIV_H

#include "video-output-priv.h"
#include "capture-priv.h"

// dmabuf-specific functions used by generic wl_buffer functions in video-capture.c
void wl_dmabuf_buffer_free(struct wl_dmabuf_buffer *buf);
enum proxy_actions wl_dmabuf_surface_commit(struct capture_data *data,
                                            struct wl_surface *surf);

#endif
