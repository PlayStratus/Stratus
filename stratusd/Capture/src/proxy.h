#ifndef CAPTURE_PROXY_H
#define CAPTURE_PROXY_H

#include <wayland-private.h>

struct proxy;

/*
 * Used to differentiate between a proxy's client and server connections
 */
enum proxy_sides {
    SIDE_CLIENT = 0,
    SIDE_SERVER = 1,
};

/*
 * Contains data for a proxy's client or server connection
 */
struct proxy_conn {
    enum proxy_sides side;
    struct wl_connection *wl_conn;
    struct proxy *proxy;
};

/*
 * Contains data associated with a received Wayland message
 */
struct proxy_message {
    struct proxy_conn *conn;
    const struct wl_interface *interface;
    struct wl_closure *closure;
};

/*
 * Signature of custom handler called when a proxy receives a Wayland message
 *
 * Should return 1 to proxy the message, 0 to swallow the message, and -1 if an
 * error occurred.
 */
typedef int (proxy_on_message_handler)(struct proxy_message *msg);

/*
 * Data for a Wayland proxy between the system compositor (server) and at most
 * one application (client)
 */
struct proxy {
    char *name;
    proxy_on_message_handler *on_message;

    int epoll_fd;
    struct wl_socket *socket;
    struct proxy_conn *client;
    struct proxy_conn *server;
    struct wl_map *objects;
};

struct proxy *proxy_init(char *name);

int proxy_run(struct proxy *proxy);

void proxy_destroy(struct proxy *proxy);

#endif
