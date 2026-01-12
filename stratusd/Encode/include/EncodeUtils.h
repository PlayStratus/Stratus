#ifndef ENCODEUTILS_H
#define ENCODEUTILS_H

#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <stdio.h>
#include <stdlib.h>

void create_sample_video(const char *filename, int width, int height, int num_frames);
void generate_argb_frame(uint8_t *buffer, int width, int height, int frame_num);

#endif

