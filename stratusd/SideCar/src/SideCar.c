/*
 * Stratusd SideCar implementation
 *
 * Manages high-level stream sessions in response to API events.
 */

#include <assert.h>
#include <stdio.h>
#include <unistd.h>

#include "session.h"
#include "sidecar-priv.h"

/*
 * Run the sidecar module
 *
 * Returns 0 on success and -1 on failure.
 */
int sidecar_main() {
    struct sidecar_context ctx;

    ctx.active_session = NULL;

    fprintf(stderr, "[Sidecar] Starting sidecar module...\n");

    char *output_file = getenv("STRATUSD_OUTPUT_FILE");
    if (output_file == NULL)
        output_file = "encode_output.h264";

    ctx.active_session = session_start(640, 480, output_file);
    if (ctx.active_session == NULL)
        return -1;

    session_wait(ctx.active_session);

    session_teardown(ctx.active_session);

    return 0;
}
