#ifndef CAPTURE_VIDEO_OUTPUT_PUB_H
#define CAPTURE_VIDEO_OUTPUT_PUB_H

#include "capture-priv.h"

// generic message handlers for wl_buffers
capture_message_handler_func wl_buffer_release;
capture_message_handler_func wl_buffer_destroy;

// message handlers for wl_surfaces
capture_message_handler_func wl_compositor_create_surface;
capture_message_handler_func wl_surface_attach;
capture_message_handler_func wl_surface_commit;
capture_message_handler_func wl_surface_destroy;

#endif
