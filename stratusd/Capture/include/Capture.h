#ifndef CAPTURE_H
#define CAPTURE_H

#include "Encode.h"

struct capture_session; // internal to Capture module

struct capture_session *capture_init(char *encode_output, uint32_t width,
                                     uint32_t height, encoder_context *encoder);

int capture_run(struct capture_session *session);

void capture_destroy(struct capture_session *session);

#endif
