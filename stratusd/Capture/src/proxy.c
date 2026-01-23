#include <assert.h>
#include <errno.h>
#include <stdbool.h>
#include <stdio.h>
#include <sys/epoll.h>
#include <sys/param.h>
#include <unistd.h>

#include <wayland-client.h>
#include <wayland-private.h>
#include <wayland-server.h>

#include "proxy.h"

/*
 * Required Wayland protocol interfaces
 */
extern const struct wl_interface *linux_dmabuf_v1_types_all[];
extern const struct wl_interface *presentation_time_types_all[];
extern const struct wl_interface *tablet_v2_types_all[];
extern const struct wl_interface *viewporter_types_all[];
extern const struct wl_interface *wayland_types_all[];
extern const struct wl_interface *xdg_shell_types_all[];
extern const struct wl_interface wl_display_interface;

/*
 * Whether to log all proxied Wayland messages
 *
 * Set in handle_session_create according to the WAYLAND_DEBUG variable.
 */
static bool wayland_debug = false;

/*
 * The available Wayland protocols
 */
const struct wl_interface **proxy_protocols[] = {
    linux_dmabuf_v1_types_all,
    presentation_time_types_all,
    tablet_v2_types_all,
    viewporter_types_all,
    wayland_types_all,
    xdg_shell_types_all,
};

/*
 * Add a file descriptor to a proxy's epoll instance with a custom data pointer
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_epoll_add_fd(struct proxy *proxy, int fd, void *data) {
    struct epoll_event ev;
    ev.events = EPOLLIN;
    ev.data.ptr = data;
    return epoll_ctl(proxy->epoll_fd, EPOLL_CTL_ADD, fd, &ev);
}

/*
 * Initialize a proxy session's client or server connection
 *
 * This function must only be called once per connection type per proxy
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_add_connection(struct proxy_session *session, int fd, int side)
{
    struct proxy_conn **conn = (side == PROXY_SIDE_SERVER) ? &session->server
                                                           : &session->client;
    assert(*conn == NULL); // The connection must not already exist

    *conn = malloc(sizeof(struct proxy_conn));
    if (*conn == NULL)
        goto err_malloc;

    (*conn)->side = side;
    (*conn)->session = session;

    (*conn)->wl_conn = wl_connection_create(fd, 0);
    if ((*conn)->wl_conn == NULL)
        goto err_conn;

    if (proxy_epoll_add_fd(session->proxy, fd, *conn) < 0)
        goto err_epoll;

    return 0;

err_epoll:
    wl_connection_destroy((*conn)->wl_conn);
err_conn:
    free(*conn);
    *conn = NULL;
err_malloc:
    return -1;
}

/*
 * Destroy a proxy_conn struct and free its resources
 */
static void proxy_destroy_connection(struct proxy_conn *conn) {
    assert(conn != NULL);
    int fd = wl_connection_destroy(conn->wl_conn);
    epoll_ctl(conn->session->proxy->epoll_fd, EPOLL_CTL_DEL, fd, NULL);
    close(fd);
    free(conn);
}

/*
 * Initialize a proxy session
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_create_session(struct proxy *proxy, int client_fd) {
    int server_fd;
    struct proxy_session *session;

    // Initialize session
    session = zalloc(sizeof(struct proxy_session));
    if (session == NULL)
        goto err_zalloc;
    session->proxy = proxy;

    // Connect to client
    if (proxy_add_connection(session, client_fd, PROXY_SIDE_CLIENT) < 0)
        goto err_client;

    // Connect to server
    server_fd = connect_to_socket(NULL);
    if (server_fd < 0)
        goto err_server_socket;
    if (proxy_add_connection(session, server_fd, PROXY_SIDE_SERVER) < 0)
        goto err_server_conn;

    // Initialize object types map
    session->obj_types = malloc(sizeof(struct wl_map));
    if (session->obj_types == NULL)
        goto err_obj_types;
    wl_map_init(session->obj_types, WL_MAP_CLIENT_SIDE);
    wl_map_insert_new(session->obj_types, 0, NULL);
    wl_map_insert_new(session->obj_types, 0, (void*)&wl_display_interface);

    // Initialize object data map
    session->obj_data = malloc(sizeof(struct wl_map));
    if (session->obj_data == NULL)
        goto err_obj_data;
    wl_map_init(session->obj_data, WL_MAP_CLIENT_SIDE);
    wl_map_insert_new(session->obj_data, 0, NULL);
    wl_map_insert_new(session->obj_data, 0, NULL);

    if (proxy->on_session_create != NULL) {
        if ((*proxy->on_session_create)(session) < 0)
            goto err_handler;
    }

    proxy->session_count++;

    return 0;

err_handler:
    wl_map_release(session->obj_data);
    free(session->obj_data);
err_obj_data:
    wl_map_release(session->obj_types);
    free(session->obj_types);
err_obj_types:
    proxy_destroy_connection(session->server);
err_server_conn:
    close(server_fd);
err_server_socket:
    proxy_destroy_connection(session->client);
err_client:
    free(session);
err_zalloc:
    return -1;
}

/*
 * Destroy a proxy_session struct and free its resources
 */
static void proxy_destroy_session(struct proxy_session *session) {
    assert(session != NULL);
    if (session->proxy->on_session_destroy != NULL)
        (*session->proxy->on_session_destroy)(session);
    proxy_destroy_connection(session->client);
    proxy_destroy_connection(session->server);
    wl_map_release(session->obj_types);
    free(session->obj_types);
    wl_map_release(session->obj_data);
    free(session->obj_data);
    session->proxy->session_count--;
    free(session);
}

/*
 * Lookup a Wayland interface by name
 *
 * Returns a pointer to the wl_interface struct, or NULL if it was not found
 */
static const struct wl_interface *proxy_lookup_interface(const char *name) {
    int i, j, protocol_count;

    protocol_count = sizeof(proxy_protocols) / sizeof(struct wl_interface**);
    for (i = 0; i < protocol_count; i++) {
        for (j = 0; proxy_protocols[i][j] != NULL; j++) {
            if (!strcmp(name, proxy_protocols[i][j]->name)) {
                return proxy_protocols[i][j];
            }
        }
    }
    return NULL;
}

/*
 * Initialize a new object in a proxy session
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_create_object(struct proxy_session *session, uint32_t id,
                               const struct wl_interface *interface) {
    if (wl_map_insert_at(session->obj_types, 0, id, (void*)interface) < 0)
        return -1;
    if (wl_map_insert_at(session->obj_data, 0, id, NULL) < 0)
        return -1;
    return 0;
}

/*
 * Handle a Wayland message received by a proxy
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_handle_message(struct proxy_conn *src, int id, int size,
                                int opcode) {
    bool new_objects;
    int i, arg_count;
    const char *signature;
    enum proxy_actions handler_ret;
    const struct wl_interface *interface, *bind_interface;
    struct wl_message message;
    struct wl_closure *closure;
    struct argument_details arg;
    struct proxy_conn *dst;
    struct proxy_message msg;

    // Parse message
    interface = wl_map_lookup(src->session->obj_types, id);
    if (interface == NULL)
        goto err_pre_closure;
    message = (src->side == PROXY_SIDE_CLIENT) ? interface->methods[opcode]
                                               : interface->events[opcode];
    closure = wl_connection_demarshal(src->wl_conn, size,
                                      src->session->obj_types, &message);
    if (closure == NULL)
        goto err_pre_closure;

    if (wayland_debug)
        wl_closure_print(closure, interface, src->side == PROXY_SIDE_CLIENT,
                         false, NULL, NULL);

    // Handle wl_registry@global message
    if (!strcmp(interface->name, "wl_registry") &&
        !strcmp(message.name, "global") &&
        !proxy_lookup_interface(closure->args[1].s)) {

        // Drop global events for unsupported interfaces
        goto drop;
    }

    // Handle created objects
    new_objects = false;
    if (!strcmp(interface->name, "wl_registry") &&
        !strcmp(message.name, "bind")) {
        // Initialize object for newly bound interface
        bind_interface = proxy_lookup_interface(closure->args[1].s);
        if (bind_interface == NULL)
            goto err_post_closure;
        if (proxy_create_object(src->session, closure->args[3].n,
                                bind_interface) < 0)
            goto err_post_closure;
        new_objects = true;

    } else {
        // Initialize newly created (non-global) objects
        signature = closure->message->signature;
        arg_count = arg_count_for_signature(signature);
        for (i = 0; i < arg_count; i++) {
            signature = get_next_argument(signature, &arg);
            if (arg.type == WL_ARG_NEW_ID) {
                if (proxy_create_object(src->session, closure->args[i].n,
                                        message.types[0]) < 0)
                    goto err_post_closure;
                new_objects = true;
            }
        }
    }

    // Run custom message handler if defined
    if (src->session->proxy->on_message != NULL) {
        msg.conn = src;
        msg.interface = interface;
        msg.closure = closure;
        handler_ret = (*src->session->proxy->on_message)(&msg);
        if (handler_ret == PROXY_ACTION_ERR) {
            goto err_post_closure;
        } else if (handler_ret == PROXY_ACTION_DROP) {
            // Messages creating new objects must be forwarded to maintain
            // consistency between the client and server
            assert(!new_objects);
            goto drop;
        }
    }

    // Forward message
    dst = (src->side == PROXY_SIDE_CLIENT) ? src->session->server
                                           : src->session->client;
    assert(dst != NULL); // The opposite connection must already exist
    if (wl_closure_send(closure, dst->wl_conn) < 0)
        goto err_post_closure;
    wl_closure_destroy(closure);
    return 0;

drop:
    if (wayland_debug)
        fprintf(stderr, "\t\t(previous message dropped)\n");
    wl_closure_destroy(closure);
    return 0;

err_post_closure:
    wl_closure_destroy(closure);
err_pre_closure:
    return -1;
}

/*
 * Handles data received by a proxy
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_handle_data(struct proxy_conn *src) {
    bool proxy_msg;
    char buf[WL_MAX_MESSAGE_SIZE];
    int len, id, size, opcode;
    struct proxy_conn *dst;

    len = wl_connection_read(src->wl_conn);
    while (len >= 2 * sizeof(uint32_t)) {
        // Parse header of next message
        wl_connection_copy(src->wl_conn, buf, 2 * sizeof(uint32_t));
        id = ((uint32_t*)buf)[0];
        size = ((uint32_t*)buf)[1] >> 16;
        opcode = ((uint32_t*)buf)[1] & 0xffff;

        // Parse and handle message
        if (proxy_handle_message(src, id, size, opcode) < 0)
            return -1;

        len -= size;
    }

    // Flush destination connection
    dst = (src->side == PROXY_SIDE_CLIENT) ? src->session->server
                                           : src->session->client;
    assert(dst != NULL); // The opposite connection must already exist
    if (wl_connection_flush(dst->wl_conn) < 0)
        return -1;

    return 0;
}

/*
 * Initialize a Wayland proxy between the system compositor and applications
 * that connect to the proxy socket at $XDG_RUNTIME_DIR/<name>
 *
 * Returns a pointer to the proxy on success and NULL on failure
 */
struct proxy *proxy_init(char *name) {
    int server_fd;
    struct proxy *proxy;

    // Create proxy
    proxy = zalloc(sizeof(struct proxy));
    if (proxy == NULL)
        goto err_zalloc;
    proxy->name = name;
    proxy->session_count = 0;

    // Initialize proxy epoll instance
    proxy->epoll_fd = epoll_create1(0);
    if (proxy->epoll_fd < 0)
        goto err_epoll_create;

    // Create proxy socket
    proxy->socket = wl_display_add_socket(proxy->name);
    if (proxy->socket == NULL)
        goto err_proxy_socket;
    if (proxy_epoll_add_fd(proxy, proxy->socket->fd, NULL) < 0)
        goto err_proxy_epoll;

    return proxy;

err_proxy_epoll:
err_proxy_socket:
err_epoll_create:
    free(proxy);
err_zalloc:
    return NULL;
}

/*
 * Run a Wayland proxy
 *
 * Returns 0 after the client disconnects successfully and -1 on failure
 */
int proxy_run(struct proxy *proxy) {
    struct epoll_event ev;
    int client_fd;

    wayland_debug = (getenv("WAYLAND_DEBUG") != NULL);

    while (true) {
        if (epoll_wait(proxy->epoll_fd, &ev, 1, -1) < 0) {
            if (errno == EINTR) continue; // Ignore e.g. GDB interrupts
            perror("epoll_wait");
            return -1;
        }

        if (ev.events & EPOLLHUP && ev.data.ptr != NULL) {
            // Client disconnected
            proxy_destroy_session(((struct proxy_conn*)(ev.data.ptr))->session);
            if (proxy->session_count == 0)
                return 0;

        } else if (ev.events & EPOLLIN && ev.data.ptr == NULL) {
            // Client connected
            client_fd = socket_data(proxy->socket->fd, 0, NULL);
            if (client_fd < 0)
                return -1;
            if (proxy_create_session(proxy, client_fd) < 0) {
                close(client_fd);
                return -1;
            }

        } else if (ev.events & EPOLLIN && ev.data.ptr != NULL) {
            // Client sent data
            if (proxy_handle_data(ev.data.ptr) < 0)
                return -1;
        }
    }
}

/*
 * Destroy a Wayland proxy and free its resources
 */
void proxy_destroy(struct proxy *proxy) {
    assert(proxy->session_count == 0);
    wl_socket_destroy(proxy->socket);
    close(proxy->epoll_fd);
    free(proxy);
}
