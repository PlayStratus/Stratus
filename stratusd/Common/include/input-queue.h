#ifndef COMMON_INPUT_QUEUE_H
#define COMMON_INPUT_QUEUE_H

/*
 * This header file contains definitions shared between the Transport and Int
 * modules for their input queue.
 */

#include <unistd.h>

/*
 * Contains data for a single input message
 */
struct input_queue_msg {
    const char *data;
    ssize_t length;
    void *cpp_str;
};

#endif
