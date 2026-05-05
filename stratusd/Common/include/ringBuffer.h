#ifndef COMMON_H
#define COMMON_H

#include <stddef.h>
#include <stdint.h>
#include <pthread.h>

struct ring_buffer;

struct ring_buffer *ring_buffer_init(uint32_t capacity, size_t item_size);
void ring_buffer_destroy(struct ring_buffer *ring);
uint32_t ring_buffer_write(struct ring_buffer *ring, const void *data,
                           uint32_t items);
uint32_t ring_buffer_wait_read(struct ring_buffer *ring, void *data,
                               uint32_t items);
void ring_buffer_close(struct ring_buffer *ring);

#endif
