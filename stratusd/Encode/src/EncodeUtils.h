#ifndef ENCODEUTILS_H
#define ENCODEUTILS_H

#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <stdio.h>
#include <stdlib.h>
#include "Encode.h"
#include "EncodePrivate.h"

void generate_argb_frame(uint8_t *buffer, int width, int height, int frame_num);
int avcodec_send_and_receive(encoder_context *state, int flush);
void encode_free_frame(void *frame);

#endif

