#ifndef RING_BUFFER_H
#define RING_BUFFER_H

#include <stdint.h>

struct audio_ring_buffer;

struct audio_ring_buffer *ring_buffer_init(uint32_t capacity_frames,
                                           uint32_t channels);
void ring_buffer_destroy(struct audio_ring_buffer *ring);
uint32_t ring_buffer_write(struct audio_ring_buffer *ring, const float *data,
                           uint32_t frames);
uint32_t ring_buffer_read(struct audio_ring_buffer *ring, float *data,
                          uint32_t frames);
uint32_t ring_buffer_frames_available(const struct audio_ring_buffer *ring);

#endif
