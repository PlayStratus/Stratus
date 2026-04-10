#ifndef CAPTURE_VIDEO_OUTPUT_PRIV_H
#define CAPTURE_VIDEO_OUTPUT_PRIV_H

#include <stdbool.h>
#include <stdint.h>

#include "Common.h"

/*
 * Contains data for a wl_surface object
 */
struct wl_surface {
    uint32_t id;
    struct wl_buffer *buf;          // The currently attached buffer
    uint32_t dependents;
};



#endif
