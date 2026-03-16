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

    // For testing purposes, the game UUID can be set via an environment
    // variable and doesn't strictly need to be a UUID (it just needs to be less
    // than UUID_LEN characters). The default here is "sleep".
    char *game_id = getenv("STRATUSD_GAME_UUID");
    if (game_id == NULL)
        game_id = "sleep";

    char *output_file = getenv("STRATUSD_OUTPUT_FILE");
    if (output_file == NULL)
        output_file = "encode_output.h264";

    ctx.active_session = session_start(game_id, 640, 480, output_file);
    if (ctx.active_session == NULL)
        return -1;

    while (session_poll(ctx.active_session) == 0) {
        sleep(1);
    }

    session_teardown(ctx.active_session);

    return 0;
}
