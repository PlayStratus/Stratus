/*
 * Wayland video frame capture system
 *
 * Extends the generic Wayland proxy implemented in proxy.c to create a system
 * of Wayland message handlers (defined in resize.c, shm-buffers.c, and
 * video-output.c) that collectively implement video capture functionality.
 *
 * Since proxy.c uses a custom version of libwayland, message handlers must
 * implement the Wayland object lifecycle boilerplate functionality themselves.
 * One particularly tedious edge case is that Wayland objects may be destroyed
 * while still referenced by another object. This means that objects cannot be
 * immediately freed after they're destroyed. To address this issue, we set an
 * object's ID to zero to indicate that it has been destroyed, and then free its
 * resources once the number of references by other objects (tracked in the
 * dependents field) reaches zero.
 *
 * For more background information on Wayland, refer to the Wayland Book [1] and
 * the definitions for the relevant Wayland protocols.
 *
 * [1]: https://wayland-book.com
 */

#include <assert.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>

#include <wayland-private.h>

#include "Capture.h"
#include "capture-priv.h"
#include "resize-pub.h"
#include "shm-buffers-pub.h"
#include "dma-buffers-pub.h"
#include "video-output-pub.h"

/*
 * The available Wayland message handlers
 */
const struct message_handler *message_handlers[] = {
    resize_message_handlers,
    shm_buffers_message_handlers,
    dma_buffers_message_handlers,
    video_output_message_handlers,
};

/*
 * Handle a new proxy session
 */
static int handle_session_create(struct proxy_session *session) {
    fprintf(stderr, "[Capture] Client %s connected\n", session->name);

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
                !strcmp(msg->closure->message->name, message_handlers[i][j].msg_name)) {
                return (*message_handlers[i][j].handler)(msg);
            }
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
    fprintf(stderr, "[Capture] Client %s disconnected\n", session->name);

    // Destroy all remaining Wayland objects so that their resources are freed
    wl_map_for_each(session->obj_data, destroy_object, session);
}

/*
 * Destroy a capture session and free its resources
 */
static void capture_destroy(struct capture_session *session) {
    fprintf(stderr, "[Capture] Wayland proxy destroyed\n");

    if (session->encoder != NULL)
        encoder_teardown(session->encoder);
    proxy_destroy(session->proxy);
    free(session);
}

/*
 * Run the capture module
 *
 * Returns 0 on success and -1 on failure.
 */
int capture_main(struct session_args *args) {
    int ret = 0;
    struct capture_session *session;

    session = malloc(sizeof(struct capture_session));
    if (session == NULL) {
        perror("[Capture] malloc");
        return -1; // No need to jump to end outside of pthread_cleanup_* macro
    }

    pthread_cleanup_push((void (*)(void*))capture_destroy, session);

    assert(args != NULL);
    assert(args->width > 0);
    assert(args->height > 0);
    session->encode_output = args->encode_output;
    session->width = args->width;
    session->height = args->height;

    session->proxy = proxy_init("stratus");
    if (session->proxy == NULL) {
        free(session);
        ret = -1;
        goto end;
    }
    session->proxy->on_session_create   = &handle_session_create;
    session->proxy->on_message          = &handle_message;
    session->proxy->on_session_destroy  = &handle_session_destroy;
    session->proxy->userdata            = session;

    // TODO: EGL doesn't like being initialized in one thread and then run in
    // a different thread. It's possible to change this, but eventually the
    // Encode module will be running completely in its own thread anyway. So for
    // now we will just initialize it in the Capture thread, since that's where
    // its called from.
    session->encoder = encoder_startup(args);
    if (session->encoder == NULL) {
        ret = -1;
        goto end;
    }

    fprintf(stderr, "[Capture] Starting Wayland proxy on $XDG_RUNTIME_DIR/%s\n",
           session->proxy->name);
    if (proxy_run(session->proxy) < 0) {
        ret = -1;
        goto end;
    }

end:
    pthread_cleanup_pop(1);
    return ret;
}
