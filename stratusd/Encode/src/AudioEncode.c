#include "AudioEncode.h"
#include "SideCar.h"
#include "audio-transport-queue.h"

#include <opus/opus.h>
#include <inttypes.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>

#define FRAME_DURATION_MS 20
#define MAX_PACKET_SIZE 4000

/**
 * Structure representing the audio encoder context
 */
struct audio_encoder_context {
    OpusEncoder *encoder;
    uint32_t sample_rate;
    uint32_t channels;
    uint32_t frame_size;
    struct rbuf *output_queue;
    bool debug;
};

/**
 * Helper function to compute the Opus frame size based on the audio format
 */
static int audio_encoder_compute_frame_size(uint32_t sample_rate,
                                            uint32_t channels,
                                            uint32_t *frame_size) {
    uint64_t frame_size_numerator;

    if (sample_rate == 0) {
        fprintf(stderr,
                "[EncodeAudio] Unsupported audio sample rate: %" PRIu32 "\n",
                sample_rate);
        return -1;
    }

    if (channels == 0) {
        fprintf(stderr,
                "[EncodeAudio] Unsupported audio channel count: %" PRIu32 "\n",
                channels);
        return -1;
    }

    frame_size_numerator = (uint64_t)sample_rate * FRAME_DURATION_MS;
    if (frame_size_numerator % 1000 != 0) {
        fprintf(stderr,
                "[EncodeAudio] Unsupported audio format: sample_rate=%" PRIu32
                " Hz channels=%" PRIu32
                " does not yield an integral %u ms Opus frame size\n",
                sample_rate, channels, FRAME_DURATION_MS);
        return -1;
    }

    *frame_size = (uint32_t)(frame_size_numerator / 1000);
    return 0;
}

/**
 * Initializes the audio encoder
 */
struct audio_encoder_context *audio_encoder_startup(uint32_t sample_rate,
                                                    uint32_t channels,
                                                    struct rbuf *output_queue) {
    struct audio_encoder_context *ctx;
    int opus_error = OPUS_OK;

    ctx = malloc(sizeof(struct audio_encoder_context));
    if (ctx == NULL) {
        fprintf(stderr, "[EncodeAudio] Failed to allocate memory for audio "
                        "encoder context\n");
        return NULL;
    }

    if (audio_encoder_compute_frame_size(sample_rate, channels,
                                         &ctx->frame_size) < 0) {
        goto err;
    }

    ctx->channels = channels;
    ctx->sample_rate = sample_rate;
    ctx->output_queue = output_queue;
    ctx->debug = (getenv("STRATUSD_AUDIO_ENCODE_DEBUG") != NULL);

    ctx->encoder = opus_encoder_create(ctx->sample_rate, ctx->channels,
                                       OPUS_APPLICATION_AUDIO, &opus_error);
    if (ctx->encoder == NULL || opus_error != OPUS_OK) {
        fprintf(stderr, "[EncodeAudio] Failed to create Opus encoder: %s\n",
                opus_strerror(opus_error));
        goto err;
    }

    opus_encoder_ctl(ctx->encoder, OPUS_SET_BITRATE(64000));
    opus_encoder_ctl(ctx->encoder, OPUS_SET_VBR(1));
    opus_encoder_ctl(ctx->encoder, OPUS_SET_COMPLEXITY(10));

    return ctx;

err:
    free(ctx);
    return NULL;
}

/**
 * Encodes a single audio frame
 */
int encode_audio_frame(struct audio_encoder_context *ctx,
                       const int16_t *samples, uint32_t frame_count) {
    struct audio_transport_queue_frame *frame;
    unsigned char packet[MAX_PACKET_SIZE];
    int packet_len;

    if (ctx == NULL || samples == NULL) {
        fprintf(stderr,
                "[EncodeAudio] Invalid audio encoder context or samples\n");
        return -1;
    }

    if (ctx->debug)
        fprintf(stdout, "[EncodeAudio] Received audio frames: %u\n",
                frame_count);

    packet_len =
        opus_encode(ctx->encoder, samples, frame_count, packet, sizeof(packet));

    if (packet_len < 0) {
        fprintf(stderr,
                "[EncodeAudio] Opus encoding failed: %s (frame_count=%u, "
                "sample_rate=%u, channels=%u)\n",
                opus_strerror(packet_len), frame_count, ctx->sample_rate,
                ctx->channels);
        return -1;
    }

    frame = malloc(sizeof(*frame));
    if (frame == NULL) {
        perror("[EncodeAudio] malloc");
        return -1;
    }

    frame->length = packet_len;
    frame->data = malloc(frame->length);
    if (frame->data == NULL) {
        perror("[EncodeAudio] malloc");
        free(frame);
        return -1;
    }

    memcpy(frame->data, packet, frame->length);
    frame->transport_progress = 0;
    if (rbuf_push(ctx->output_queue, frame) < 0) {
        free(frame->data);
        free(frame);
        return -1;
    }

    return 0;
}

/*
 * Free an audio frame after its payload has been handed to transport.
 */
static void audio_encoder_free_frame(void *frame) {
    free(frame);
}

/**
 * Tears down the audio encoder
 */
int audio_encoder_teardown(struct audio_encoder_context *ctx) {
    if (ctx == NULL) {
        fprintf(stderr, "[EncodeAudio] Invalid audio encoder context\n");
        return -1;
    }

    opus_encoder_destroy(ctx->encoder);
    free(ctx);
    return 0;
}

int audio_encoder_main(void *userdata) {
    struct session_args *args = userdata;
    struct audio_context *audio_context;
    struct ring_buffer *audio_ring_buffer;
    struct audio_encoder_context *ctx;
    int16_t *frame_data;
    int16_t *pending_frame;
    uint32_t pending_frames;
    uint32_t sample_rate;
    uint32_t channels;
    uint32_t buffer_capacity_frames;
    uint32_t frame_size;

    if (args == NULL)
        return -1;

    audio_context = &args->audio_context;

    pthread_mutex_lock(&audio_context->format_mutex);
    while (!audio_context->format_ready && args->is_active) {
        pthread_cond_wait(&audio_context->format_cond,
                          &audio_context->format_mutex);
    }

    if (!args->is_active) {
        pthread_mutex_unlock(&audio_context->format_mutex);
        return 0;
    }

    sample_rate = audio_context->sample_rate;
    channels = audio_context->channels;
    buffer_capacity_frames = audio_context->buffer_capacity_frames;
    audio_ring_buffer = audio_context->ring_buffer;
    pthread_mutex_unlock(&audio_context->format_mutex);

    if (audio_ring_buffer == NULL || buffer_capacity_frames == 0)
        return -1;

    rbuf_set_free(args->audio_transport_queue, &audio_encoder_free_frame);

    if (audio_encoder_compute_frame_size(sample_rate, channels, &frame_size) <
        0) {
        fprintf(stderr,
                "[EncodeAudio] Encoder startup rejected runtime format: "
                "sample_rate=%u channels=%u frame_duration_ms=%u\n",
                sample_rate, channels, FRAME_DURATION_MS);
        return -1;
    }

    fprintf(stdout,
            "[AudioEncode] Runtime audio format: sample_rate=%u channels=%u "
            "frame_size=%u (%u ms)\n",
            sample_rate, channels, frame_size, FRAME_DURATION_MS);

    ctx = audio_encoder_startup(sample_rate, channels,
                                args->audio_transport_queue);
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

    pending_frame =
        malloc((size_t)frame_size * channels * sizeof(*pending_frame));
    if (pending_frame == NULL) {
        fprintf(stderr, "[EncodeAudio] Failed to allocate Opus frame buffer\n");
        free(frame_data);
        audio_encoder_teardown(ctx);
        return -1;
    }

    pending_frames = 0;

    while (1) {
        uint32_t frames_read;
        uint32_t frames_consumed;

        frames_read = ring_buffer_wait_read(audio_ring_buffer, frame_data,
                                            buffer_capacity_frames);
        if (frames_read == 0)
            break;

        frames_consumed = 0;
        while (frames_consumed < frames_read) {
            uint32_t frames_available;
            uint32_t frames_needed;
            uint32_t frames_to_copy;

            frames_available = frames_read - frames_consumed;
            frames_needed = frame_size - pending_frames;
            frames_to_copy = frames_available;
            if (frames_to_copy > frames_needed)
                frames_to_copy = frames_needed;

            memcpy(&pending_frame[(size_t)pending_frames * channels],
                   &frame_data[(size_t)frames_consumed * channels],
                   (size_t)frames_to_copy * channels * sizeof(*pending_frame));

            pending_frames += frames_to_copy;
            frames_consumed += frames_to_copy;

            if (pending_frames != frame_size)
                continue;

            if (encode_audio_frame(ctx, pending_frame, frame_size) < 0) {
                fprintf(stderr, "[EncodeAudio] Failed to encode audio frame\n");
            }

            pending_frames = 0;
        }
    }

    if (pending_frames > 0 && ctx->debug) {
        fprintf(stdout,
                "[EncodeAudio] Dropping partial audio frame on shutdown: %u\n",
                pending_frames);
    }

    free(pending_frame);
    free(frame_data);
    audio_encoder_teardown(ctx);
    return 0;
}
