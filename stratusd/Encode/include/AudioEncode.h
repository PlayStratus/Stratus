#ifndef AUDIO_ENCODE_H
#define AUDIO_ENCODE_H

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

struct audio_encoder_context;

struct audio_encoder_context *audio_encoder_startup(uint32_t sample_rate,
                                                    uint32_t channels);
int encode_audio_frame(struct audio_encoder_context *ctx, const float *samples,
                       uint32_t frame_count);
int audio_encoder_teardown(struct audio_encoder_context *ctx);

#endif
