#include "AudioEncode.h"

#include <sys/types.h>

// Output file for encoded audio frames
#define OUTPUT_AUDIO_FILE "output_audio.pcm"

/**
 * Structure representing the audio encoder context
 */
struct audio_encoder_context {
  FILE *output_file;
  uint32_t sample_rate;
  uint32_t channels;
};

/**
 * Initializes the audio encoder
 */
struct audio_encoder_context *audio_encoder_startup(uint32_t sample_rate,
                                                    uint32_t channels) {
  struct audio_encoder_context *ctx;

  ctx = malloc(sizeof(struct audio_encoder_context));
  if (ctx == NULL) {
    fprintf(
        stderr,
        "[EncodeAudio] Failed to allocate memory for audio encoder context\n");
    return NULL;
  }

  ctx->sample_rate = sample_rate;
  ctx->channels = channels;

  ctx->output_file = fopen(OUTPUT_AUDIO_FILE, "wb");
  if (ctx->output_file == NULL) {
    fprintf(stderr,
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
    fprintf(stderr, "[EncodeAudio] Invalid audio encoder context or samples\n");
    return -1;
  }

  total_samples = frame_count * ctx->channels;

  fprintf(stdout, "[EncodeAudio] Received audio frames: %u\n", frame_count);

  // TODO: Implement actual audio encoding here. For now, we will just write the
  // raw PCM data to the output file.

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
