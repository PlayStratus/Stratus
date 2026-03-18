#ifndef CAPTURE_PW_H
#define CAPTURE_PW_H

#include "AudioEncode.h"

struct capture_pw_session; // internal to CapturePw module

struct capture_pw_session *capture_pw_init();

int capture_pw_run(struct capture_pw_session *session);

void capture_pw_destroy(struct capture_pw_session *session);

#endif
