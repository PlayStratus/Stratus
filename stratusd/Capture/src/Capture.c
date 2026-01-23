#include <assert.h>
#include <stdbool.h>
#include <stdio.h>

#include <wayland-private.h>

#include "capture-priv.h"
#include "shm-frame-output.h"

/*
 * Whether to log all proxied Wayland messages
 *
 * Set in handle_session_create according to the WAYLAND_DEBUG variable.
 */
static bool wayland_debug = false;

/*
 * Contains data for a Wayland message handler
 */
struct message_handler {
    char *obj_name;
    char *msg_name;
    capture_message_handler_func *handler;
};

/*
 * The available Wayland message handlers
 */
const struct message_handler message_handlers[] = {
    { "wl_shm",         "format",           &wl_shm_format                  },

    { "wl_shm",         "create_pool",      &wl_shm_create_pool             },
    { "wl_shm_pool",    "destroy",          &wl_shm_pool_destroy            },

    { "wl_shm_pool",    "create_buffer",    &wl_shm_pool_create_buffer      },
    { "wl_buffer",      "release",          &wl_buffer_release              },
    { "wl_buffer",      "destroy",          &wl_buffer_destroy              },

    { "wl_compositor",  "create_surface",   &wl_compositor_create_surface   },
    { "wl_surface",     "attach",           &wl_surface_attach              },
    { "wl_surface",     "commit",           &wl_surface_commit              },
    { "wl_surface",     "destroy",          &wl_surface_destroy             },
};

/*
 * Handle a new proxy session
 */
static int handle_session_create(struct proxy_session *session) {
    printf("Client connected\n");

    wayland_debug = (getenv("WAYLAND_DEBUG") != NULL);

    return 0;
}

/*
 * Handle a Wayland message received by the proxy
 */
static enum proxy_actions handle_message(struct proxy_message *msg) {
    int i, count;

    if (wayland_debug) {
        wl_closure_print(msg->closure, msg->interface,
                         msg->conn->side == PROXY_SIDE_CLIENT, false, NULL,
                         NULL);
    }

    // Call the appropriate Wayland message handler
    count = sizeof(message_handlers) / sizeof(struct message_handler);
    for (i = 0; i < count; i++) {
        if (!strcmp(msg->interface->name, message_handlers[i].obj_name) &&
            !strcmp(msg->closure->message->name, message_handlers[i].msg_name))
            return (*message_handlers[i].handler)(msg);
    }

    return PROXY_ACTION_FWD;
}

/*
 * Force a Wayland object to be destroyed locally
 *
 * This does not destroy the object on the client or server.
 */
static enum wl_iterator_result destroy_object(void *element, void *data,
                                              uint32_t flags, size_t id) {
    int i;
    const struct wl_interface *interface;
    const struct wl_message *msg_type;
    struct proxy_session *session;
    struct proxy_message msg;

    // Lookup object interface & destroy method
    session = data;
    interface = wl_map_lookup(session->obj_types, id);
    msg_type = NULL;
    for (i = 0; i < interface->method_count; i++) {
        if (!strcmp(interface->methods[i].name, "destroy")) {
            msg_type = &interface->methods[i];
            break;
        }
    }
    assert(msg_type != NULL); // Every object should have a destroy method

    // Process a fake destroy message
    msg.conn = session->client;
    msg.interface = interface;
    msg.closure = wl_closure_init(msg_type, 0, NULL, NULL);
    assert(msg.closure != NULL);
    msg.closure->sender_id = id;
    msg.closure->opcode = i;
    assert(handle_message(&msg) != PROXY_ACTION_ERR);

    // Assert object is deleted now
    assert(wl_map_lookup(session->obj_data, id) == NULL);

    wl_closure_destroy(msg.closure);
    return WL_ITERATOR_CONTINUE;
}

/*
 * Handle a proxy session being destroyed
 */
static void handle_session_destroy(struct proxy_session *session) {
    printf("Client disconnected\n");

    // Destroy all remaining Wayland objects so that their resources are freed
    wl_map_for_each(session->obj_data, destroy_object, session);
}

int capture_test() {
    struct proxy *proxy = proxy_init("stratus");
    if (proxy == NULL) {
        fprintf(stderr, "Failed to initialize proxy\n");
        return 1;
    }
    proxy->on_session_create    = &handle_session_create;
    proxy->on_message           = &handle_message;
    proxy->on_session_destroy   = &handle_session_destroy;

    printf("Starting Wayland proxy on $XDG_RUNTIME_DIR/%s\n", proxy->name);
    if (proxy_run(proxy) < 0) {
        fprintf(stderr, "Proxy exited unsucessfully\n");
        proxy_destroy(proxy);
        return 1;
    }

    proxy_destroy(proxy);
    return 0;
}
