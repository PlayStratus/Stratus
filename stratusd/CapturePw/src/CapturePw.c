/**
 * Audio Capture with PipeWire
 *
 * This module captures desktop audio using the PipeWire API based
 * on the example code provided in the PipeWire documentation [1].
 *
 * [1] https://docs.pipewire.org/audio-capture_8c-example.html
 */

#include "CapturePw.h"
#include "RingBuffer.h"

#include <pipewire/pipewire.h>
#include <pipewire/stream.h>
#include <spa/param/audio/format-utils.h>

#include <inttypes.h>
#include <pthread.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
 * Structure holding the Pipewire session states
 */
struct capture_pw_session {
  int running;

  /* PipeWire main loop and stream */
  struct pw_main_loop *loop;
  struct pw_stream *stream;

  /* Audio Format */
  struct spa_audio_info format;
  uint32_t sample_rate;
  uint32_t channels;
  uint32_t buffer_capacity_frames; // Ring buffer capacity in frames

  /* Ring buffer and synchronization */
  struct audio_ring_buffer *ring_buffer;
  pthread_mutex_t ring_lock;
  pthread_cond_t ring_cond;

  uint64_t
      dropped_frames; // Counter for dropped frames due to ring buffer overflow

  /* Audio encoder context and thread */
  int encoder_thread_started;
  struct audio_encoder_context *audio_encoder;
  pthread_t encoder_thread;
};

/*
 * On process callback for each audio buffer received from PipeWire
 *  - Gets frame data
 *  - Locks the ring buffer
 *  - Writes frame data to the ring buffer
 *  - Unlocks the ring buffer
 */
static void on_process(void *userdata) {
  struct capture_pw_session *session = userdata;
  struct pw_buffer *b;
  struct spa_buffer *buf;
  float *frame_data;
  uint32_t n_frames;
  uint32_t written_frames;

  // Get frame data
  if ((b = pw_stream_dequeue_buffer(session->stream)) == NULL) {
    pw_log_warn("out of buffers: %m");
    return;
  }

  buf = b->buffer;
  if (buf->datas[0].data == NULL || buf->datas[0].chunk == NULL) {
    pw_stream_queue_buffer(session->stream, b);
    return;
  }

  frame_data = buf->datas[0].data;
  if (frame_data == NULL) {
    pw_stream_queue_buffer(session->stream, b);
    return;
  }

  if (session->audio_encoder == NULL || session->ring_buffer == NULL ||
      session->channels == 0) {
    pw_stream_queue_buffer(session->stream, b);
    return;
  }

  n_frames = buf->datas[0].chunk->size / (sizeof(float) * session->channels);
  if (n_frames == 0) {
    pw_stream_queue_buffer(session->stream, b);
    return;
  }

  // Producer
  // Locks the ring buffer, writes frame data to the ring buffer, and unlocks it
  pthread_mutex_lock(&session->ring_lock);
  written_frames =
      ring_buffer_write(session->ring_buffer, frame_data, n_frames);
  pthread_mutex_unlock(&session->ring_lock);

  // Signal the encoder thread if we wrote any frames to the ring buffer
  if (written_frames > 0) {
    pthread_cond_signal(&session->ring_cond);
  }

  // If we couldn't write all frames to the ring buffer, it means we have an
  // overflow and need to drop frames. We keep track of the number of dropped
  // frames and print a warning message to the user
  if (written_frames < n_frames) {
    session->dropped_frames += n_frames - written_frames;
    fprintf(
        stderr,
        "[CapturePw] Ring buffer overflow, dropped frames: %" PRIu64 "\n",
        session->dropped_frames); // TODO: Handle dropped frames and remove this
                                  // since printing is bad for RTC performance
  }

  pw_stream_queue_buffer(session->stream, b);
}

/*
 * Audio encoder thread function
 * Consumer
 */
static void *audio_encoder_thread(void *userdata) {
  struct capture_pw_session *session = userdata;
  float *frame_data;

  frame_data = malloc((size_t)session->buffer_capacity_frames *
                      session->channels * sizeof(*frame_data));
  if (frame_data == NULL) {
    fprintf(stderr,
            "[CapturePw] Failed to allocate memory for audio encoder thread\n");
    return NULL;
  }

  while (1) {
    uint32_t frames_to_encode;

    pthread_mutex_lock(&session->ring_lock);

    // Sleep until there are frames available to consume
    while (ring_buffer_frames_available(session->ring_buffer) == 0 &&
           session->running) {
      pthread_cond_wait(&session->ring_cond, &session->ring_lock);
    }

    // If there are frames available, consume them
    frames_to_encode = ring_buffer_frames_available(session->ring_buffer);
    if (frames_to_encode == 0 && !session->running) {
      pthread_mutex_unlock(&session->ring_lock);
      break;
    }

    // Read frames from the ring buffer and unlock it before encoding
    ring_buffer_read(session->ring_buffer, frame_data, frames_to_encode);
    pthread_mutex_unlock(&session->ring_lock);

    if (encode_audio_frame(session->audio_encoder, frame_data,
                           frames_to_encode) < 0) {
      fprintf(stderr, "[CapturePw] Failed to encode audio frame\n");
    }
  }

  free(frame_data);
  return NULL;
}

/**
 * Callback for when the stream parameters change
 */
static void on_stream_param_changed(void *_data, uint32_t id,
                                    const struct spa_pod *param) {
  struct capture_pw_session *session = _data;

  int sample_rate;
  int channels;

  /* NULL means to clear the format */
  if (param == NULL || id != SPA_PARAM_Format)
    return;

  if (spa_format_parse(param, &session->format.media_type,
                       &session->format.media_subtype) < 0)
    return;

  /* only accept raw audio */
  if (session->format.media_type != SPA_MEDIA_TYPE_audio ||
      session->format.media_subtype != SPA_MEDIA_SUBTYPE_raw)
    return;

  /* call a helper function to parse the format for us. */
  spa_format_audio_raw_parse(param, &session->format.info.raw);

  sample_rate = session->format.info.raw.rate;
  channels = session->format.info.raw.channels;

  // Sets the sample rate and channels in the session
  session->sample_rate = sample_rate;
  session->channels = channels;

  // Inits the ring buffer
  if (session->ring_buffer == NULL) {
    session->buffer_capacity_frames = sample_rate / 2;
    if (session->buffer_capacity_frames == 0)
      session->buffer_capacity_frames = 2048;

    session->ring_buffer =
        ring_buffer_init(session->buffer_capacity_frames, session->channels);
    if (session->ring_buffer == NULL) {
      fprintf(stderr, "[CapturePw] Failed to initialize ring buffer\n");
      return;
    }
  }

  // Inits the audio encoder
  if (session->audio_encoder == NULL) {
    session->audio_encoder = audio_encoder_startup(sample_rate, channels);
    if (session->audio_encoder == NULL) {
      fprintf(stderr, "[CapturePw] Failed to initialize audio encoder\n");
      ring_buffer_destroy(session->ring_buffer);
      session->ring_buffer = NULL;
      return;
    }
  }

  // Start the encoder thread
  if (!session->encoder_thread_started) {
    if (pthread_create(&session->encoder_thread, NULL, audio_encoder_thread,
                       session) != 0) {
      fprintf(stderr, "[CapturePw] Failed to start audio encoder thread\n");
      audio_encoder_teardown(session->audio_encoder);
      session->audio_encoder = NULL;
      ring_buffer_destroy(session->ring_buffer);
      session->ring_buffer = NULL;
      return;
    }
    session->encoder_thread_started = 1;
  }

  fprintf(stdout, "[CapturePw] desktop playback format: rate=%u channels=%u\n",
          session->format.info.raw.rate, session->format.info.raw.channels);
}

static const struct pw_stream_events stream_events = {
    PW_VERSION_STREAM_EVENTS,
    .param_changed = on_stream_param_changed,
    .process = on_process,
};

/**
 * Callback for when SIGINT or SIGTERM is received to quit the main loop and
 * stop the session
 */
static void do_quit(void *userdata, int signal_number) {
  struct capture_pw_session *session = userdata;

  (void)signal_number;
  session->running = 0;
  pthread_mutex_lock(&session->ring_lock);
  pthread_cond_broadcast(&session->ring_cond);
  pthread_mutex_unlock(&session->ring_lock);
  pw_main_loop_quit(session->loop);
}

struct capture_pw_session *capture_pw_init(void) {
  struct capture_pw_session *session;

  session = calloc(1, sizeof(*session));
  if (session == NULL) {
    perror("[CapturePw] calloc");
    return NULL;
  }

  if (pthread_mutex_init(&session->ring_lock, NULL) != 0) {
    perror("[CapturePw] pthread_mutex_init");
    free(session);
    return NULL;
  }

  if (pthread_cond_init(&session->ring_cond, NULL) != 0) {
    perror("[CapturePw] pthread_cond_init");
    pthread_mutex_destroy(&session->ring_lock);
    free(session);
    return NULL;
  }

  return session;
}

/**
 * Runs the capture session
 */
int capture_pw_run(struct capture_pw_session *session) {
  const struct spa_pod *params[1];
  uint8_t buffer[1024];
  struct spa_pod_builder builder = SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
  struct pw_properties *props;

  if (session == NULL)
    return -1;

  pw_init(NULL, NULL);

  // Creates the main pipewire loop
  session->loop = pw_main_loop_new(NULL);
  if (session->loop == NULL)
    return -1;

  // Quit the main loop when SIGINT or SIGTERM is received
  pw_loop_add_signal(pw_main_loop_get_loop(session->loop), SIGINT, do_quit,
                     session);
  pw_loop_add_signal(pw_main_loop_get_loop(session->loop), SIGTERM, do_quit,
                     session);

  // Sets the properties to capture audio from the desktop
  props =
      pw_properties_new(PW_KEY_MEDIA_TYPE, "Audio", PW_KEY_MEDIA_CATEGORY,
                        "Capture", PW_KEY_STREAM_CAPTURE_SINK, "true", NULL);
  if (props == NULL)
    return -1;

  // Creates a new pipewire stream
  session->stream =
      pw_stream_new_simple(pw_main_loop_get_loop(session->loop),
                           "audio-capture", props, &stream_events, session);
  if (session->stream == NULL)
    return -1;

  params[0] = spa_format_audio_raw_build(
      &builder, SPA_PARAM_EnumFormat,
      &SPA_AUDIO_INFO_RAW_INIT(.format = SPA_AUDIO_FORMAT_F32));

  if (pw_stream_connect(session->stream, PW_DIRECTION_INPUT, PW_ID_ANY,
                        PW_STREAM_FLAG_AUTOCONNECT | PW_STREAM_FLAG_MAP_BUFFERS,
                        params, 1) < 0) {
    return -1;
  }

  session->running = 1;
  fprintf(stdout, "[CapturePw] Started audio capture session\n");

  // Starts the pipewire main loop
  pw_main_loop_run(session->loop);
  return 0;
}

void capture_pw_destroy(struct capture_pw_session *session) {
  if (session == NULL)
    return;

  session->running = 0;
  pthread_mutex_lock(&session->ring_lock);
  pthread_cond_broadcast(&session->ring_cond);
  pthread_mutex_unlock(&session->ring_lock);

  if (session->encoder_thread_started) {
    pthread_join(session->encoder_thread, NULL);
  }

  if (session->audio_encoder != NULL)
    audio_encoder_teardown(session->audio_encoder);
  if (session->ring_buffer != NULL)
    ring_buffer_destroy(session->ring_buffer);

  if (session->stream != NULL)
    pw_stream_destroy(session->stream);
  if (session->loop != NULL)
    pw_main_loop_destroy(session->loop);

  pw_deinit();
  pthread_cond_destroy(&session->ring_cond);
  pthread_mutex_destroy(&session->ring_lock);
  free(session);
}
