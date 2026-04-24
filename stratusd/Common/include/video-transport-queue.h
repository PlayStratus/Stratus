#ifndef COMMON_VIDEO_TRANSPORT_QUEUE_H
#define COMMON_VIDEO_TRANSPORT_QUEUE_H

/*
 * This header file contains definitions shared between the Encode and Transport
 * modules for their video transport queue.
 */

#include <stdbool.h>

/*
 * Contains data for a single captured frame
 */
struct video_transport_queue_frame {
    int length;
    void *data;
    bool is_description;
};

#endif
