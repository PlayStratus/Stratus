/*
 * Wayland client resizing logic
 *
 * Enforces desired client dimensions by modifying messages advertising monitor
 * sizes and the compositor's preferred window size. The client is also
 * configured to be in fullscreen mode, while the compositor is prevented from
 * actually displaying the client in fullscreen mode. Note that the specified
 * client dimensions cannot be changed after startup.
 */

#include <assert.h>
#include <stdbool.h>
#include <stdint.h>

#include "capture-priv.h"
#include "resize-pub.h"

/*
 * Required Wayland protocol interfaces
 */
extern const struct wl_interface xdg_toplevel_interface;

/*
 * Handle a xdg_surface@get_toplevel request
 *
 * Emits a xdg_toplevel@configure event to enforce desired client dimensions.
 */
enum proxy_actions xdg_surface_get_toplevel(struct proxy_message *msg) {
    struct wl_closure *res;
    union wl_argument args[3];
    struct capture_data *capture_data;

    // Send configure event requesting desired surface dimensions
    capture_data = msg->conn->session->proxy->userdata;
    args[0].i = capture_data->width;
    args[1].i = capture_data->height;
    args[2].a = malloc(sizeof(struct wl_array));
    if (args[2].a == NULL)
        goto err_malloc;
    wl_array_init(args[2].a);
    if (wl_array_add(args[2].a, 6) == NULL)
        goto err_add;
    ((uint32_t*)args[2].a->data)[0] = 2; // set fullscreen state
    ((uint32_t*)args[2].a->data)[1] = 4; // set activated state
    ((uint32_t*)args[2].a->data)[2] = 5; // set tiled_left state
    ((uint32_t*)args[2].a->data)[3] = 6; // set tiled_right state
    ((uint32_t*)args[2].a->data)[4] = 7; // set tiled_top state
    ((uint32_t*)args[2].a->data)[5] = 8; // set tiled_bottom state
    res = wl_closure_init(&xdg_toplevel_interface.events[0], 0, NULL, args);
    res->sender_id = msg->closure->args[0].n;
    res->opcode = 0; // xdg_toplevel event #0 is configure event
    if (wl_closure_send(res, msg->conn->session->client->wl_conn) < 0)
        goto err_send;
    wl_closure_destroy(res);

    return PROXY_ACTION_FWD;

err_send:
    wl_closure_destroy(res);
err_add:
    free(args[2].a);
err_malloc:
    return PROXY_ACTION_ERR;
}

/*
 * Handle a xdg_toplevel@configure event
 *
 * Drops all messages.
 */
enum proxy_actions xdg_toplevel_configure(struct proxy_message *msg) {
    // We will send our own configure events manually in
    // xdg_surface_get_toplevel()
    return PROXY_ACTION_DROP;
}

/*
 * Handle a xdg_toplevel@set_fullscreen request
 *
 * Drops all messages.
 */
enum proxy_actions xdg_toplevel_set_fullscreen(struct proxy_message *msg) {
    return PROXY_ACTION_DROP;
}

/*
 * Handle a wl_output@mode event
 *
 * Enforces desired client dimensions.
 */
enum proxy_actions wl_output_mode(struct proxy_message *msg) {
    struct capture_data *capture_data;

    capture_data = msg->conn->session->proxy->userdata;
    msg->closure->args[1].i = capture_data->width;
    msg->closure->args[2].i = capture_data->height;

    return PROXY_ACTION_FWD;
}

/*
 * The Wayland message handlers for client resizing
 */
const struct message_handler resize_message_handlers[] = {
    { "xdg_surface",  "get_toplevel",   &xdg_surface_get_toplevel    },
    { "xdg_toplevel", "configure",      &xdg_toplevel_configure      },
    { "xdg_toplevel", "set_fullscreen", &xdg_toplevel_set_fullscreen },
    { "wl_output",    "mode",           &wl_output_mode              },

    { NULL,           NULL,             NULL                         },
};
