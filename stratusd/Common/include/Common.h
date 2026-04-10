#ifndef COMMON_H
#define COMMON_H

#include <stddef.h>
#include <stdint.h>

struct ring_buffer;

struct ring_buffer *ring_buffer_init(uint32_t capacity, size_t item_size);
void ring_buffer_destroy(struct ring_buffer *ring);
uint32_t ring_buffer_write(struct ring_buffer *ring, const void *data,
                           uint32_t items);
uint32_t ring_buffer_wait_read(struct ring_buffer *ring, void *data,
                               uint32_t items);
void ring_buffer_close(struct ring_buffer *ring);

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
    struct wl_dma_buffer *dma_buf;
    uint32_t dependents;
};

/*
 * Contains data for a shm-backed wl_buffer object
 */
struct wl_shm_buffer {
    void *p;
    int32_t stride;
    struct wl_shm_pool *pool;
};

#endif
