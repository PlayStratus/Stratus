#ifndef COMMON_VIDEO_ENCODE_QUEUE_H
#define COMMON_VIDEO_ENCODE_QUEUE_H

/*
 * This header file contains definitions shared between the Capture and Encode
 * modules.
 */

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

#endif
