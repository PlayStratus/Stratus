#ifndef CAPTURE_PRIV_H
#define CAPTURE_PRIV_H

#include "proxy.h"
#include "Encode.h"

/*
 * Contains capture data associated with an instance of the Capture module
 */
struct capture_session {
    char *encode_output;
    uint32_t width;
    uint32_t height;
    struct proxy *proxy;
    struct video_context *video_context;
};

/*
 * The signature of a message-specific Wayland message handler function
 */
typedef enum proxy_actions capture_message_handler_func(
    struct proxy_message *msg);

/*
 * Contains data for a Wayland message handler
 */
struct message_handler {
    char *obj_name;
    char *msg_name;
    capture_message_handler_func *handler;
};

#endif
