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

/*
 * Used to represent the action taken by the Encoder with respect to a frame
 */
enum frame_status {
    FRAME_ENCODED = 0,
    FRAME_DROPPED_PRE_CONNECT, // Dropped because client hadn't connected yet
    FRAME_DROPPED_BUF_FULL,    // Dropped because Transport buffer was full

    // Note that we don't keep track of frames dropped by rbuf_wait_peak_latest

    FRAME_STATUS_COUNT
};

typedef struct {
    AVCodecContext *codec_ctx;
    struct SwsContext *shm_sws_ctx;
    struct SwsContext *dma_sws_ctx;
    AVFrame *yuv_frame;
    AVPacket *pkt;
    FILE *output_file;
    int frame_count[FRAME_STATUS_COUNT];
    int width;
    int height;
    struct egl_capture_context *egl_ctx;
    bool debug;
    struct rbuf *input_queue;
    struct rbuf *output_queue;
} encoder_context;

#endif
