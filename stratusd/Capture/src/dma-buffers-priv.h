#ifndef CAPTURE_DMA_BUFFERS_PRIV_H
#define CAPTURE_DMA_BUFFERS_PRIV_H

#include "video-encode-queue.h"

// dmabuf-specific functions used by generic wl_buffer functions in video-capture.c
void dma_buffer_free(struct dma_buffer *buf);

#endif
