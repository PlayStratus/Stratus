#ifndef SIDECAR_H
#define SIDECAR_H

#include <stdint.h>

/*
 * Contains arguments that are provided to each module on startup
 *
 * In the future, this will also contain e.g. pointers to shared ring buffers.
 */
struct session_args {
    char *encode_output;
    uint32_t width;
    uint32_t height;
};

int sidecar_main();

#endif
