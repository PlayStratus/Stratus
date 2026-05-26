#include "EncodeUtils.h"
#include <unistd.h>
#include "video-transport-queue.h"


void generate_argb_frame(uint8_t *buffer, int width, int height, int frame_num) {
    uint8_t r, g, b;

    // 40 red frames, 40 blue frames, 40 green frames
    if (frame_num < 40) {
        r = 255; g = 0; b = 0;  // Red
    } else if (frame_num < 80) {
        r = 0; g = 0; b = 255;  // Blue
    } else {
        r = 0; g = 255; b = 0;  // Green
    }

    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int offset = (y * width + x) * 4;
            buffer[offset + 0] = 255;  // A
            buffer[offset + 1] = r;    // R
            buffer[offset + 2] = g;    // G
            buffer[offset + 3] = b;    // B
        }
    }
}

// set flush to 0 to send the frame in the yuv_frame buffer, or 1 to flush the encoder and receive the remaining packets
int avcodec_send_and_receive(encoder_context *state, int flush) {
    struct video_transport_queue_frame *frame;

    // If flushing the encoder, send a NULL frame, otherwise send the converted YUV frame
    AVFrame *current_frame = flush ? NULL : state->yuv_frame;

    // Send frame to encoder
    int ret = avcodec_send_frame(state->codec_ctx, current_frame);
    if (ret < 0) {
        fprintf(stderr, "Error sending frame to encoder. flush: %d\n", flush);
        return ret;
    }

    // Receive encoded packets
    while (ret >= 0) {
        ret = avcodec_receive_packet(state->codec_ctx, state->pkt);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        } else if (ret < 0) {
            fprintf(stderr, "Error receiving frame from encoder\n");
            return ret;
        }

        // Queue frame to be transported
        frame = malloc(sizeof(struct video_transport_queue_frame));
        if (frame == NULL) {
            perror("[Encode] malloc");
            return -1;
        }
        frame->length = state->pkt->size;
        frame->data = malloc(frame->length);
        if (frame->data == NULL) {
            perror("[Encode] malloc");
            free(frame);
            return -1;
        }
        memcpy(frame->data, state->pkt->data, frame->length);
        frame->is_description = state->pkt->flags && AV_PKT_FLAG_KEY;
        if (rbuf_push(state->output_queue, frame) < 0) {
            free(frame->data);
            free(frame);
            return -1;
        }

        av_packet_unref(state->pkt);
    }

    return 0;
}

/*
 * Free a frame that was pushed to the transport buffer
 */
void encode_free_frame(void *frame) {
    struct video_transport_queue_frame *f = frame;
    free(f->data);
    free(frame);
}
