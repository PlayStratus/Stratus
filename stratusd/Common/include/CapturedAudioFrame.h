#ifndef CAPTURED_AUDIO_FRAME_H
#define CAPTURED_AUDIO_FRAME_H

#include <stddef.h>
#include <stdint.h>
#include <string.h>

/**
 * Structure representing a captured audio frame
 *
 * Since having a timestamp is important for audio synchronization, we include
 * it in the frame structure instead of just having the samples
 */

struct captured_audio_frame {
    uint64_t timestamp_us;
    int16_t samples[];
};

static inline size_t captured_audio_frame_item_size(uint32_t channels) {
    return offsetof(struct captured_audio_frame, samples) +
           (size_t)channels * sizeof(int16_t);
}

static inline void *captured_audio_frame_at(void *buffer, size_t item_size,
                                            uint32_t index) {
    return &((unsigned char *)buffer)[(size_t)index * item_size];
}

static inline const void *captured_audio_frame_at_const(const void *buffer,
                                                        size_t item_size,
                                                        uint32_t index) {
    return &((const unsigned char *)buffer)[(size_t)index * item_size];
}

static inline void captured_audio_frame_set_timestamp_us(void *item,
                                                         uint64_t timestamp_us) {
    memcpy(item, &timestamp_us, sizeof(timestamp_us));
}

static inline uint64_t captured_audio_frame_get_timestamp_us(const void *item) {
    uint64_t timestamp_us;

    memcpy(&timestamp_us, item, sizeof(timestamp_us));
    return timestamp_us;
}

static inline int16_t *captured_audio_frame_samples(void *item) {
    return (int16_t *)((unsigned char *)item +
                       offsetof(struct captured_audio_frame, samples));
}

static inline const int16_t *
captured_audio_frame_samples_const(const void *item) {
    return (const int16_t *)((const unsigned char *)item +
                             offsetof(struct captured_audio_frame, samples));
}

#endif
