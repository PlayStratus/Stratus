#include <stdio.h>
#include <stdlib.h>
#include <sys/epoll.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

#include "wayland-os.h"
#include "connection.c"
#include "wayland-private.h"

// CLIENT (app)    <==>    MITM (stratusd)    <==>    SERVER (compositor)

struct wl_socket {
    int fd;
    int fd_lock;
    struct sockaddr_un addr;
    char lock_addr[108 + 5];
};

struct connection {
    struct wl_connection *wl_conn;
    struct connection *peer;
    int is_client;
};

int wayland_poc() {
    printf("Starting wayland POC\n");

    // Create, bind to, and listen on main proxy socket,
    // $XDG_RUNTIME_DIR/wayland-9 which must NOT exist already
    const char *runtime_dir = getenv("XDG_RUNTIME_DIR");
    const char *name = "wayland-9";
    struct wl_socket *s = malloc(sizeof *s);
    s->fd = wl_os_socket_cloexec(PF_LOCAL, SOCK_STREAM, 0);
    memset(&s->addr, 0, sizeof s->addr);
    s->addr.sun_family = AF_LOCAL;
    int name_size = snprintf(s->addr.sun_path, sizeof s->addr.sun_path, "%s/%s",
                             runtime_dir, name) + 1;
    int size = offsetof (struct sockaddr_un, sun_path) + name_size;
    if (bind(s->fd, (struct sockaddr *) &s->addr, size) < 0) {
        perror("bind");
        return 1;
    }
    if (listen(s->fd, 1) < 0) {
        perror("listen");
        return 1;
    }

    // Setup epoll and add our main proxy socket to it
    int epoll_fd;
    if ((epoll_fd = epoll_create1(0)) < 0) {
        perror("epoll_create1");
        return 1;
    }
    struct epoll_event ev;
    ev.events = EPOLLIN;
    ev.data.ptr = NULL;
    epoll_ctl(epoll_fd, EPOLL_CTL_ADD, s->fd, &ev);

    while (true) {
        if (epoll_wait(epoll_fd, &ev, 1, -1) < 0) {
            perror("epoll_wait");
            return 1;
        }
        if (ev.events & EPOLLIN) {
            // An event occured on one of our sockets

            if (ev.data.ptr == NULL) {
                // A new client connected to the main proxy socket
                printf("new client!\n");

                // Accept and create a connection with the client
                struct sockaddr_un name;
                int len = sizeof name;
                int client_fd;
                if ((client_fd = wl_os_accept_cloexec(s->fd, (struct sockaddr *)
                                                     &name, &len)) < 0) {
                    perror("wl_os_accept_cloexec");
                    return 1;
                }

                // Create a connection to the real wayland server, which must
                // be running on $XDG_RUNTIME_DIR/wayland-1
                const char *real_name = "wayland-1";
                struct sockaddr_un addr;
                socklen_t addr_size;
                int s_fd = wl_os_socket_cloexec(PF_LOCAL, SOCK_STREAM, 0);
                memset(&addr, 0, sizeof s->addr);
                addr.sun_family = AF_LOCAL;
                name_size = snprintf(addr.sun_path, sizeof addr.sun_path,
                                     "%s/%s", runtime_dir, real_name) + 1;
                size = offsetof (struct sockaddr_un, sun_path) + name_size;
                if (connect(s_fd, (struct sockaddr *) &addr, size) < 0) {
                    perror("connect");
                    return 1;
                }

                // Record data for this client/server socket pair
                struct connection *s_conn = malloc(sizeof (struct connection));
                struct connection *c_conn = malloc(sizeof (struct connection));
                s_conn->wl_conn = wl_connection_create(s_fd);
                c_conn->wl_conn = wl_connection_create(client_fd);
                s_conn->peer = c_conn;
                c_conn->peer = s_conn;
                s_conn->is_client = 0;
                c_conn->is_client = 1;

                // Register both fds with epoll
                ev.events = EPOLLIN;
                ev.data.ptr = s_conn;
                epoll_ctl(epoll_fd, EPOLL_CTL_ADD, s_fd, &ev);
                ev.data.ptr = c_conn;
                epoll_ctl(epoll_fd, EPOLL_CTL_ADD, client_fd, &ev);
            } else {
                // An existing client or server sent us data
                struct connection *conn = (struct connection *) ev.data.ptr;
                int total, rem, size;

                // Process the Wire message
                total = wl_connection_read(conn->wl_conn);
                for (rem = total; rem >= 8; rem -= size) {
                    // Read message
                    char buf[4096];
                    size = wl_buffer_size(&conn->wl_conn->in);
                    if (size == 0) break;
                    wl_connection_copy(conn->wl_conn, buf, size);
                    printf("Received %d bytes from %d\n", size, conn->is_client);
                    wl_connection_consume(conn->wl_conn, size);

                    // Proxy message to peer connection
                    wl_connection_write(conn->peer->wl_conn, buf, size);

                    // Proxy file descriptors, if any
                    int fdlen = wl_buffer_size(&conn->wl_conn->fds_in);
                    wl_buffer_copy(&conn->wl_conn->fds_in, buf, fdlen);
                    fdlen /= sizeof(int32_t);
                    if (fdlen != 0)
                        printf("\t(including %d fds)\n", fdlen);
                    for (int i = 0; i < fdlen; i++) {
                        wl_connection_put_fd(conn->peer->wl_conn, ((int *) buf)[i]);
                    }
                    conn->wl_conn->fds_in.tail += fdlen * sizeof(int32_t);
                }
                wl_connection_flush(conn->peer->wl_conn);
            }
        }
    }

    return 0;
}
