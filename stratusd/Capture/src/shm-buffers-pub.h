#ifndef CAPTURE_SHM_BUFFERS_PUB_H
#define CAPTURE_SHM_BUFFERS_PUB_H

#include "capture-priv.h"

// message handlers for shm-backed wl_buffers
capture_message_handler_func wl_shm_format;
capture_message_handler_func wl_shm_create_pool;
capture_message_handler_func wl_shm_pool_destroy;
capture_message_handler_func wl_shm_pool_create_buffer;

#endif
