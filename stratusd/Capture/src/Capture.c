#include <stdio.h>
#include <stdlib.h>
#include <wayland-server.h>

int capture_test() {

    struct wl_display *server_display = wl_display_create();
    if (!server_display) {
        fprintf(stderr, "Unable to create Wayland display.\n");
        return -1;
    }

    if (wl_display_add_socket(server_display, "stratus")) {
        fprintf(stderr, "Unable to add socket to Wayland display.\n");
        return -1;
    }

    printf("Running wayland server on $XDG_RUNTIME_DIR/stratus socket\n");
    wl_display_run(server_display);

    wl_display_destroy(server_display);
    return 0;
}
