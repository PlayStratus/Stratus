#define _GNU_SOURCE

#include <assert.h>
#include <stdbool.h>
#include <sys/mman.h>
#include <unistd.h>


#include "dma-buffers-pub.h"
#include "dma-buffers-priv.h"
#include "EGLUtils.h"

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
    struct wl_dma_buffer *dma_buf;
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

    dma_buf = calloc(1, sizeof(struct wl_dma_buffer));
    if (dma_buf == NULL) {
        free(wl_buf);
        return PROXY_ACTION_ERR;
    }

    wl_buf->id = buffer_id;
    wl_buf->width = width;
    wl_buf->height = height;
    wl_buf->shm_buf = NULL;
    wl_buf->dma_buf = dma_buf;
    wl_buf->dependents = 0;

    dma_buf->width = width;
    dma_buf->height = height;
    dma_buf->format = format;
    dma_buf->modifier = params->modifier;
    dma_buf->num_planes = params->num_planes;

    for (int i = 0; i < params->num_planes; i++) {
        dma_buf->planes[i].fd = params->planes[i].fd;
        dma_buf->planes[i].offset = params->planes[i].offset;
        dma_buf->planes[i].stride = params->planes[i].stride;
    }

    // mark fds as transferred
    for (int i = 0; i < 4; i++) {
        params->planes[i].fd = -1;
    }

    assert(wl_map_lookup(map, wl_buf->id) == NULL);
    if (wl_map_insert_at(map, 0, wl_buf->id, wl_buf) < 0) {
        free(dma_buf);
        free(wl_buf);
        return PROXY_ACTION_ERR;
    }

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
void wl_dma_buffer_free(struct wl_dma_buffer *buf) {
    assert(buf != NULL);

    for (int i = 0; i < buf->num_planes; i++) {
        if (buf->planes[i].fd >= 0) {
            close(buf->planes[i].fd);
        }
    }

    free(buf);
}




/*
 * Handle a wl_surface@commit request when the attached buffer is dmabuf-backed
 *
 * Import dmabuf via EGL and pass to encoder.
 */
enum proxy_actions wl_dmabuf_surface_commit(struct capture_data *data,
                                            struct wl_surface *surf) {
    struct wl_buffer *wl_buf;
    struct wl_dma_buffer *dma_buf;
    uint8_t *pixel_data = NULL;

    wl_buf = surf->buf;
    assert(wl_buf != NULL);
    dma_buf = wl_buf->dma_buf;
    assert(dma_buf != NULL);


    // Initialize encoder if not already done
    if (data->encoder == NULL) {
        data->encoder = encoder_startup(wl_buf->width, wl_buf->height, AV_PIX_FMT_BGR0, AV_PIX_FMT_ARGB);
        if (data->encoder == NULL)
            return PROXY_ACTION_ERR;
    }
    // `
    // Initialize EGL capture context if not already done
    if (data->encoder->egl_ctx == NULL) {
        data->encoder->egl_ctx = egl_capture_init();
        if (data->egl_capture == NULL)
            return PROXY_ACTION_ERR;
    }

    int stride = dma_buf->width * 4;
    if (dma_encode_video_frame(data->encoder, dma_buf, stride) < 0)
        return PROXY_ACTION_ERR;

    return PROXY_ACTION_FWD;
}

/*
 * The Wayland message handlers for dma-backed wl_buffers
 */
const struct message_handler dma_buffers_message_handlers[] = {
    { "zwp_linux_dmabuf_v1",        "create_params", &zwp_linux_dmabuf_create_params   },

    { "zwp_linux_buffer_params_v1", "add",           &zwp_linux_buffer_params_add      },
    { "zwp_linux_buffer_params_v1", "create_immed",  &zwp_linux_buffer_params_create_immed },
    { "zwp_linux_buffer_params_v1", "destroy",       &zwp_linux_buffer_params_destroy  },

    { NULL,                         NULL,            NULL                              },
};
