#ifndef COMMON_AUDIO_TRANSPORT_QUEUE_H
#define COMMON_AUDIO_TRANSPORT_QUEUE_H

/*
 * This header file contains definitions shared between the Encode and Transport
 * modules for their audio transport queue.
 */

#include <stdbool.h>

/*
 * Contains data for a single captured frame
 */
struct audio_transport_queue_frame {
    int length;
    void *data;
    int transport_progress;
};

#endif
