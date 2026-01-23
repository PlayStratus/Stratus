#include <assert.h>
#include <stdbool.h>
#include <stdio.h>

#include <wayland-private.h>

#include "capture-priv.h"
#include "shm-buffers-pub.h"
#include "video-output-pub.h"

/*
 * The available Wayland message handlers
 */
const struct message_handler *message_handlers[] = {
    video_output_message_handlers,
    shm_buffers_message_handlers,
};

/*
 * Handle a new proxy session
 */
static int handle_session_create(struct proxy_session *session) {
    printf("Client connected\n");

    return 0;
}

/*
 * Handle a Wayland message received by the proxy
 */
static enum proxy_actions handle_message(struct proxy_message *msg) {
    int i, j, count;

    // Call the appropriate Wayland message handler
    count = sizeof(message_handlers) / sizeof(struct message_handler*);
    for (i = 0; i < count; i++) {
        for (j = 0; message_handlers[i][j].handler != NULL; j++) {
            if (!strcmp(msg->interface->name, message_handlers[i][j].obj_name) &&
                !strcmp(msg->closure->message->name, message_handlers[i][j].msg_name))
                return (*message_handlers[i][j].handler)(msg);
        }
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
