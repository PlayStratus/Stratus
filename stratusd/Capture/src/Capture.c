#include <assert.h>
#include <stdbool.h>
#include <stdio.h>

#include <wayland-private.h>

#include "capture-priv.h"

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
 * An basic demo message handler for the wl_surface@commit message
 */
static enum proxy_actions wl_surface_commit(struct proxy_message *msg) {
    printf("Received new frame!\n");
    return PROXY_ACTION_FWD;
}

/*
 * The available Wayland message handlers
 */
const struct message_handler message_handlers[] = {
    { "wl_surface", "commit", wl_surface_commit },
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
 * Handle a proxy session being destroyed
 */
static void handle_session_destroy(struct proxy_session *session) {
    printf("Client disconnected\n");
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
