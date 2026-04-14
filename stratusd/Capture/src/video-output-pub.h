#ifndef CAPTURE_VIDEO_OUTPUT_PUB_H
#define CAPTURE_VIDEO_OUTPUT_PUB_H

#include "capture-priv.h"

extern const struct message_handler video_output_message_handlers[];

void free_frame(void *frame);

#endif
