#define _GNU_SOURCE

#include <assert.h>
#include <stdbool.h>
#include <sys/mman.h>
#include <unistd.h>

#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <GLES2/gl2.h>
#include <GLES2/gl2ext.h>
#include <drm_fourcc.h>

#include "dmabuf-buffers-pub.h"
#include "dmabuf-buffers-priv.h"

// Add function declarations for EGL extensions
static PFNEGLCREATEIMAGEKHRPROC eglCreateImageKHR = NULL;
static PFNEGLDESTROYIMAGEKHRPROC eglDestroyImageKHR = NULL;
static PFNGLEGLIMAGETARGETTEXTURE2DOESPROC glEGLImageTargetTexture2DOES = NULL;

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
struct wl_dmabuf_buffer {
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

/*
 * Handle a zwp_linux_dmabuf_v1@create_params request
 *
 * Client creates a params object to build a dmabuf buffer.
 * Allocates and tracks the params object.
 */
enum proxy_actions zwp_linux_dmabuf_create_params(struct proxy_message *msg){
    struct wl_map *map;
    struct zwp_linux_buffer_params *params;

    params = malloc(sizeof(struct zwp_linux_buffer_params));
    if (params == NULL)
        return PROXY_ACTION_ERR;

    params->id = msg->closure->args[0].n;
    params->num_planes = 0;
    params->modifier = 0;

    // initialize plane fds to -1 (invalid)
    for (int i = 0; i < 4; i++) {
        params->planes[i].fd = -1;
        params->planes[i].offset = 0;
        params->planes[i].stride = 0;
    }

    map = msg->conn->session->obj_data;
    assert(wl_map_lookup(map, params->id) == NULL);
    if (wl_map_insert_at(map, 0, params->id, params) < 0) {
        free(params);
        return PROXY_ACTION_ERR;
    }

    return PROXY_ACTION_FWD;

}


/*
 * Handle a zwp_linux_buffer_params_v1@add request
 *
 * Client adds a plane to the buffer. This is called once per plane
 */
enum proxy_actions zwp_linux_buffer_params_add(struct proxy_message *msg) {
    struct wl_map *map;
    struct zwp_linux_buffer_params *params;
    uint32_t plane_idx;
    int fd;
    uint32_t offset, stride, modifier_hi, modifier_lo;

    fd = msg->closure->args[0].h;
    plane_idx = msg->closure->args[1].u;
    offset = msg->closure->args[2].u;
    stride = msg->closure->args[3].u;
    modifier_hi = msg->closure->args[4].u;
    modifier_lo = msg->closure->args[5].u;

    map = msg->conn->session->obj_data;
    params = wl_map_lookup(map, msg->closure->sender_id);
    assert(params != NULL);
    assert(plane_idx < 4);

    params->planes[plane_idx].fd = dup(fd); // needs dup() since fd expires after message
    if (params->planes[plane_idx].fd < 0)
        return PROXY_ACTION_ERR;

    params->planes[plane_idx].offset = offset;
    params->planes[plane_idx].stride = stride;
    params->num_planes++;

    params->modifier = ((uint64_t)modifier_hi << 32) | modifier_lo;

    return PROXY_ACTION_FWD;
}

/*
 * Handle a zwp_linux_buffer_params_v1@create_immed request
 *
 * Client creates a wl_buffer immediately from the params.
 * This is the most common path (vs the async @create).
 *
 * Create a wl_buffer and attach the dmabuf data to it.
 */
enum proxy_actions zwp_linux_buffer_params_create_immed(struct proxy_message *msg) {
    struct wl_map *map;
    struct zwp_linux_buffer_params *params;
    struct wl_buffer *wl_buf;
    struct wl_dmabuf_buffer *dmabuf_buf;
    uint32_t buffer_id;
    int32_t width, height;
    uint32_t format, flags;

    buffer_id = msg->closure->args[0].n;
    width = msg->closure->args[1].i;
    height = msg->closure->args[2].i;
    format = msg->closure->args[3].u;
    flags = msg->closure->args[4].u;

    map = msg->conn->session->obj_data;
    params = wl_map_lookup(map, msg->closure->sender_id);
    assert(params != NULL);

    wl_buf = malloc(sizeof(struct wl_buffer));
    if (wl_buf == NULL)
        return PROXY_ACTION_ERR;

    dmabuf_buf = calloc(1, sizeof(struct wl_dmabuf_buffer));
    if (dmabuf_buf == NULL) {
        free(wl_buf);
        return PROXY_ACTION_ERR;
    }

    wl_buf->id = buffer_id;
    wl_buf->width = width;
    wl_buf->height = height;
    wl_buf->shm_buf = NULL;
    wl_buf->dmabuf_buf = dmabuf_buf;
    wl_buf->dependents = 0;

    dmabuf_buf->width = width;
    dmabuf_buf->height = height;
    dmabuf_buf->format = format;
    dmabuf_buf->modifier = params->modifier;
    dmabuf_buf->num_planes = params->num_planes;

    for (int i = 0; i < params->num_planes; i++) {
        dmabuf_buf->planes[i].fd = params->planes[i].fd;
        dmabuf_buf->planes[i].offset = params->planes[i].offset;
        dmabuf_buf->planes[i].stride = params->planes[i].stride;
    }

    // mark fds as transferred
    for (int i = 0; i < 4; i++) {
        params->planes[i].fd = -1;
    }

    // remove dmabuf params from map before inserting dmabuf object
    wl_map_remove(map, params->id);
    params->id = 0;

    assert(wl_map_lookup(map, wl_buf->id) == NULL);
    if (wl_map_insert_at(map, 0, wl_buf->id, wl_buf) < 0) {
        for (int i = 0; i < dmabuf_buf->num_planes; i++) {
            if (dmabuf_buf->planes[i].fd >= 0) {
                close(dmabuf_buf->planes[i].fd);
            }
        }
        free(dmabuf_buf);
        free(wl_buf);
        free(params);
        return PROXY_ACTION_ERR;
    }

    free(params);

    return PROXY_ACTION_FWD;
}

/*
 * Handle a zwp_linux_buffer_params_v1@destroy request
 *
 * Destroy the params object and free resources.
 * Close any fds that haven't been transferred.
 */
enum proxy_actions zwp_linux_buffer_params_destroy(struct proxy_message *msg) {
    uint32_t id;
    struct wl_map *map;
    struct zwp_linux_buffer_params *params;

    id = msg->closure->sender_id;
    map = msg->conn->session->obj_data;
    params = wl_map_lookup(map, id);

    // Params might already be removed if create_immed was called
    if (params == NULL) {
        return PROXY_ACTION_FWD;
    }

    // close fds that weren't transferred
    for (int i = 0; i < 4; i++) {
        if (params->planes[i].fd >= 0) {
            close(params->planes[i].fd);
        }
    }

    wl_map_remove(map, params->id);
    free(params);

    return PROXY_ACTION_FWD;
}

/*
 * Free the resources used by a dmabuf-backed wl_buffer
 *
 * Called when wl_buffer@destroy is received and buffer is not attached.
 */
void wl_dmabuf_buffer_free(struct wl_dmabuf_buffer *buf) {
    assert(buf != NULL);

    for (int i = 0; i < buf->num_planes; i++) {
        if (buf->planes[i].fd >= 0) {
            close(buf->planes[i].fd);
        }
    }

    free(buf);
}



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
                             struct wl_dmabuf_buffer *dmabuf_buf,
                             uint8_t *pixel_data) {
    EGLImageKHR egl_image;
    GLuint texture;

    EGLint img_attribs[128];
    int idx = 0;

    img_attribs[idx++] = EGL_WIDTH;
    img_attribs[idx++] = dmabuf_buf->width;
    img_attribs[idx++] = EGL_HEIGHT;
    img_attribs[idx++] = dmabuf_buf->height;
    img_attribs[idx++] = EGL_LINUX_DRM_FOURCC_EXT;
    img_attribs[idx++] = dmabuf_buf->format;

    // Add attributes for each plane (up to 4)
    for (int i = 0; i < dmabuf_buf->num_planes && i < 4; i++) {
        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_FD_EXT + i * 3;
        img_attribs[idx++] = dmabuf_buf->planes[i].fd;

        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_OFFSET_EXT + i * 3;
        img_attribs[idx++] = dmabuf_buf->planes[i].offset;

        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_PITCH_EXT + i * 3;
        img_attribs[idx++] = dmabuf_buf->planes[i].stride;

        // modifier is shared across planes
        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_MODIFIER_LO_EXT + i * 2;
        img_attribs[idx++] = (EGLint)(dmabuf_buf->modifier & 0xFFFFFFFF);
        img_attribs[idx++] = EGL_DMA_BUF_PLANE0_MODIFIER_HI_EXT + i * 2;
        img_attribs[idx++] = (EGLint)(dmabuf_buf->modifier >> 32);
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
    glReadPixels(0, 0, dmabuf_buf->width, dmabuf_buf->height,
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

/*
 * Handle a wl_surface@commit request when the attached buffer is dmabuf-backed
 *
 * Import dmabuf via EGL and pass to encoder.
 */
enum proxy_actions wl_dmabuf_surface_commit(struct capture_data *data,
                                            struct wl_surface *surf) {
    struct wl_buffer *wl_buf;
    struct wl_dmabuf_buffer *dmabuf_buf;
    uint8_t *pixel_data = NULL;

    wl_buf = surf->buf;
    assert(wl_buf != NULL);
    dmabuf_buf = wl_buf->dmabuf_buf;
    assert(dmabuf_buf != NULL);

    // Initialize EGL capture context if not already done
    if (data->egl_capture == NULL) {

        data->egl_capture = egl_capture_init();
        if (data->egl_capture == NULL)
            return PROXY_ACTION_ERR;
    }

    // Initialize encoder if not already done
    if (data->encoder == NULL) {
        data->encoder = encoder_startup(wl_buf->width, wl_buf->height);
        if (data->encoder == NULL)
            return PROXY_ACTION_ERR;
    }

    // Capture frame from dmabuf
    size_t pixel_size = dmabuf_buf->width * dmabuf_buf->height * 4; // RGBA specific
    pixel_data = malloc(pixel_size);

    if (pixel_data == NULL) {
        fprintf(stderr, "Failed to allocate pixel buffer\n");
        return PROXY_ACTION_ERR;
    }

    if (egl_capture_dmabuf_frame(data->egl_capture, dmabuf_buf, pixel_data) < 0){
        fprintf(stderr, "Error during egl capture!\n");
        return PROXY_ACTION_ERR;
    }

    assert(encode_video_frame(data->encoder, pixel_data, dmabuf_buf->width * 4) == 0);

    free(pixel_data);

    return PROXY_ACTION_FWD;
}

/*
 * The Wayland message handlers for dma-backed wl_buffers
 */
const struct message_handler dmabuf_buffers_message_handlers[] = {
    { "zwp_linux_dmabuf_v1",        "create_params", &zwp_linux_dmabuf_create_params   },

    { "zwp_linux_buffer_params_v1", "add",           &zwp_linux_buffer_params_add      },
    { "zwp_linux_buffer_params_v1", "create_immed",  &zwp_linux_buffer_params_create_immed },
    { "zwp_linux_buffer_params_v1", "destroy",       &zwp_linux_buffer_params_destroy  },

    { NULL,                         NULL,            NULL                              },
};
