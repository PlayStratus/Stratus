/*
 * Wayland message handlers for capturing frames via shared host memory buffers
 *
 * No other functions should handle Wayland messages relating to wl_shm_pool,
 * wl_buffer, or wl_surface objects to avoid object conflicts.
 */

#include <assert.h>
#include <stdio.h>
#include <sys/mman.h>

#include "shm-frame-output.h"

/*
 * Key interfaces defined in libs/wayland/protocols/*.c
 */
extern const struct wl_interface wl_buffer_interface;

/*
 * Contains data for a wl_shm_pool object
 *
 * The buf_count field records the number of child buffers that still exist. The
 * wl_shm_pool cannot be freed until buf_count is zero. An id of zero indicates
 * that the wl_shm_pool has been destroyed but not yet freed.
 */
struct wl_shm_pool {
    uint32_t id;
    void *p;
    int32_t size;
    uint buf_count;
};

/*
 * Contains data for a wl_buffer object
 *
 * The surf_count field records the number of surfaces the buffer is still
 * attached to. The wl_buffer cannot be freed until surf_count is zero. An id of
 * zero indicates that the wl_buffer has been destroyed but not yet freed.
 *
 * Note: we do not process all methods that create buffers, so not every
 * wl_buffer object will correspond to an instance of the wl_buffer struct.
 */
struct wl_buffer {
    uint32_t id;
    void *p;
    int32_t width;
    int32_t height;
    struct wl_shm_pool *pool;
    uint surf_count;
};

/*
 * Contains data for a wl_surface object
 */
struct wl_surface {
    uint32_t id;
    struct wl_buffer *buf; // The currently attached buffer
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
    pool->buf_count = 0;
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
    assert(pool->buf_count == 0); // All child wl_buffers must be freed

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
    if (pool->buf_count == 0)
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
    struct wl_buffer *buf;

    buf = malloc(sizeof(struct wl_buffer));
    if (buf == NULL)
        return PROXY_ACTION_ERR;

    map = msg->conn->session->obj_data;
    buf->id = msg->closure->args[0].n;
    buf->width = msg->closure->args[2].i;
    buf->height = msg->closure->args[3].i;
    pool = wl_map_lookup(map, msg->closure->sender_id);
    assert(pool != NULL);
    pool->buf_count++;
    buf->pool = pool;
    buf->surf_count = 0;
    buf->p = pool->p + msg->closure->args[1].i;

    // Assert pixel format is supported
    assert(msg->closure->args[5].u == 0 || msg->closure->args[5].u == 1);

    assert(wl_map_lookup(map, buf->id) == NULL);
    if (wl_map_insert_at(map, 0, buf->id, buf) < 0)
        return PROXY_ACTION_ERR;

    return PROXY_ACTION_FWD;
}

/*
 * Handle a wl_buffer@release event
 *
 * Drops message if buffer is known.
 */
enum proxy_actions wl_buffer_release(struct proxy_message *msg)
{
    uint32_t id;
    struct wl_map *map;
    struct wl_buffer *buf;

    id = msg->closure->sender_id;
    map = msg->conn->session->obj_data;
    buf = wl_map_lookup(map, id);
    if (buf != NULL && buf->surf_count > 0)
        // We will release buffer manually in wl_surface_commit()
        return PROXY_ACTION_DROP;
    else
        return PROXY_ACTION_FWD;
}

/*
 * Free the resources used by a wl_buffer
 *
 * The wl_buffer object must already have been destroyed and must not be
 * attached to any surfaces.
 */
static void wl_buffer_free(struct wl_buffer *buf) {
    assert(buf != NULL);
    assert(buf->id == 0); // The wl_buffer must be destroyed
    assert(buf->surf_count == 0); // The wl_buffer must not be attached

    // Free wl_shm_pool parent if possible
    buf->pool->buf_count--;
    if (buf->pool->id == 0 && buf->pool->buf_count == 0) {
        wl_shm_pool_free(buf->pool);
    }

    free(buf);
}

/*
 * Handle a wl_buffer@destroy request
 *
 * Marks the buffer as destroyed, and frees its resources if possible.
 */
enum proxy_actions wl_buffer_destroy(struct proxy_message *msg) {
    uint32_t id;
    struct wl_map *map;
    struct wl_buffer *buf;

    id = msg->closure->sender_id;
    map = msg->conn->session->obj_data;
    buf = wl_map_lookup(map, id);
    if (buf == NULL)
        // We don't create objects for non-shm buffers, so we can safely ignore
        // a NULL buffer object
        return PROXY_ACTION_FWD;

    // Destroy buffer
    assert(buf->id != 0); // The wl_buf must not be destroyed yet
    wl_map_remove(map, buf->id);
    buf->id = 0;

    // Free buffer if possible
    if (buf->surf_count == 0)
        wl_buffer_free(buf);

    return PROXY_ACTION_FWD;
}

/*
 * Handle a wl_compositor@create_surface event
 *
 * Saves surface metadata.
 */
enum proxy_actions wl_compositor_create_surface(struct proxy_message *msg) {
    struct wl_map *map;
    struct wl_surface *surf;

    surf = malloc(sizeof(struct wl_surface));
    if (surf == NULL)
        return PROXY_ACTION_ERR;

    surf->id = msg->closure->args[0].n;
    surf->buf = NULL;

    map = msg->conn->session->obj_data;
    assert(wl_map_lookup(map, surf->id) == NULL);
    if (wl_map_insert_at(map, 0, surf->id, surf) < 0)
        return PROXY_ACTION_ERR;

    return PROXY_ACTION_FWD;
}

/*
 * Handle a wl_surface@attach request
 *
 * Updates surface buffer if buffer is known.
 */
enum proxy_actions wl_surface_attach(struct proxy_message *msg) {
    uint32_t surf_id, buf_id;
    struct wl_map *map;
    struct wl_buffer *buf;
    struct wl_surface *surf;

    map = msg->conn->session->obj_data;
    surf_id = msg->closure->sender_id;
    surf = wl_map_lookup(map, surf_id);
    assert(surf != NULL);
    buf_id = msg->closure->args[0].n;
    buf = wl_map_lookup(map, buf_id);

    // Unattach previous buffer, if known
    if (surf->buf != NULL) {
        surf->buf->surf_count--;
        if (surf->buf->id == 0 && surf->buf->surf_count == 0)
            // Previously attached wl_buffer was destroyed and is no longer
            // attached anywhere, so we can free it now
            wl_buffer_free(surf->buf);
    }

    // Attach new buffer if known
    surf->buf = buf;
    if (surf->buf != NULL)
        buf->surf_count++;

    return PROXY_ACTION_FWD;
}

/*
 * Handle a wl_surface@commit request
 *
 * Processes frame and releases attached buffer if known.
 */
enum proxy_actions wl_surface_commit(struct proxy_message *msg) {
    int ret;
    uint8_t *pixel;
    uint32_t id;
    struct wl_map *map;
    struct wl_surface *surf;
    struct wl_buffer *buf;
    struct wl_closure *res;

    map = msg->conn->session->obj_data;
    id = msg->closure->sender_id;
    surf = wl_map_lookup(map, id);
    assert(surf != NULL);
    buf = surf->buf;

    if (buf != NULL) {
        if (buf->width > 64 && buf->height > 64) {
            // A >64x64 frame probably isn't the cursor, so let's process it.
            // We'll eventually pass the frame to the encode module here (TODO),
            // but for now we'll just print the color of the center pixel.
            pixel = buf->p + (buf->width * buf->height / 2) * 4;
            printf("NEW FRAME: center pixel is 0x%02x%02x%02x%02x\n", pixel[3],
                   pixel[2], pixel[1], pixel[0]);
        }

        // Release buffer
        res = wl_closure_init(&wl_buffer_interface.events[0], 0, NULL, NULL);
        res->sender_id = buf->id;
        res->opcode = 0; // wl_buffer event #0 is release event
        ret = wl_closure_send(res, msg->conn->session->client->wl_conn);
        wl_closure_destroy(res);
        if (ret < 0)
            return PROXY_ACTION_ERR;
    }

    return PROXY_ACTION_FWD;
}

/*
 * Handle a wl_surface@destroy request
 *
 * Marks the surface as destroyed and frees its resources
 */
enum proxy_actions wl_surface_destroy(struct proxy_message *msg) {
    uint32_t id;
    struct wl_map *map;
    struct wl_surface *surf;

    map = msg->conn->session->obj_data;
    id = msg->closure->sender_id;
    surf = wl_map_lookup(map, id);
    assert(surf != NULL);

    // Destroy surface
    assert(surf->id != 0); // The wl_surface must not be destroyed yet
    wl_map_remove(map, id);
    surf->id = 0;

    // Free attached buffer if possible
    if (surf->buf != NULL) {
        surf->buf->surf_count--;
        if (surf->buf->id == 0 && surf->buf->surf_count == 0) {
            wl_buffer_free(surf->buf);
        }
    }

    // Free surface
    free(surf);

    return PROXY_ACTION_FWD;
}
