#define _GNU_SOURCE


#include "EGLUtils.h"

// Add function declarations for EGL extensions
static PFNEGLCREATEIMAGEKHRPROC eglCreateImageKHR = NULL;
static PFNEGLDESTROYIMAGEKHRPROC eglDestroyImageKHR = NULL;
static PFNGLEGLIMAGETARGETTEXTURE2DOESPROC glEGLImageTargetTexture2DOES = NULL;


/*
 * Initialize EGL context for dmabuf capture
 *
 * Called once at startup or first dmabuf frame
 */
struct egl_capture_context *egl_capture_init(void) {
    // Load egl extensions
    eglCreateImageKHR = (PFNEGLCREATEIMAGEKHRPROC)eglGetProcAddress("eglCreateImageKHR");
    eglDestroyImageKHR = (PFNEGLDESTROYIMAGEKHRPROC)eglGetProcAddress("eglDestroyImageKHR");
    glEGLImageTargetTexture2DOES = (PFNGLEGLIMAGETARGETTEXTURE2DOESPROC)eglGetProcAddress("glEGLImageTargetTexture2DOES");


    struct egl_capture_context *ctx;

    ctx = calloc(1, sizeof(*ctx));
    if (ctx == NULL)
        return NULL;

    // Get EGL display
    ctx->display = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if (ctx->display == EGL_NO_DISPLAY) {
        fprintf(stderr, "Failed to get EGL display\n");
        free(ctx);
        return NULL;
    }

    if (!eglInitialize(ctx->display, NULL, NULL)) {
        fprintf(stderr, "Failed to initialize EGL\n");
        free(ctx);
        return NULL;
    }

    // Choose config
    EGLint config_attribs[] = {
        EGL_SURFACE_TYPE, EGL_PBUFFER_BIT,
        EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT,
        EGL_RED_SIZE, 8,
        EGL_GREEN_SIZE, 8,
        EGL_BLUE_SIZE, 8,
        EGL_ALPHA_SIZE, 8,
        EGL_NONE
    };

    EGLint num_configs;
    if (!eglChooseConfig(ctx->display, config_attribs, &ctx->config, 1, &num_configs)) {
        fprintf(stderr, "Failed to choose EGL config\n");
        eglTerminate(ctx->display);
        free(ctx);
        return NULL;
    }

    // Create context
    EGLint context_attribs[] = {
        EGL_CONTEXT_CLIENT_VERSION, 2,
        EGL_NONE
    };

    ctx->context = eglCreateContext(ctx->display, ctx->config, EGL_NO_CONTEXT, context_attribs);
    if (ctx->context == EGL_NO_CONTEXT) {
        fprintf(stderr, "Failed to create EGL context\n");
        eglTerminate(ctx->display);
        free(ctx);
        return NULL;
    }

    // Make context current
    if (!eglMakeCurrent(ctx->display, EGL_NO_SURFACE, EGL_NO_SURFACE, ctx->context)) {
        fprintf(stderr, "Failed to make EGL context current\n");
        eglDestroyContext(ctx->display, ctx->context);
        eglTerminate(ctx->display);
        free(ctx);
        return NULL;
    }

    // Create FBO
    glGenFramebuffers(1, &ctx->fbo);

    return ctx;
}

/*
 * Capture a frame from a dmabuf using EGL
 * store it in pixel_data
 */
int egl_capture_dmabuf_frame(struct egl_capture_context *ctx,
                             struct dma_buffer *dma_buf,
                             uint8_t *pixel_data) {
    EGLImageKHR egl_image;
    GLuint texture;

    EGLint img_attribs[128];
    int idx = 0;

    img_attribs[idx++] = EGL_WIDTH;
    img_attribs[idx++] = dma_buf->width;
    img_attribs[idx++] = EGL_HEIGHT;
    img_attribs[idx++] = dma_buf->height;
    img_attribs[idx++] = EGL_LINUX_DRM_FOURCC_EXT;
    img_attribs[idx++] = dma_buf->format;

    // Add attributes for each plane (up to 4)
    for (int i = 0; i < dma_buf->num_planes && i < 4; i++) {
        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_FD_EXT + i * 3;
        img_attribs[idx++] = dma_buf->planes[i].fd;

        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_OFFSET_EXT + i * 3;
        img_attribs[idx++] = dma_buf->planes[i].offset;

        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_PITCH_EXT + i * 3;
        img_attribs[idx++] = dma_buf->planes[i].stride;

        // modifier is shared across planes
        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_MODIFIER_LO_EXT + i * 2;
        img_attribs[idx++] = (EGLint)(dma_buf->modifier & 0xFFFFFFFF);
        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_MODIFIER_HI_EXT + i * 2;
        img_attribs[idx++] = (EGLint)(dma_buf->modifier >> 32);
    }

    img_attribs[idx++] = EGL_NONE;

    // Import dmabuf as EGLImage
    egl_image = eglCreateImageKHR(
        ctx->display,
        EGL_NO_CONTEXT,
        EGL_LINUX_DMA_BUF_EXT,
        NULL,
        img_attribs
    );

    if (egl_image == EGL_NO_IMAGE_KHR) {
        fprintf(stderr, "Failed to create EGLImage from dmabuf: %d\n", eglGetError());
        return -1;
    }

    // Create GL texture and bind EGLImage to it
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    glEGLImageTargetTexture2DOES(GL_TEXTURE_2D, egl_image);

    GLenum gl_err = glGetError();
    if (gl_err != GL_NO_ERROR) {
        fprintf(stderr, "OpenGL error binding EGLImage: 0x%x\n", gl_err);
        goto cleanup;
    }

    // Attach texture to framebuffer
    glBindFramebuffer(GL_FRAMEBUFFER, ctx->fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
                           GL_TEXTURE_2D, texture, 0);

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
        fprintf(stderr, "Framebuffer incomplete: 0x%x\n",
                glCheckFramebufferStatus(GL_FRAMEBUFFER));
        goto cleanup;
    }

    // Read pixels from framebuffer
    glReadPixels(0, 0, dma_buf->width, dma_buf->height,
                 GL_RGBA, GL_UNSIGNED_BYTE, pixel_data);

    gl_err = glGetError();
    if (gl_err != GL_NO_ERROR) {
        fprintf(stderr, "glReadPixels error: 0x%x\n", gl_err);
        goto cleanup;
    }

    return 0;


cleanup:
    free(pixel_data);
    glDeleteTextures(1, &texture);
    eglDestroyImageKHR(ctx->display, egl_image);

    return -1;
}

