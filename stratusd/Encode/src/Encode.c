#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <stdio.h>
#include <stdlib.h>

void generate_argb_frame(uint8_t *buffer, int width, int height, int frame_num) {
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int offset = (y * width + x) * 4;

            // ARGB8888 format: [A][R][G][B]
            buffer[offset + 0] = 255;
            buffer[offset + 1] = (x + frame_num) % 256;
            buffer[offset + 2] = (y + frame_num) % 256;
            buffer[offset + 3] = (x + y + frame_num) % 256;
        }
    }
}

void create_sample_video(const char *filename, int width, int height, int num_frames) {
    FILE *f = fopen(filename, "wb");
    if (!f) {
        fprintf(stderr, "Cannot open file\n");
        return;
    }

    int frame_size = width * height * 4;  // 4 bytes per pixel
    uint8_t *frame = malloc(frame_size);

    for (int i = 0; i < num_frames; i++) {
        generate_argb_frame(frame, width, height, i);
        fwrite(frame, 1, frame_size, f);
    }

    free(frame);
    fclose(f);
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

    free(argb_buffer);}

