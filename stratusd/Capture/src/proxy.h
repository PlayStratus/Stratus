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
 * Data for a Wayland proxy between the system compositor (server) and at most
 * one application (client)
 */
struct proxy {
    char *name;

    // The remaining members aren't meant to be accessed outside of proxy.c:
    int epoll_fd;
    struct wl_socket *socket;
    struct proxy_conn *client;
    struct proxy_conn *server;
};

struct proxy *proxy_init(char *name);

int proxy_run(struct proxy *proxy);

void proxy_destroy(struct proxy *proxy);

#endif
