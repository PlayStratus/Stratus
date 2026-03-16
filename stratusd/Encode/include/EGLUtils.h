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

/*
 * Contains data for a zwp_linux_buffer_params_v1 object
 * This is a temporary object used to build a dmabuf_backed wl_buffer
 */
struct zwp_linux_buffer_params {
    uint32_t id;
    int num_planes;
    struct {
        int fd;
        uint32_t offset;
        uint32_t stride;
    } planes[4];
    uint64_t modifier;
};

/*
 * Contains data for a dmabuf-backed wl_buffer object
 */
struct wl_dma_buffer {
    uint32_t width;
    uint32_t height;
    uint32_t format;
    uint64_t modifier;
    int num_planes;
    struct {
        int fd;
        uint32_t offset;
        uint32_t stride;
    } planes[4];
};

/*
 * Contains metadata for EGL Capture
 */
struct egl_capture_context {
    EGLDisplay display;
    EGLContext context;
    EGLConfig config;
    GLuint fbo;
};

struct egl_capture_context *egl_capture_init(void);
int egl_capture_dmabuf_frame(struct egl_capture_context *ctx,
                             struct wl_dma_buffer *dma_buf,
                             uint8_t *pixel_data);

#endif
