#include "CapturePw.h"

#include <pipewire/pipewire.h>
#include <spa/param/audio/format-utils.h>

#include <inttypes.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

struct capture_pw_session {
    struct pw_main_loop *loop;
    struct pw_stream *stream;

    struct spa_audio_info format;
    uint64_t buffer_count;
};

/* our data processing function is in general:
 *
 *  struct pw_buffer *b;
 *  b = pw_stream_dequeue_buffer(stream);
 *
 *  .. consume stuff in the buffer ...
 *
 *  pw_stream_queue_buffer(stream, b);
 */
static void on_process(void *userdata)
{
    struct capture_pw_session *session = userdata;
    struct pw_buffer *b;
    struct spa_buffer *buf;
    float *samples;

    float level;
    float sample;
    uint32_t n_samples;
    uint32_t n_channels;
    uint32_t n_frames;

    uint32_t i;

    if ((b = pw_stream_dequeue_buffer(session->stream)) == NULL) {
        pw_log_warn("out of buffers: %m");
        return;
    }

    buf = b->buffer;
    if (buf->datas[0].data == NULL || buf->datas[0].chunk == NULL) {
        pw_stream_queue_buffer(session->stream, b);
        return;
    }

    samples = buf->datas[0].data;
    n_channels = session->format.info.raw.channels;
    if (n_channels == 0) {
        pw_stream_queue_buffer(session->stream, b);
        return;
    }

    n_samples = buf->datas[0].chunk->size / sizeof(float);
    n_frames = n_samples / n_channels;
    level = 0.0f;
    for (i = 0; i < n_samples; i++) {
        sample = samples[i];
        if (sample < 0.0f)
            sample = -sample;
        if (sample > level)
            level = sample;
    }

    session->buffer_count++;


    if (level > 0.0f) {
        fprintf(stdout,
                "[CapturePw] desktop audio buffer %" PRIu64 ": %u frames, %u channels, level=%.3f\n",
                session->buffer_count, n_frames, n_channels, level);
        fflush(stdout);
    }

    pw_stream_queue_buffer(session->stream, b);
}
 
/* Be notified when the stream param changes. We're only looking at the
 * format changes.
 */
static void
on_stream_param_changed(void *_data, uint32_t id, const struct spa_pod *param)
{
    struct capture_pw_session *session = _data;

    /* NULL means to clear the format */
    if (param == NULL || id != SPA_PARAM_Format)
            return;

    if (spa_format_parse(param, &session->format.media_type, &session->format.media_subtype) < 0)
            return;

    /* only accept raw audio */
    if (session->format.media_type != SPA_MEDIA_TYPE_audio ||
        session->format.media_subtype != SPA_MEDIA_SUBTYPE_raw)
            return;

    /* call a helper function to parse the format for us. */
    spa_format_audio_raw_parse(param, &session->format.info.raw);

    fprintf(stdout, "[CapturePw] desktop playback format: rate=%u channels=%u\n",
                    session->format.info.raw.rate, session->format.info.raw.channels);
 
}

static const struct pw_stream_events stream_events = {
        PW_VERSION_STREAM_EVENTS,
        .param_changed = on_stream_param_changed,
        .process = on_process,
};

static void do_quit(void *userdata, int signal_number)
{
    struct capture_pw_session *session = userdata;

    fprintf(stdout, "[CapturePw] got signal %d\n", signal_number);
    if (session != NULL && session->loop != NULL)
        pw_main_loop_quit(session->loop);
}
 
struct capture_pw_session *capture_pw_init(void)
{
    struct capture_pw_session *session;

    session = calloc(1, sizeof(*session));
    if (session == NULL) {
        perror("[CapturePw] calloc");
        return NULL;
    }

    return session;
}

int capture_pw_run(struct capture_pw_session *session)
{
    const struct spa_pod *params[1];
    uint8_t buffer[1024];
    struct spa_pod_builder builder =
        SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
    struct pw_properties *props;

    if (session == NULL)
        return -1;

    pw_init(NULL, NULL);

    /* make a main loop. If you already have another main loop, you can add
     * the fd of this pipewire mainloop to it. */
    session->loop = pw_main_loop_new(NULL);
    if (session->loop == NULL)
        return -1;

    pw_loop_add_signal(pw_main_loop_get_loop(session->loop), SIGINT, do_quit, session);
    pw_loop_add_signal(pw_main_loop_get_loop(session->loop), SIGTERM, do_quit, session);

    /* Create a simple stream, the simple stream manages the core and remote
     * objects for you if you don't need to deal with them.
     *
     * If you plan to autoconnect your stream, you need to provide at least
     * media, category and role properties.
     *
     * Pass your events and a user_data pointer as the last arguments. This
     * will inform you about the stream state. The most important event
     * you need to listen to is the process event where you need to produce
     * the data.
     */
    props = pw_properties_new(
        PW_KEY_MEDIA_TYPE, "Audio",
        PW_KEY_MEDIA_CATEGORY, "Capture",
        PW_KEY_STREAM_CAPTURE_SINK, "true",
        NULL);
    if (props == NULL)
        return -1;

    session->stream = pw_stream_new_simple(
        pw_main_loop_get_loop(session->loop),
        "audio-capture",
        props,
        &stream_events,
        session);
    if (session->stream == NULL)
        return -1;

    /* Make one parameter with the supported formats. The SPA_PARAM_EnumFormat
     * id means that this is a format enumeration (of 1 value).
     * We leave the channels and rate empty to accept the native graph
     * rate and channels. */
    params[0] = spa_format_audio_raw_build(
        &builder,
        SPA_PARAM_EnumFormat,
        &SPA_AUDIO_INFO_RAW_INIT(
            .format = SPA_AUDIO_FORMAT_F32));

    if (pw_stream_connect(session->stream,
                          PW_DIRECTION_INPUT,
                          PW_ID_ANY,
                          PW_STREAM_FLAG_AUTOCONNECT |
                          PW_STREAM_FLAG_MAP_BUFFERS |
                          PW_STREAM_FLAG_RT_PROCESS,
                          params, 1) < 0) {
        return -1;
    }

    pw_main_loop_run(session->loop);
    return 0;
}

void capture_pw_destroy(struct capture_pw_session *session)
{
    if (session == NULL)
        return;

    if (session->stream != NULL)
        pw_stream_destroy(session->stream);
    if (session->loop != NULL)
        pw_main_loop_destroy(session->loop);

    pw_deinit();
    free(session);
}
