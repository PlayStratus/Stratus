#ifndef COMMON_VIDEO_ENCODE_QUEUE_H
#define COMMON_VIDEO_ENCODE_QUEUE_H

/*
 * This header file contains definitions shared between the Capture and Encode
 * modules for their video encode queue.
 */

#include <stdint.h>

/*
 * Contains data for a dmabuf-backed wl_buffer object
 */
struct dma_buffer {
    uint32_t width;
    uint32_t height;
    uint32_t format;
    uint64_t modifier;
    int num_planes;
    struct {
        int fd;
        uint32_t offset;
        uint32_t stride;
    } planes[4];
};

/*
 * Contains data for a single captured frame
 */
struct video_encode_queue_frame {
    uint8_t *shm_data;
    struct dma_buffer *dma_data;
    int stride;

    // internal to capture module:
    void *buf;
    void *conn;
};

#endif
