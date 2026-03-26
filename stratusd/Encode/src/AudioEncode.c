#include "AudioEncode.h"
#include "SideCar.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

// Output file for encoded audio frames
#define OUTPUT_AUDIO_FILE "output_audio.pcm"

/**
 * Structure representing the audio encoder context
 */
struct audio_encoder_context {
    FILE *output_file;
    uint32_t channels;
};

/**
 * Initializes the audio encoder
 */
struct audio_encoder_context *audio_encoder_startup(uint32_t channels) {
    struct audio_encoder_context *ctx;

    ctx = malloc(sizeof(struct audio_encoder_context));
    if (ctx == NULL) {
        fprintf(stderr, "[EncodeAudio] Failed to allocate memory for audio "
                        "encoder context\n");
        return NULL;
    }

    ctx->channels = channels;

    ctx->output_file = fopen(OUTPUT_AUDIO_FILE, "wb");
    if (ctx->output_file == NULL) {
        fprintf(
            stderr,
            "[EncodeAudio] Failed to open output file for audio encoding\n");
        free(ctx);
        return NULL;
    }

    return ctx;
}

/**
 * Encodes a single audio frame
 */
int encode_audio_frame(struct audio_encoder_context *ctx, const float *samples,
                       uint32_t frame_count) {
    uint32_t total_samples;

    if (ctx == NULL || samples == NULL) {
        fprintf(stderr,
                "[EncodeAudio] Invalid audio encoder context or samples\n");
        return -1;
    }

    total_samples = frame_count * ctx->channels;

    fprintf(stdout, "[EncodeAudio] Received audio frames: %u\n", frame_count);

    // TODO: Implement actual audio encoding here. For now, we will just write
    // the raw PCM data to the output file.

    size_t written =
        fwrite(samples, sizeof(float), total_samples, ctx->output_file);
    if (written != total_samples) {
        fprintf(stderr,
                "[EncodeAudio] Failed to write audio frame to output file\n");
        return -1;
    }

    return 0;
}

/**
 * Tears down the audio encoder
 */
int audio_encoder_teardown(struct audio_encoder_context *ctx) {
    if (ctx == NULL) {
        fprintf(stderr, "[EncodeAudio] Invalid audio encoder context\n");
        return -1;
    }

    if (ctx->output_file != NULL) {
        fclose(ctx->output_file);
    }

    free(ctx);
    return 0;
}

int audio_encoder_main(void *userdata) {
    struct session_args *args = userdata;
    struct audio_context *audio_context;
    struct ring_buffer *audio_ring_buffer;
    struct audio_encoder_context *ctx;
    float *frame_data;
    uint32_t sample_rate;
    uint32_t channels;
    uint32_t buffer_capacity_frames;

    if (args == NULL)
        return -1;

    audio_context = &args->audio_context;

    pthread_mutex_lock(&audio_context->format_mutex);
    while (!audio_context->format_ready && !audio_context->shutdown_requested) {
        pthread_cond_wait(&audio_context->format_cond,
                          &audio_context->format_mutex);
    }

    if (audio_context->shutdown_requested) {
        pthread_mutex_unlock(&audio_context->format_mutex);
        return 0;
    }

    sample_rate = audio_context->sample_rate;
    channels = audio_context->channels;
    buffer_capacity_frames = audio_context->buffer_capacity_frames;
    audio_ring_buffer = audio_context->ring_buffer;
    pthread_mutex_unlock(&audio_context->format_mutex);

    if (audio_ring_buffer == NULL || buffer_capacity_frames == 0 ||
        channels == 0)
        return -1;

    ctx = audio_encoder_startup(channels);
    if (ctx == NULL)
        return -1;

    frame_data =
        malloc((size_t)buffer_capacity_frames * channels * sizeof(*frame_data));
    if (frame_data == NULL) {
        fprintf(stderr, "[EncodeAudio] Failed to allocate memory for audio "
                        "encoder thread\n");
        audio_encoder_teardown(ctx);
        return -1;
    }

    fprintf(stdout, "[AudioEncode] Audio Sample Rate: %u\n", sample_rate);
    fprintf(stdout, "[AudioEncode] Audio channel count: %u\n", channels);

    while (1) {
        uint32_t frames_to_encode;

        frames_to_encode = ring_buffer_wait_read(audio_ring_buffer, frame_data,
                                                 buffer_capacity_frames);
        if (frames_to_encode == 0)
            break;

        if (encode_audio_frame(ctx, frame_data, frames_to_encode) < 0) {
            fprintf(stderr, "[EncodeAudio] Failed to encode audio frame\n");
        }
    }

    free(frame_data);
    audio_encoder_teardown(ctx);
    return 0;
}
