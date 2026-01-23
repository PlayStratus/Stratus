#ifndef ENCODE_H
#define ENCODE_H

#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    AVCodecContext *codec_ctx;
    struct SwsContext *sws_ctx;
    AVFrame *argb_frame;
    AVFrame *yuv_frame;
    AVPacket *pkt;
    FILE *output_file;
    int frame_count;
    int width;
    int height;
} encoder_context;

int test_encode();
encoder_context* encoder_startup(/*const char *output_file, */int width, int height);
int encode_video_frame(encoder_context *state, const uint8_t *argb_buffer);
int encoder_teardown(encoder_context *state);


#endif
