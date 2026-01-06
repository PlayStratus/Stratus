#include <stdio.h>

#include <wayland-private.h>

#include "proxy.h"


/*
 * Handle a new proxy session
 */
static int capture_handle_session_create(struct proxy_session *session) {
    printf("Client connected\n");
}

/*
 * Handle a proxy session being destroyed
 */
static void capture_handle_session_destroy(struct proxy_session *session) {
    printf("Client disconnected\n");
}

/*
 * Handle a Wayland message
 */
static enum proxy_actions capture_handle_message(struct proxy_message *msg) {
    wl_closure_print(msg->closure, msg->interface,
                     msg->conn->side == PROXY_SIDE_CLIENT, false, NULL, NULL);

    return PROXY_ACTION_FWD;
}

int capture_test() {
    struct proxy *proxy = proxy_init("stratus");
    if (proxy != NULL) {
        proxy->on_session_create = &capture_handle_session_create;
        proxy->on_message = &capture_handle_message;
        proxy->on_session_destroy = &capture_handle_session_destroy;
        printf("Starting Wayland proxy on $XDG_RUNTIME_DIR/%s\n", proxy->name);
        proxy_run(proxy);
        proxy_destroy(proxy);
    }
    return 0;
}
