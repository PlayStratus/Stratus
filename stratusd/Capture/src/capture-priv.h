#ifndef CAPTURE_PRIV_H
#define CAPTURE_PRIV_H

#include "proxy.h"

/*
 * Contains capture data associated with a proxy instance
 *
 * This data will likely be absorbed into some sort of "game stream session"
 * struct in the future.
 */
struct capture_data {
    uint32_t width;
    uint32_t height;
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
