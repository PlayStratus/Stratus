#ifndef ENCODE_PRIVATE_H
#define ENCODE_PRIVATE_H

#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/avconfig.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <stdio.h>

#include "EGLUtils.h"
#include "rbuf2.h"

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
    struct rbuf *input_queue;
} encoder_context;

#endif
