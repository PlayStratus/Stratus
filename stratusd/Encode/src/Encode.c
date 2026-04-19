#include "Encode.h"
#include "EncodePrivate.h"
#include "EncodeUtils.h"

int encode_video_frame(encoder_context *state, const uint8_t *argb_buffer, int stride, int buf_type);

void cleanup_encoder(encoder_context *state) {
    if (!state) return;
    if (state->pkt) av_packet_free(&state->pkt);
    if (state->shm_sws_ctx) sws_freeContext(state->shm_sws_ctx);
    if (state->dma_sws_ctx) sws_freeContext(state->dma_sws_ctx);
    if (state->yuv_frame) {
        if (state->yuv_frame->data[0]) av_freep(&state->yuv_frame->data[0]);
        av_frame_free(&state->yuv_frame);
    }
    if (state->output_file) fclose(state->output_file);
    if (state->codec_ctx) avcodec_free_context(&state->codec_ctx);
    free(state);
}

encoder_context* encoder_startup(struct session_args *args) {
    encoder_context *state = calloc(1, sizeof(encoder_context));
    if (!state) {
        fprintf(stderr, "Failed to allocate encoder context\n");
        return NULL;
    }

    state->debug = (getenv("STRATUSD_ENCODE_DEBUG") != NULL);

    state->width = args->width;
    state->height = args->height;
    state->frame_count = 0;
    state->input_queue = args->video_encode_queue;
    state->output_queue = args->video_transport_queue;
    rbuf_set_free(state->output_queue, &encode_free_frame);

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
    state->codec_ctx->width = state->width;
    state->codec_ctx->height = state->height;
    state->codec_ctx->time_base = (AVRational){1, 30}; // 30 fps
    state->codec_ctx->framerate = (AVRational){30, 1};
    state->codec_ctx->gop_size = 0;
    state->codec_ctx->max_b_frames = 0;
    state->codec_ctx->pix_fmt = AV_PIX_FMT_YUV420P;

    // H.264 specific options
    av_opt_set(state->codec_ctx->priv_data, "preset", "slow", 0);
    av_opt_set(state->codec_ctx->priv_data, "tune", "zerolatency", 0);
    av_opt_set(state->codec_ctx->priv_data, "crf", "0", 0);


    if (avcodec_open2(state->codec_ctx, codec, NULL) < 0) {
        fprintf(stderr, "Could not open codec\n");
        cleanup_encoder(state);
        return NULL;
    }

    state->output_file = fopen(args->encode_output, "wb");
    if (!state->output_file) {
        fprintf(stderr, "Could not open output file %s\n", args->encode_output);
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
    state->yuv_frame->width = args->width;
    state->yuv_frame->height = state->height;
    if (av_image_alloc(state->yuv_frame->data, state->yuv_frame->linesize,
                       state->width, state->height, state->codec_ctx->pix_fmt,
                       32) < 0) {
        fprintf(stderr, "Could not allocate YUV frame buffer\n");
        cleanup_encoder(state);
        return NULL;
    }

    // Initialize shm swscale context
    state->shm_sws_ctx = sws_getContext(state->width, state->height,
                                        AV_PIX_FMT_BGR0, state->width,
                                        state->height, AV_PIX_FMT_YUV420P,
                                        SWS_BILINEAR, NULL, NULL, NULL);
    if (!state->shm_sws_ctx) {
        fprintf(stderr, "Could not initialize shm swscale context\n");
        cleanup_encoder(state);
        return NULL;
    }

    state->dma_sws_ctx = sws_getContext(state->width, state->height,
                                        AV_PIX_FMT_RGBA, state->width,
                                        state->height, AV_PIX_FMT_YUV420P,
                                        SWS_BILINEAR, NULL, NULL, NULL);
    if (!state->dma_sws_ctx) {
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

    state->egl_ctx = egl_capture_init();
    if (state->egl_ctx == NULL) {
        cleanup_encoder(state);
        return NULL;
    }

    printf("[Encode] Encoder initialized: %dx%d\n", state->width, state->height);
    return state;
}

int dma_encode_video_frame(
        encoder_context *state,
        struct dma_buffer *dma_buf,
        int stride) {

    size_t pixel_size = dma_buf->width * dma_buf->height * 4; // RGBA specific
    uint8_t *pixel_data = malloc(pixel_size);

    if (pixel_data == NULL) {
        fprintf(stderr, "Failed to allocate pixel buffer\n");
        return -1;
    }

    if (egl_capture_dmabuf_frame(state->egl_ctx, dma_buf, pixel_data) < 0){
        fprintf(stderr, "Error during egl capture!\n");
        return -1;
    }

    assert(encode_video_frame(state, pixel_data, stride, 1) == 0);

    free(pixel_data);

    return 0;
}

/* buf_type is the type of buffer that backs the underlying wl_buffer capturing the frame
 * 0 -> shm
 * 1 -> dma
 */
int encode_video_frame(encoder_context *state, const uint8_t *argb_buffer,
                       int stride, int buf_type) {

    if (!state || !argb_buffer) {
        return -1;
    }

    struct SwsContext *sws_ctx = NULL;

    switch (buf_type) {
        case 0:
            sws_ctx = state->shm_sws_ctx;
            break;
        case 1:
            sws_ctx = state->dma_sws_ctx;
            break;
        default:
            fprintf(stderr, "Unknown buf_type: %d\n", buf_type);
            return -1;
    }

    // Convert ARGB to YUV420P
    sws_scale(sws_ctx,
              (const uint8_t * const*)&argb_buffer,
              &stride,
              0, state->height,
              state->yuv_frame->data,
              state->yuv_frame->linesize);

    state->yuv_frame->pts = state->frame_count;

    avcodec_send_and_receive(state, 0);

    state->frame_count++;
    return 0;
}


void encoder_teardown(encoder_context *state) {
    assert(state != NULL);

    // Flush encoder (send NULL frame)
    avcodec_send_and_receive(state, 1);

    // Cleanup
    printf("[Encode] Encoded %d frames total\n", state->frame_count);

    av_packet_free(&state->pkt);
    sws_freeContext(state->shm_sws_ctx);
    sws_freeContext(state->dma_sws_ctx);
    av_freep(&state->yuv_frame->data[0]);
    av_frame_free(&state->yuv_frame);
    avcodec_free_context(&state->codec_ctx);

    egl_capture_destroy(state->egl_ctx);

    fclose(state->output_file);
    free(state);
}

/*
 * Run the Encode module
 *
 * Returns 0 on success and -1 on failure.
 */
int encode_main(struct session_args *args) {
    encoder_context *ctx = encoder_startup(args);
    if (ctx == NULL) {
        return -1; // No need to jump to end outside of pthread_cleanup_* macro
    }

    pthread_cleanup_push((void (*)(void*))encoder_teardown, ctx);

    while (1) {
        struct video_encode_queue_frame *frame = rbuf_wait_peak_latest(ctx->input_queue);
        if (frame != NULL) {
            if (frame->shm_data != NULL) {
                assert(encode_video_frame(ctx, frame->shm_data, frame->stride, 0) == 0);
            } else if (frame->dma_data != NULL) {
                assert(dma_encode_video_frame(ctx, frame->dma_data, frame->stride) == 0);
            }
            rbuf_pop(ctx->input_queue);
        }
    }

end:
    pthread_cleanup_pop(1);
    return 0;
}
