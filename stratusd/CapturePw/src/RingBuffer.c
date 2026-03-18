/**
 * A simple ring buffer implementation for audio data
 */
#include "RingBuffer.h"

#include <stdlib.h>
#include <string.h>

#include <stddef.h>
#include <stdint.h>

/**
 * Structure representing an audio ring buffer
 */
struct audio_ring_buffer {
  float *buffer;

  uint32_t capacity_frames;
  uint32_t channels;
  uint32_t read_pos;
  uint32_t write_pos;
  uint32_t frames_available;
};

/**
 * Calculates the number of frames that can be written to the ring buffer
 */
static uint32_t ring_buffer_frames_free(const struct audio_ring_buffer *ring) {
  if (ring == NULL)
    return 0;

  return ring->capacity_frames - ring->frames_available;
}

/**
 * Copies frames from source to destination
 */
static void ring_buffer_copy_frames(float *dst, const float *src,
                                    uint32_t frames, uint32_t channels) {
  memcpy(dst, src, (size_t)frames * channels * sizeof(float));
}

/**
 * Initializes an audio ring buffer
 */
struct audio_ring_buffer *ring_buffer_init(uint32_t capacity_frames,
                                           uint32_t channels) {
  struct audio_ring_buffer *ring;

  if (capacity_frames == 0 || channels == 0)
    return NULL;

  ring = calloc(1, sizeof(*ring));
  if (ring == NULL)
    return NULL;

  ring->buffer =
      malloc((size_t)capacity_frames * channels * sizeof(*ring->buffer));
  if (ring->buffer == NULL) {
    free(ring);
    return NULL;
  }

  ring->capacity_frames = capacity_frames;
  ring->channels = channels;
  return ring;
}

/**
 * Destroys an audio ring buffer
 */
void ring_buffer_destroy(struct audio_ring_buffer *ring) {
  if (ring == NULL)
    return;

  free(ring->buffer);
  free(ring);
}

/**
 * Writes frames to the ring buffer
 */
uint32_t ring_buffer_write(struct audio_ring_buffer *ring, const float *data,
                           uint32_t frames) {
  uint32_t frames_to_write;
  uint32_t first_chunk_frames;
  uint32_t second_chunk_frames;

  if (ring == NULL || data == NULL || frames == 0)
    return 0;

  frames_to_write = frames;
  if (frames_to_write > ring_buffer_frames_free(ring))
    frames_to_write = ring_buffer_frames_free(ring);

  if (frames_to_write == 0)
    return 0;

  first_chunk_frames = ring->capacity_frames - ring->write_pos;
  if (first_chunk_frames > frames_to_write)
    first_chunk_frames = frames_to_write;

  second_chunk_frames = frames_to_write - first_chunk_frames;

  ring_buffer_copy_frames(
      &ring->buffer[(size_t)ring->write_pos * ring->channels], data,
      first_chunk_frames, ring->channels);
  if (second_chunk_frames > 0) {
    ring_buffer_copy_frames(ring->buffer,
                            &data[(size_t)first_chunk_frames * ring->channels],
                            second_chunk_frames, ring->channels);
  }

  ring->write_pos = (ring->write_pos + frames_to_write) % ring->capacity_frames;
  ring->frames_available += frames_to_write;
  return frames_to_write;
}

/**
 * Reads frames from the ring buffer
 */
uint32_t ring_buffer_read(struct audio_ring_buffer *ring, float *data,
                          uint32_t frames) {
  uint32_t frames_to_read;
  uint32_t first_chunk_frames;
  uint32_t second_chunk_frames;

  if (ring == NULL)
    return 0;

  if (data == NULL && frames == 0)
    return ring->frames_available;

  if (data == NULL || frames == 0)
    return 0;

  frames_to_read = frames;
  if (frames_to_read > ring->frames_available)
    frames_to_read = ring->frames_available;

  if (frames_to_read == 0)
    return 0;

  first_chunk_frames = ring->capacity_frames - ring->read_pos;
  if (first_chunk_frames > frames_to_read)
    first_chunk_frames = frames_to_read;

  second_chunk_frames = frames_to_read - first_chunk_frames;

  ring_buffer_copy_frames(
      data, &ring->buffer[(size_t)ring->read_pos * ring->channels],
      first_chunk_frames, ring->channels);
  if (second_chunk_frames > 0) {
    ring_buffer_copy_frames(&data[(size_t)first_chunk_frames * ring->channels],
                            ring->buffer, second_chunk_frames, ring->channels);
  }

  ring->read_pos = (ring->read_pos + frames_to_read) % ring->capacity_frames;
  ring->frames_available -= frames_to_read;
  return frames_to_read;
}

/**
 * Gets the number of frames available to read from the ring buffer
 */
uint32_t ring_buffer_frames_available(const struct audio_ring_buffer *ring) {
  if (ring == NULL)
    return 0;

  return ring->frames_available;
}
