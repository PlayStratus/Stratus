#ifndef CAPTURE_PRIV_H
#define CAPTURE_PRIV_H

#include "proxy.h"

/*
 * The signature of a message-specific Wayland message handler function
 */
typedef enum proxy_actions capture_message_handler_func(
    struct proxy_message *msg);

#endif
