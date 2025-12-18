#include <assert.h>
#include <stdio.h>
#include <sys/epoll.h>
#include <unistd.h>

#include <wayland-client.h>
#include <wayland-private.h>
#include <wayland-server.h>

#include "proxy.h"

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
 * Handles data received by a proxy
 *
 * Returns 0 on success and -1 on failure
 */
static int proxy_handle_data(struct proxy_conn *src) {
    char buf[WL_MAX_MESSAGE_SIZE];
    int len, size, fd;
    struct proxy_conn *dst;

    dst = (src->side == SIDE_CLIENT) ? src->proxy->server : src->proxy->client;
    assert(dst != NULL); // The opposite connection must already exist

    len = wl_connection_read(src->wl_conn);
    while (len >= 2 * sizeof(uint32_t)) {
        // Parse size of next message
        wl_connection_copy(src->wl_conn, buf, 2 * sizeof(uint32_t));
        size = ((uint32_t*)buf)[1] >> 16;
        len -= size;
        assert(size <= WL_MAX_MESSAGE_SIZE);

        // Proxy message data
        wl_connection_copy(src->wl_conn, buf, size);
        wl_connection_consume(src->wl_conn, size);
        if (wl_connection_write(dst->wl_conn, buf, size) < 0)
            return -1;

        // Proxy message file descriptors
        while ((fd = wl_connection_pop_fd(src->wl_conn)) >= 0) {
            if (wl_connection_put_fd(dst->wl_conn, fd) < 0)
                return -1;
        }
    }
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

    return proxy;

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
        if (epoll_wait(proxy->epoll_fd, &ev, 1, -1) < 0)
            return -1;

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
    close(proxy->epoll_fd);
    free(proxy);
}
