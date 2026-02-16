/*
 * Generic video frame capture logic
 *
 * These functions are in charge of all wl_buffer and wl_surface objects. Logic
 * specific to shm-backed wl_buffers is delegated to the shm-buffers.c
 * functions.
 *
 * Note that Wayland objects might be destroyed while still referenced by
 * another object. This means that objects cannot be immediately freed after
 * they're destroyed. We set an object's ID to zero to indicate that it has been
 * destroyed. Then once the number of references by other objects (tracked in
 * the dependents field) reaches zero, we may free the object's resources.
 */

#include <assert.h>
#include <stdbool.h>
#include <sys/mman.h>

#include "capture-priv.h"
#include "shm-buffers-priv.h"
#include "video-output-pub.h"
#include "video-output-priv.h"

/*
 * Required Wayland protocol interfaces
 */
extern const struct wl_interface wl_buffer_interface;

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
    if (buf != NULL)
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
    assert(buf->dependents == 0); // The wl_buffer must not be attached

    // Free wl_shm_buffer if defined
    if (buf->shm_buf != NULL)
        wl_shm_buffer_free(buf->shm_buf);

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
    if (buf->dependents == 0)
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
    surf->dependents = 0;

    map = msg->conn->session->obj_data;
    assert(wl_map_lookup(map, surf->id) == NULL);
    if (wl_map_insert_at(map, 0, surf->id, surf) < 0)
        return PROXY_ACTION_ERR;

    return PROXY_ACTION_FWD;
}

/*
 * Unattaches a buffer from a surface, and frees the buffer if possible
 */
static void wl_surface_unattach(struct wl_surface *surf) {
    if (surf->buf != NULL) {
        surf->buf->dependents--;
        if (surf->buf->id == 0 && surf->buf->dependents == 0)
            // Previously attached wl_buffer was destroyed and is no longer
            // attached anywhere, so we can free it now
            wl_buffer_free(surf->buf);
        surf->buf = NULL;
    }
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
    wl_surface_unattach(surf);

    // Attach new buffer if known
    surf->buf = buf;
    if (surf->buf != NULL) {
        // We only support frame buffers that fill the entire surface
        assert(msg->closure->args[1].i == 0);
        assert(msg->closure->args[2].i == 0);

        buf->dependents++;
    }

    return PROXY_ACTION_FWD;
}

/*
 * Handle a wl_surface@commit request
 *
 * Processes frame and releases attached buffer if known.
 */
enum proxy_actions wl_surface_commit(struct proxy_message *msg) {
    int ret;
    uint32_t id;
    struct wl_map *map;
    struct wl_surface *surf;
    struct wl_buffer *buf;
    struct wl_closure *res;
    struct capture_data *capture_data;

    map = msg->conn->session->obj_data;
    id = msg->closure->sender_id;
    surf = wl_map_lookup(map, id);
    assert(surf != NULL);
    buf = surf->buf;

    if (buf != NULL) {
        if (buf->width > 64 && buf->height > 64) {
            // A >64x64 frame probably isn't the cursor, so let's process it.
            capture_data = msg->conn->session->proxy->userdata;
            if (buf->shm_buf != NULL)
                wl_shm_surface_commit(capture_data, surf); // Handle shm frame
        }

        // Release buffer
        res = wl_closure_init(&wl_buffer_interface.events[0], 0, NULL, NULL);
        res->sender_id = buf->id;
        res->opcode = 0; // wl_buffer event #0 is release event
        ret = wl_closure_send(res, msg->conn->session->client->wl_conn);
        wl_closure_destroy(res);
        if (ret < 0)
            return PROXY_ACTION_ERR;

        // Unattach buffer. This prevents us from sending duplicate release
        // events when the client commits without actually attaching a new
        // buffer.
        wl_surface_unattach(surf);
    }

    return PROXY_ACTION_FWD;
}

/*
 * Free the resources used by a wl_surface
 *
 * The wl_surface object must already have been destroyed.
 */
static void wl_surface_free(struct wl_surface *surf) {
    assert(surf != NULL);
    assert(surf->id == 0); // The wl_surface must be destroyed

    free(surf);
}

/*
 * Handle a wl_surface@destroy request
 *
 * Marks the surface as destroyed, and frees its resources if possible.
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

    // Unattach and free buffer, if known
    wl_surface_unattach(surf);

    // Free surface if possible
    if (surf->dependents == 0)
        wl_surface_free(surf);

    return PROXY_ACTION_FWD;
}

/*
 * The Wayland message handlers for generic video frame capture
 */
const struct message_handler video_output_message_handlers[] = {
    // Generic message handlers for wl_buffers
    { "wl_buffer",     "release",             &wl_buffer_release               },
    { "wl_buffer",     "destroy",             &wl_buffer_destroy               },

    // Message handlers for wl_surfaces
    { "wl_compositor", "create_surface",      &wl_compositor_create_surface    },
    { "wl_surface",    "attach",              &wl_surface_attach               },
    { "wl_surface",    "commit",              &wl_surface_commit               },
    { "wl_surface",    "destroy",             &wl_surface_destroy              },

    { NULL,            NULL,                  NULL                             },
};
