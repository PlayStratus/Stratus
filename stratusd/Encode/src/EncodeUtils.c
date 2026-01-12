#include "EncodeUtils.h"

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

