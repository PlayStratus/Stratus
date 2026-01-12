#include "Encode.h"
#include "EncodeUtils.h"

const char *output_file = "encode_output.h264";

int test_encode(){
    int width = 640;
    int height = 480;
    int num_frames = 120;

    encoder_context *encoder = encoder_startup(/*"output.h264", */width, height);
    if (!encoder) {
        return 1;
    }

    uint8_t *frame_buffer = malloc(width * height * 4);
    if (!frame_buffer) {
        encoder_teardown(encoder);
        return 1;
    }

    for (int i = 0; i < num_frames; i++) {
        generate_argb_frame(frame_buffer, width, height, i);
        if (encode_video_frame(encoder, frame_buffer) < 0) {
            fprintf(stderr, "Failed to encode frame %d\n", i);
            break;
        }
    }

    free(frame_buffer);
    encoder_teardown(encoder);

    printf("\nDone! Play with: ffplay output.h264\n");
    return 0;
}

void cleanup_encoder(encoder_context *state) {
    if (!state) return;
    if (state->pkt) av_packet_free(&state->pkt);
    if (state->sws_ctx) sws_freeContext(state->sws_ctx);
    if (state->yuv_frame) {
        if (state->yuv_frame->data[0]) av_freep(&state->yuv_frame->data[0]);
        av_frame_free(&state->yuv_frame);
    }
    if (state->argb_frame) {
        if (state->argb_frame->data[0]) av_freep(&state->argb_frame->data[0]);
        av_frame_free(&state->argb_frame);
    }
    if (state->output_file) fclose(state->output_file);
    if (state->codec_ctx) avcodec_free_context(&state->codec_ctx);
    free(state);
}

encoder_context* encoder_startup(/*const char *output_file, */int width, int height) {
    encoder_context *state = calloc(1, sizeof(encoder_context));
    if (!state) {
        fprintf(stderr, "Failed to allocate encoder context\n");
        return NULL;
    }

    state->width = width;
    state->height = height;
    state->frame_count = 0;

    const AVCodec *codec = avcodec_find_encoder(AV_CODEC_ID_H264);
    if (!codec) {
        fprintf(stderr, "H.264 codec not found\n");
        free(state);
        return NULL;
    }

    state->codec_ctx = avcodec_alloc_context3(codec);
    if (!state->codec_ctx) {
        fprintf(stderr, "Could not allocate codec context\n");
        free(state);
        return NULL;
    }

    // Configure encoder
    state->codec_ctx->bit_rate = 2000000;  // 2 Mbps
    state->codec_ctx->width = width;
    state->codec_ctx->height = height;
    state->codec_ctx->time_base = (AVRational){1, 30}; // 30 fps
    state->codec_ctx->framerate = (AVRational){30, 1};
    state->codec_ctx->gop_size = 30;
    state->codec_ctx->max_b_frames = 0;
    state->codec_ctx->pix_fmt = AV_PIX_FMT_YUV420P;

    // H.264 specific options
    av_opt_set(state->codec_ctx->priv_data, "preset", "ultrafast", 0);
    av_opt_set(state->codec_ctx->priv_data, "tune", "zerolatency", 0);

    if (avcodec_open2(state->codec_ctx, codec, NULL) < 0) {
        fprintf(stderr, "Could not open codec\n");
        cleanup_encoder(state);
        return NULL;
    }

    state->output_file = fopen(output_file, "wb");
    if (!state->output_file) {
        fprintf(stderr, "Could not open output file %s\n", output_file);
        cleanup_encoder(state);
        return NULL;
    }

    // Allocate ARGB frame
    state->argb_frame = av_frame_alloc();
    if (!state->argb_frame) {
        fprintf(stderr, "Could not allocate ARGB frame\n");
        cleanup_encoder(state);
        return NULL;
    }
    state->argb_frame->format = AV_PIX_FMT_ARGB;
    state->argb_frame->width = width;
    state->argb_frame->height = height;
    if (av_image_alloc(state->argb_frame->data, state->argb_frame->linesize,
                       width, height, AV_PIX_FMT_ARGB, 32) < 0) {
        fprintf(stderr, "Could not allocate ARGB frame buffer\n");
        cleanup_encoder(state);
        return NULL;
    }

    // Allocate YUV frame
    state->yuv_frame = av_frame_alloc();
    if (!state->yuv_frame) {
        fprintf(stderr, "Could not allocate YUV frame\n");
        cleanup_encoder(state);
        return NULL;
    }
    state->yuv_frame->format = state->codec_ctx->pix_fmt;
    state->yuv_frame->width = width;
    state->yuv_frame->height = height;
    if (av_image_alloc(state->yuv_frame->data, state->yuv_frame->linesize,
                       width, height, state->codec_ctx->pix_fmt, 32) < 0) {
        fprintf(stderr, "Could not allocate YUV frame buffer\n");
        cleanup_encoder(state);
        return NULL;
    }

    // Initialize swscale context
    state->sws_ctx = sws_getContext(width, height, AV_PIX_FMT_ARGB,
                                    width, height, AV_PIX_FMT_YUV420P,
                                    SWS_BILINEAR, NULL, NULL, NULL);
    if (!state->sws_ctx) {
        fprintf(stderr, "Could not initialize swscale context\n");
        cleanup_encoder(state);
        return NULL;
    }

    // Allocate packet
    state->pkt = av_packet_alloc();
    if (!state->pkt) {
        fprintf(stderr, "Could not allocate packet\n");
        cleanup_encoder(state);
        return NULL;
    }

    printf("Encoder initialized: %dx%d\n", width, height);
    return state;
}

int encode_video_frame(encoder_context *state, const uint8_t *argb_buffer) {
    if (!state || !argb_buffer) {
        return -1;
    }

    // Copy ARGB data into frame
    for (int y = 0; y < state->height; y++) {
        memcpy(state->argb_frame->data[0] + y * state->argb_frame->linesize[0],
               argb_buffer + y * state->width * 4,
               state->width * 4);
    }

    // Convert ARGB to YUV420P
    sws_scale(state->sws_ctx,
              (const uint8_t * const*)state->argb_frame->data,
              state->argb_frame->linesize,
              0, state->height,
              state->yuv_frame->data,
              state->yuv_frame->linesize);

    state->yuv_frame->pts = state->frame_count;

    // Send frame to encoder
    int ret = avcodec_send_frame(state->codec_ctx, state->yuv_frame);
    if (ret < 0) {
        fprintf(stderr, "Error sending frame to encoder\n");
        return ret;
    }

    // Receive encoded packets
    while (ret >= 0) {
        ret = avcodec_receive_packet(state->codec_ctx, state->pkt);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        } else if (ret < 0) {
            fprintf(stderr, "Error encoding frame\n");
            return ret;
        }

        // Write Annex B start code
        uint8_t start_code[4] = {0x00, 0x00, 0x00, 0x01};
        fwrite(start_code, 1, 4, state->output_file);

        // Write packet data
        fwrite(state->pkt->data, 1, state->pkt->size, state->output_file);

        printf("Encoded frame %3d (size=%5d)\n", state->frame_count, state->pkt->size);

        av_packet_unref(state->pkt);
    }

    state->frame_count++;
    return 0;
}

int encoder_teardown(encoder_context *state) {
    if (!state) {
        return -1;
    }

    // Flush encoder (send NULL frame)
    int ret = avcodec_send_frame(state->codec_ctx, NULL);
    if (ret < 0) {
        fprintf(stderr, "Error flushing encoder\n");
    }

    // Receive remaining packets
    while (ret >= 0) {
        ret = avcodec_receive_packet(state->codec_ctx, state->pkt);
        if (ret == AVERROR_EOF) {
            break;
        } else if (ret < 0) {
            fprintf(stderr, "Error during flush\n");
            break;
        }

        // Write Annex B start code
        uint8_t start_code[4] = {0x00, 0x00, 0x00, 0x01};
        fwrite(start_code, 1, 4, state->output_file);
        fwrite(state->pkt->data, 1, state->pkt->size, state->output_file);

        printf("Flushed packet (size=%5d)\n", state->pkt->size);
        av_packet_unref(state->pkt);
    }

    // Cleanup
    printf("Encoded %d frames total\n", state->frame_count);

    av_packet_free(&state->pkt);
    sws_freeContext(state->sws_ctx);
    av_freep(&state->yuv_frame->data[0]);
    av_frame_free(&state->yuv_frame);
    av_freep(&state->argb_frame->data[0]);
    av_frame_free(&state->argb_frame);
    avcodec_free_context(&state->codec_ctx);
    fclose(state->output_file);
    free(state);

    return 0;
}

void encode_argb_video(const char *input_file, const char *output_file,
                       int width, int height, int num_frames)
{
    const AVCodec *codec;
    AVCodecContext *c = NULL;
    FILE *f_in, *f_out;
    AVFrame *argb_frame, *yuv_frame;
    int ret, got_output;
    struct SwsContext *sws_ctx = NULL;

    // Allocate buffers for ARGB input
    int argb_frame_size = width * height * 4;
    uint8_t *argb_buffer = malloc(argb_frame_size);

    printf("Encoding ARGB video %dx%d, %d frames\n", width, height, num_frames);

    // Find H264 encoder
    codec = avcodec_find_encoder(AV_CODEC_ID_H264);
    if (!codec) {
        fprintf(stderr, "H264 codec not found\n");
        exit(1);
    }

    // Allocate codec context
    c = avcodec_alloc_context3(codec);
    if (!c) {
        fprintf(stderr, "Could not allocate codec context\n");
        exit(1);
    }

    c->bit_rate = 2000000;  // 2 Mbps
    c->width = width;
    c->height = height;
    c->time_base = (AVRational){1, 24};  // 30 fps
    c->framerate = (AVRational){24, 1};
    c->gop_size = 30;
    c->max_b_frames = 0;
    c->pix_fmt = AV_PIX_FMT_YUV420P;

    // Set H264-specific options
    av_opt_set(c->priv_data, "preset", "ultrafast", 0);
    av_opt_set(c->priv_data, "tune", "zerolatency", 0);

    if (avcodec_open2(c, codec, NULL) < 0) {
        fprintf(stderr, "Could not open codec\n");
        exit(1);
    }

    f_in = fopen(input_file, "rb");
    if (!f_in) {
        fprintf(stderr, "Could not open input file %s\n", input_file);
        exit(1);
    }

    f_out = fopen(output_file, "wb");
    if (!f_out) {
        fprintf(stderr, "Could not open output file %s\n", output_file);
        exit(1);
    }

    // Allocate ARGB frame structure
    argb_frame = av_frame_alloc();
    if (!argb_frame) {
        fprintf(stderr, "Could not allocate ARGB frame\n");
        exit(1);
    }
    argb_frame->format = AV_PIX_FMT_ARGB;
    argb_frame->width = width;
    argb_frame->height = height;
    ret = av_image_alloc(argb_frame->data, argb_frame->linesize,
                         width, height, AV_PIX_FMT_ARGB, 32);
    if (ret < 0) {
        fprintf(stderr, "Could not allocate ARGB frame buffer\n");
        exit(1);
    }

    // Allocate YUV frame
    yuv_frame = av_frame_alloc();
    if (!yuv_frame) {
        fprintf(stderr, "Could not allocate YUV frame\n");
        exit(1);
    }
    yuv_frame->format = c->pix_fmt;
    yuv_frame->width = c->width;
    yuv_frame->height = c->height;
    ret = av_image_alloc(yuv_frame->data, yuv_frame->linesize,
                         c->width, c->height, c->pix_fmt, 32);
    if (ret < 0) {
        fprintf(stderr, "Could not allocate YUV frame buffer\n");
        exit(1);
    }

    // Initialize swscale for YUV420P conversion
    sws_ctx = sws_getContext(width, height, AV_PIX_FMT_ARGB,
                             width, height, AV_PIX_FMT_YUV420P,
                             SWS_BILINEAR, NULL, NULL, NULL);
    if (!sws_ctx) {
        fprintf(stderr, "Could not initialize swscale context\n");
        exit(1);
    }

    AVPacket *pkt = av_packet_alloc();

    // Encode frames
    for (int i = 0; i < num_frames; i++) {

        size_t bytes_read = fread(argb_buffer, 1, argb_frame_size, f_in);
        if (bytes_read != argb_frame_size) {
            fprintf(stderr, "Could not read full frame %d\n", i);
            break;
        }

        // Copy ARGB data into frame structure
        for (int y = 0; y < height; y++) {
            memcpy(argb_frame->data[0] + y * argb_frame->linesize[0],
                   argb_buffer + y * width * 4,
                   width * 4);
        }

        // Convert ARGB to YUV420P
        sws_scale(sws_ctx,
                  (const uint8_t * const*)argb_frame->data,
                  argb_frame->linesize,
                  0, height,
                  yuv_frame->data,
                  yuv_frame->linesize);

        yuv_frame->pts = i;

        // Encode the YUV frame
        ret = avcodec_send_frame(c, yuv_frame);
        if (ret < 0) {
            fprintf(stderr, "Error sending frame %d to encoder\n", i);
            exit(1);
        }

        // Receive encoded packets
        while (ret >= 0) {
            ret = avcodec_receive_packet(c, pkt);
            if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
                break;
            } else if (ret < 0) {
                fprintf(stderr, "Error encoding frame\n");
                exit(1);
            }

            printf("Encoded frame %3d (size=%5d)\n", i, pkt->size);
            fwrite(pkt->data, 1, pkt->size, f_out);
            av_packet_unref(pkt);
        }
    }
   // Flush encoder (send NULL frame to signal end of stream)
    ret = avcodec_send_frame(c, NULL);
    if (ret < 0) {
        fprintf(stderr, "Error flushing encoder\n");
        exit(1);
    }

    // Receive remaining packets
    while (ret >= 0) {
        ret = avcodec_receive_packet(c, pkt);
        if (ret == AVERROR_EOF) {
            break;  // All done
        } else if (ret < 0) {
            fprintf(stderr, "Error during final flush\n");
            exit(1);
        }

        printf("Flushed packet (size=%5d)\n", pkt->size);
        fwrite(pkt->data, 1, pkt->size, f_out);
        av_packet_unref(pkt);
    }

    // Cleanup
    fclose(f_in);
    fclose(f_out);

    av_packet_free(&pkt);
    sws_freeContext(sws_ctx);

    avcodec_free_context(&c);

    av_freep(&argb_frame->data[0]);
    av_frame_free(&argb_frame);

    av_freep(&yuv_frame->data[0]);
    av_frame_free(&yuv_frame);

    free(argb_buffer);
}

