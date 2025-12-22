#include <assert.h>
#include <errno.h>
#include <stdio.h>
#include <sys/epoll.h>
#include <sys/param.h>
#include <unistd.h>

#include <wayland-client.h>
#include <wayland-private.h>
#include <wayland-server.h>

#include "proxy.h"

/*
 * Key interfaces defined in libs/wayland/protocols/*.c
 */
extern const struct wl_interface *linux_dmabuf_v1_types_all[];
extern const struct wl_interface *presentation_time_types_all[];
extern const struct wl_interface *tablet_v2_types_all[];
extern const struct wl_interface *viewporter_types_all[];
extern const struct wl_interface *wayland_types_all[];
extern const struct wl_interface *xdg_shell_types_all[];
extern const struct wl_interface wl_display_interface;

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
 * Initialize a proxy's client or server connection from a file descriptor
 *
 * This function must only be called once per connection type per proxy
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_add_connection(struct proxy *proxy, int fd, int side) {
    struct proxy_conn **conn = (side == SIDE_SERVER) ? &proxy->server :
        &proxy->client;
    assert(*conn == NULL); // The connection must not already exist

    *conn = malloc(sizeof(struct proxy_conn));
    if (*conn == NULL)
        goto err_malloc;

    (*conn)->side = side;
    (*conn)->proxy = proxy;

    (*conn)->wl_conn = wl_connection_create(fd, 0);
    if ((*conn)->wl_conn == NULL)
        goto err_conn;

    if (proxy_epoll_add_fd(proxy, fd, *conn) < 0)
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
 * Destroy a connection struct and free its resources
 */
static void proxy_destroy_connection(struct proxy_conn *conn) {
    int fd = wl_connection_destroy(conn->wl_conn);
    close(fd);
    free(conn);
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
 * Handle a Wayland message received by a proxy
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_handle_message(struct proxy_conn *src, int id,
                                        int size, int opcode) {
    int ret, i, arg_count;
    const char *signature;
    const struct wl_interface *interface, *bind_interface;
    struct wl_message message;
    struct wl_closure *closure;
    struct wl_object target;
    struct argument_details arg;
    struct proxy_conn *dst;
    struct proxy_message msg;

    // Lookup message format
    interface = wl_map_lookup(src->proxy->objects, id);
    if (interface == NULL)
        goto err_pre_closure;

    // Parse message
    message = (src->side == SIDE_CLIENT) ? interface->methods[opcode] :
                                           interface->events[opcode];
    closure = wl_connection_demarshal(src->wl_conn, size,
                                      src->proxy->objects, &message);
    if (closure == NULL)
        goto err_pre_closure;

    ret = 1;
    if (!strcmp(interface->name, "wl_registry") &&
        !strcmp(message.name, "global") &&
        !proxy_lookup_interface(closure->args[1].s)) {

        // Drop wl_registry.global events for unsupported interfaces
        ret = 0;
    }

    // Run custom message handler
    if (ret == 1 && src->proxy->on_message != NULL) {
        msg.conn = src;
        msg.interface = interface;
        msg.closure = closure;
        ret = (*src->proxy->on_message)(&msg);
        if (ret < 0)
            goto err_post_closure;
    }

    if (ret == 1 && !strcmp(interface->name, "wl_registry") &&
        !strcmp(message.name, "bind")) {

        // Record type of newly bound interface
        bind_interface = proxy_lookup_interface(closure->args[1].s);
        if (bind_interface == NULL)
            goto err_post_closure;
        if (wl_map_insert_at(src->proxy->objects, 0, closure->args[3].n,
                             (void*)bind_interface) < 0)
            goto err_post_closure;

    } else if (ret == 1) {
        // Record types of new objects
        signature = closure->message->signature;
        arg_count = arg_count_for_signature(signature);
        for (i = 0; i < arg_count; i++) {
            signature = get_next_argument(signature, &arg);
            if (arg.type == WL_ARG_NEW_ID) {
                if (wl_map_insert_at(src->proxy->objects, 0,
                                     closure->args[i].n,
                                     (void*)message.types[0]) < 0)
                    goto err_post_closure;
            }
        }
    }

    if (ret == 1) {
        // Proxy message
        dst = (src->side == SIDE_CLIENT) ? src->proxy->server : src->proxy->client;
        assert(dst != NULL); // The opposite connection must already exist
        if (wl_closure_send(closure, dst->wl_conn) < 0)
            goto err_post_closure;
    }

    wl_closure_destroy(closure);
    return ret;

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
    dst = (src->side == SIDE_CLIENT) ? src->proxy->server : src->proxy->client;
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

    // Connect to server
    server_fd = connect_to_socket(NULL);
    if (server_fd < 0)
        goto err_server_socket;
    if (proxy_add_connection(proxy, server_fd, SIDE_SERVER) < 0)
        goto err_server_conn;

    // Initialize object map
    proxy->objects = malloc(sizeof(struct wl_map));
    if (proxy->objects == NULL)
        goto err_malloc;
    wl_map_init(proxy->objects, WL_MAP_CLIENT_SIDE);
    wl_map_insert_new(proxy->objects, 0, NULL);
    wl_map_insert_new(proxy->objects, 0, (void*)&wl_display_interface);

    return proxy;

err_malloc:
    proxy_destroy_connection(proxy->server);
err_server_conn:
    close(server_fd);
err_server_socket:
    wl_socket_destroy(proxy->socket);
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

    printf("Starting Wayland proxy on $XDG_RUNTIME_DIR/%s\n", proxy->name);
    while (true) {
        if (epoll_wait(proxy->epoll_fd, &ev, 1, -1) < 0) {
            if (errno == EINTR) continue; // Ignore e.g. GDB interrupts
            perror("epoll_wait");
            return -1;
        }

        if (ev.events & EPOLLHUP) {
            // Client disconnected
            printf("Client disconnected\n");
            return 0;

        } else if (ev.events & EPOLLIN && ev.data.ptr == NULL) {
            // Client connected
            if (proxy->client != NULL) {
                fprintf(stderr, "Error: A second client tried to connect\n");
                return -1;
            }
            client_fd = socket_data(proxy->socket->fd, 0, NULL);
            if (client_fd < 0)
                return -1;
            if (proxy_add_connection(proxy, client_fd, SIDE_CLIENT) < 0) {
                close(client_fd);
                return -1;
            }
            printf("Client connected\n");

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
    if (proxy->client != NULL)
        proxy_destroy_connection(proxy->client);
    if (proxy->server != NULL)
        proxy_destroy_connection(proxy->server);
    wl_socket_destroy(proxy->socket);
    wl_map_release(proxy->objects);
    free(proxy->objects);
    close(proxy->epoll_fd);
    free(proxy);
}
