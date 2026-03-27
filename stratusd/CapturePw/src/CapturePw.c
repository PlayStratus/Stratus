/**
 * Audio Capture with PipeWire
 *
 * This module captures desktop audio using the PipeWire API based
 * on the example code provided in the PipeWire documentation [1].
 *
 * [1] https://docs.pipewire.org/audio-capture_8c-example.html
 */

#include "CapturePw.h"
#include "Common.h"
#include "SideCar.h"

#include <pipewire/pipewire.h>
#include <pipewire/stream.h>
#include <spa/param/audio/format-utils.h>

#include <inttypes.h>
#include <pthread.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

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
    struct audio_context *audio_context;

    uint64_t dropped_frames; // Counter for frames discarded when a single
                             // capture chunk exceeds ring capacity
    bool debug;
};

/*
 * Helper function to get the ring buffer from the session's audio context
 */
static struct ring_buffer *
capture_pw_ring_buffer(struct capture_pw_session *session) {
    if (session == NULL || session->audio_context == NULL)
        return NULL;

    return session->audio_context->ring_buffer;
}

/*
 * On process callback for each audio buffer received from PipeWire
 *  - Gets frame data
 *  - Writes frame data to the ring buffer
 */
static void on_process(void *userdata) {
    struct capture_pw_session *session = userdata;
    struct ring_buffer *audio_ring_buffer;
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
        goto end;
    }

    frame_data = buf->datas[0].data;

    audio_ring_buffer = capture_pw_ring_buffer(session);
    if (audio_ring_buffer == NULL || session->audio_context->channels == 0) {
        goto end;
    }

    n_frames = buf->datas[0].chunk->size /
               (sizeof(float) * session->audio_context->channels);
    if (n_frames == 0) {
        goto end;
    }

    written_frames = ring_buffer_write(audio_ring_buffer, frame_data, n_frames);

    if (session->debug) {
        fprintf(stdout,
                "[CapturePw] Captured audio chunk: frames=%u written=%u\n",
                n_frames, written_frames);
    }

    // The ring buffer now overwrites the oldest unread frames to preserve the
    // newest audio. A short write only happens when a single PipeWire chunk is
    // larger than the ring capacity, so we track the discarded prefix here.
    if (written_frames < n_frames && session->running) {
        session->dropped_frames += n_frames - written_frames;
        fprintf(stderr,
                "[CapturePw] Capture chunk exceeded ring capacity, dropped "
                "frames: %" PRIu64 "\n",
                session->dropped_frames); // TODO: Handle dropped frames and
                                          // remove this since printing is bad
                                          // for RTC performance
    }

end:
    pw_stream_queue_buffer(session->stream, b);
}

/**
 * Callback for when the stream parameters change
 */
static void on_stream_param_changed(void *_data, uint32_t id,
                                    const struct spa_pod *param) {
    struct capture_pw_session *session = _data;
    struct ring_buffer *audio_ring_buffer;
    uint32_t buffer_capacity_frames;

    uint32_t sample_rate;
    uint32_t channels;

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

    audio_ring_buffer = capture_pw_ring_buffer(session);
    buffer_capacity_frames = session->audio_context->buffer_capacity_frames;

    // Inits the ring buffer
    if (audio_ring_buffer == NULL) {
        buffer_capacity_frames = sample_rate / 2;
        if (buffer_capacity_frames == 0)
            buffer_capacity_frames = 2048;

        audio_ring_buffer = ring_buffer_init(buffer_capacity_frames,
                                             (size_t)channels * sizeof(float));
        if (audio_ring_buffer == NULL) {
            fprintf(stderr, "[CapturePw] Failed to initialize ring buffer\n");
            return;
        }

        session->audio_context->ring_buffer = audio_ring_buffer;
    }

    // Publish the audio format after the shared ring buffer is ready.
    pthread_mutex_lock(&session->audio_context->format_mutex);
    session->audio_context->sample_rate = sample_rate;
    session->audio_context->channels = channels;
    session->audio_context->buffer_capacity_frames = buffer_capacity_frames;
    session->audio_context->format_ready = 1;
    pthread_cond_broadcast(&session->audio_context->format_cond);
    pthread_mutex_unlock(&session->audio_context->format_mutex);

    fprintf(stdout,
            "[CapturePw] desktop playback format: rate=%u channels=%u\n",
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
    struct ring_buffer *audio_ring_buffer;

    (void)signal_number;
    session->running = 0;
    audio_ring_buffer = capture_pw_ring_buffer(session);
    ring_buffer_close(audio_ring_buffer);
    pw_main_loop_quit(session->loop);
}

/**
 * Runs the capture session
 */
int capture_pw_run(struct capture_pw_session *session) {
    const struct spa_pod *params[1];
    uint8_t buffer[1024];
    struct spa_pod_builder builder =
        SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
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
                          PW_STREAM_FLAG_AUTOCONNECT |
                              PW_STREAM_FLAG_MAP_BUFFERS,
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
    ring_buffer_close(capture_pw_ring_buffer(session));

    if (session->stream != NULL)
        pw_stream_destroy(session->stream);
    if (session->loop != NULL)
        pw_main_loop_destroy(session->loop);

    pw_deinit();
    free(session);
}

/**
 * Main function to start the capture session
 *  - Initializes the session structure
 *  - Runs the capture session
 *  - Destroys the session after it finishes
 */
int capture_pw_main(void *userdata) {
    int ret = 0;
    struct session_args *args = userdata;
    struct capture_pw_session *session;

    session = calloc(1, sizeof(*session));
    if (session == NULL) {
        perror("[CapturePw] calloc");
        return -1;
    }

    pthread_cleanup_push((void (*)(void *))capture_pw_destroy, session);

    if (args == NULL) {
        ret = -1;
        goto end;
    }

    session->audio_context = &args->audio_context;
    session->debug = (getenv("STRATUSD_CAPTUREPW_DEBUG") != NULL);

    if (capture_pw_run(session) < 0) {
        fprintf(stderr, "[CapturePw] Failed to run capture session\n");
        ret = -1;
        goto end;
    }

end:
    pthread_cleanup_pop(1);
    return ret;
}
