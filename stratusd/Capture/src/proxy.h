#ifndef CAPTURE_PROXY_H
#define CAPTURE_PROXY_H

#include <wayland-private.h>

struct proxy;
struct proxy_session;

/*
 * Used to differentiate between a proxy's client and server connections
 */
enum proxy_sides {
    SIDE_CLIENT = 0,
    SIDE_SERVER = 1,
};

/*
 * Contains data for one of a proxy's client or server connections
 */
struct proxy_conn {
    enum proxy_sides side;
    struct wl_connection *wl_conn;
    struct proxy_session *session;
};

/*
 * Contains data for one of a proxy's client/server sessions
 */
struct proxy_session {
    struct proxy_conn *client;
    struct proxy_conn *server;
    struct wl_map *objects;
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
 * Signature of custom handler called when a new proxy session is created
 *
 * Should return 0 on success and -1 on failure.
 */
typedef int (proxy_on_session_create_handler)(struct proxy_session *session);

/*
 * Signature of custom handler called when a proxy session is destroyed
 */
typedef void (proxy_on_session_destroy_handler)(struct proxy_session *session);

/*
 * Signature of custom handler called when a proxy receives a Wayland message
 *
 * Should return 1 to proxy the message, 0 to swallow the message, and -1 if an
 * error occurred.
 */
typedef int (proxy_on_message_handler)(struct proxy_message *msg);

/*
 * Data for a Wayland proxy
 */
struct proxy {
    char *name;
    proxy_on_session_create_handler *on_session_create;
    proxy_on_session_destroy_handler *on_session_destroy;
    proxy_on_message_handler *on_message;

    int epoll_fd;
    struct wl_socket *socket;
    int session_count;
};

struct proxy *proxy_init(char *name);

int proxy_run(struct proxy *proxy);

void proxy_destroy(struct proxy *proxy);

#endif
