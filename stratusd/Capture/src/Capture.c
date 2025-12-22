#include <stdio.h>

#include <wayland-private.h>

#include "proxy.h"

int message_handler(struct proxy_message *msg) {
    wl_closure_print(msg->closure, msg->interface,
                     msg->conn->side == SIDE_CLIENT, false, NULL, NULL);
    return 1;
}

int capture_test() {
    struct proxy *proxy = proxy_init("stratus");
    if (proxy != NULL) {
        proxy->on_message = &message_handler;
        proxy_run(proxy);
        proxy_destroy(proxy);
    }
    return 0;
}
