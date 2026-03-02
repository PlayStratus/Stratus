#ifndef CAPTURE_DMA_BUFFERS_PRIV_H
#define CAPTURE_DMA_BUFFERS_PRIV_H

#include "video-output-priv.h"
#include "capture-priv.h"

// dmabuf-specific functions used by generic wl_buffer functions in video-capture.c
void wl_dma_buffer_free(struct wl_dma_buffer *buf);
enum proxy_actions wl_dmabuf_surface_commit(struct capture_data *data,
                                            struct wl_surface *surf);

#endif
