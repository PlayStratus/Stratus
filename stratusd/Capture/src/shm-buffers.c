/*
 * Logic for capturing video frames from shared host memory wl_buffers
 *
 * Keeps track of wl_shm_pool objects and the shm-specific portion of their
 * child wl_buffers. Only the core buffer pixel formats (argb8888 and
 * xrgb8888) are supported for simplicity.
 */

#include <assert.h>
#include <stdbool.h>
#include <sys/mman.h>

#include "shm-buffers-pub.h"
#include "shm-buffers-priv.h"
#include "video-output-priv.h"

/*
 * Contains data for a wl_shm_pool object
 */
struct wl_shm_pool {
    uint32_t id;
    void *p;
    int32_t size;
    uint32_t dependents;
};

/*
 * Contains data for a shm-backed wl_buffer object
 */
struct wl_shm_buffer {
    void *p;
    int32_t stride;
    struct wl_shm_pool *pool;
};

/*
 * Handle a wl_shm@format event
 *
 * Drop messages advertising unsupported pixel formats
 */
enum proxy_actions wl_shm_format(struct proxy_message *msg) {
    // We only support pixel formats #0 (argb8888) and #1 (xrgb8888)
    if (msg->closure->args[0].u == 0 || msg->closure->args[0].u == 1)
        return PROXY_ACTION_FWD;
    else
        return PROXY_ACTION_DROP;
}

/*
 * Handle a wl_shm@create_pool request
 *
 * Mmaps the pool and saves pool metadata.
 */
enum proxy_actions wl_shm_create_pool(struct proxy_message *msg) {
    int fd;
    struct wl_map *map;
    struct wl_shm_pool *pool;

    pool = malloc(sizeof(struct wl_shm_pool));
    if (pool == NULL)
        return PROXY_ACTION_ERR;

    pool->id = msg->closure->args[0].n;
    pool->size = msg->closure->args[2].i;
    pool->dependents = 0;
    fd = msg->closure->args[1].h;
    pool->p = mmap(NULL, pool->size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if (pool->p == MAP_FAILED) {
        free(pool);
        return PROXY_ACTION_ERR;
    }

    map = msg->conn->session->obj_data;
    assert(wl_map_lookup(map, pool->id) == NULL);
    if (wl_map_insert_at(map, 0, pool->id, pool) < 0)
        return PROXY_ACTION_ERR;

    return PROXY_ACTION_FWD;
}

/*
 * Free the resources used by a wl_shm_pool
 *
 * The wl_shm_pool object must already have been destroyed and all of its child
 * wl_buffers must already have been freed.
 */
static void wl_shm_pool_free(struct wl_shm_pool *pool) {
    assert(pool != NULL);
    assert(pool->id == 0); // The wl_shm_pool must be destroyed
    assert(pool->dependents == 0); // All child wl_buffers must be freed

    assert(munmap(pool->p, pool->size) == 0); // munmap should not fail
    free(pool);
}

/*
 * Handle a wl_shm_pool@destroy request
 *
 * Marks the pool as destroyed, and frees its resources if possible.
 */
enum proxy_actions wl_shm_pool_destroy(struct proxy_message *msg) {
    uint32_t id;
    struct wl_map *map;
    struct wl_shm_pool *pool;

    id = msg->closure->sender_id;
    map = msg->conn->session->obj_data;
    pool = wl_map_lookup(map, id);
    assert(pool != NULL);

    // Destroy pool
    assert(pool->id != 0); // The wl_shm_pool must not be destroyed yet
    wl_map_remove(map, pool->id);
    pool->id = 0;

    // Free pool if possible
    if (pool->dependents == 0)
        wl_shm_pool_free(pool);

    return PROXY_ACTION_FWD;
}

/*
 * Handle a wl_shm_pool@create_buffer request
 *
 * Saves buffer metadata.
 */
enum proxy_actions wl_shm_pool_create_buffer(struct proxy_message *msg) {
    struct wl_map *map;
    struct wl_shm_pool *pool;
    struct wl_buffer *wl_buf;
    struct wl_shm_buffer *shm_buf;

    wl_buf = malloc(sizeof(struct wl_buffer));
    if (wl_buf == NULL)
        return PROXY_ACTION_ERR;
    shm_buf = malloc(sizeof(struct wl_shm_buffer));
    if (shm_buf == NULL) {
        free(wl_buf);
        return PROXY_ACTION_ERR;
    }

    map = msg->conn->session->obj_data;
    wl_buf->id = msg->closure->args[0].n;
    wl_buf->width = msg->closure->args[2].i;
    wl_buf->height = msg->closure->args[3].i;
    wl_buf->shm_buf = shm_buf;
    wl_buf->dma_buf = NULL;
    wl_buf->dependents = 0;
    shm_buf->stride = msg->closure->args[4].i;
    pool = wl_map_lookup(map, msg->closure->sender_id);
    assert(pool != NULL);
    pool->dependents++;
    shm_buf->pool = pool;
    shm_buf->p = pool->p + msg->closure->args[1].i;

    // Assert pixel format is supported
    assert(msg->closure->args[5].u == 0 || msg->closure->args[5].u == 1);

    assert(wl_map_lookup(map, wl_buf->id) == NULL);
    if (wl_map_insert_at(map, 0, wl_buf->id, wl_buf) < 0) {
        free(wl_buf);
        return PROXY_ACTION_ERR;
    }

    return PROXY_ACTION_FWD;
}

/*
 * Free the resources used by a shm-backed wl_buffer
 *
 * The wl_buffer object must already have been destroyed and must not be
 * attached to any surfaces.
 */
void wl_shm_buffer_free(struct wl_shm_buffer *buf) {
    assert(buf != NULL);

    // Free wl_shm_pool parent if possible
    buf->pool->dependents--;
    if (buf->pool->id == 0 && buf->pool->dependents == 0) {
        wl_shm_pool_free(buf->pool);
    }

    free(buf);
}

/*
 * Handle a wl_surface@commit request when the attached buffer is shm-backed
 *
 * Pass buffer to encode module.
 */
enum proxy_actions wl_shm_surface_commit(struct capture_data *data,
                                         struct wl_surface *surf) {
    struct wl_buffer *wl_buf;
    struct wl_shm_buffer *shm_buf;

    wl_buf = surf->buf;
    assert(wl_buf != NULL);
    shm_buf = wl_buf->shm_buf;
    assert(shm_buf != NULL);

    if (data->encoder == NULL) {
        // Initialize encoder
        data->encoder = encoder_startup(surf->buf->width, surf->buf->height);
        if (data->encoder == NULL)
            return PROXY_ACTION_ERR;
    }

    // Encode frame
    assert(encode_video_frame(data->encoder, shm_buf->p, shm_buf->stride) == 0);

    return PROXY_ACTION_FWD;
}

/*
 * The Wayland message handlers for shm-backed wl_buffers
 */
const struct message_handler shm_buffers_message_handlers[] = {
    { "wl_shm",      "format",        &wl_shm_format             },
    { "wl_shm",      "create_pool",   &wl_shm_create_pool        },
    { "wl_shm_pool", "destroy",       &wl_shm_pool_destroy       },
    { "wl_shm_pool", "create_buffer", &wl_shm_pool_create_buffer },

    { NULL,          NULL,            NULL                       },
};
