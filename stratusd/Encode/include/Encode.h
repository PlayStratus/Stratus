#ifndef ENCODE_H
#define ENCODE_H

#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/avconfig.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <stdio.h>

#include "EGLUtils.h"
#include "SideCar.h"

typedef struct {
    AVCodecContext *codec_ctx;
    struct SwsContext *shm_sws_ctx;
    struct SwsContext *dma_sws_ctx;
    AVFrame *yuv_frame;
    AVPacket *pkt;
    FILE *output_file;
    int frame_count;
    int width;
    int height;
    struct egl_capture_context *egl_ctx;
    bool debug;
} encoder_context;

encoder_context* encoder_startup(struct session_args *args);
int dma_encode_video_frame(
        encoder_context *state,
        struct dma_buffer *dma_buf,
        int stride);
int encode_video_frame(encoder_context *state, const uint8_t *argb_buffer, int stride, int buf_type);
int encoder_teardown(encoder_context *state);


#endif
