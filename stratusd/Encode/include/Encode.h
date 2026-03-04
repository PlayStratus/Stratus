#ifndef ENCODE_H
#define ENCODE_H

#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/avconfig.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <stdio.h>

#include "EGLUtils.h"

typedef struct {
    AVCodecContext *codec_ctx;
    struct SwsContext *sws_ctx;
    AVFrame *yuv_frame;
    AVPacket *pkt;
    FILE *output_file;
    int frame_count;
    int width;
    int height;
} encoder_context;

int test_encode();
encoder_context* encoder_startup(/*const char *output_file, */int width, int height, enum AVPixelFormat input_pix_fmt);
int dma_encode_video_frame(
        encoder_context *state,
        struct egl_capture_context *egl_capture,
        struct wl_dma_buffer *dma_buf,
        int stride);
int encode_video_frame(encoder_context *state, const uint8_t *argb_buffer, int stride);
int encoder_teardown(encoder_context *state);


#endif
