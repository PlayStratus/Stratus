#ifndef EGLUTILS_H
#define EGLUTILS_H

#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <stdbool.h>
#include <sys/mman.h>
#include <unistd.h>

#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <GLES2/gl2.h>
#include <GLES2/gl2ext.h>
#include <drm_fourcc.h>
#include "video-encode-queue.h"

/*
 * Contains metadata for EGL Capture
 */
struct egl_capture_context {
    EGLDisplay display;
    EGLContext context;
    EGLConfig config;
    GLuint fbo;
};

void egl_capture_destroy(struct egl_capture_context *ctx);
struct egl_capture_context *egl_capture_init(void);
int egl_capture_dmabuf_frame(struct egl_capture_context *ctx,
                             struct dma_buffer *dma_buf,
                             uint8_t *pixel_data);

#endif
