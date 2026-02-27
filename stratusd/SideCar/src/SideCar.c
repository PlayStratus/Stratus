/*
 * Stratusd SideCar implementation
 *
 * Manages high-level stream sessions in response to API events.
 */

#include <assert.h>
#include <dirent.h>
#include <stdio.h>
#include <sys/sysinfo.h>
#include <sys/vfs.h>
#include <unistd.h>

#include "api.h"
#include "session.h"
#include "sidecar-priv.h"
#include "version.h"

/*
 * The number of seconds between heartbeat messages
 */
#define HEARTBEAT_INTERVAL 60

/*
 * The maximum number of installed games that can be detected
 */
#define MAX_GAMES 16

/*
 * Perform a heartbeat and send it to the backend server
 *
 * Returns 0 on success and -1 on failure.
 */
int sidecar_heartbeat(struct sidecar_context *ctx) {
    int i = 0;
    char hostname[HOST_NAME_MAX], *sessions[2], *game_dir, *games[MAX_GAMES];
    DIR *dir;
    struct dirent *ent;
    struct sysinfo info;
    struct statfs fs;
    struct api_msg_heartbeat msg;

    fprintf(stderr, "[Sidecar] Sending heartbeat...\n");

    // Get list of installed games
    if ((game_dir = getenv("STRATUSD_GAME_DIR")) == NULL)
        game_dir = DEFAULT_GAME_DIR;
    if ((dir = opendir(game_dir)) == NULL) {
        perror("[Sidecar] opendir");
        return -1;
    }
    errno = 0;
    while (i < MAX_GAMES && (ent = readdir(dir)) != NULL) {
        if (ent->d_name[0] != '.')
            games[i++] = ent->d_name;
    }
    if (errno != 0) {
        perror("[Sidecar] readdir");
        return -1;
    }
    games[i] = NULL;

    // Get system stats
    if (gethostname(hostname, HOST_NAME_MAX) < 0) {
        perror("[Sidecar] gethostname");
        return -1;
    }
    if (sysinfo(&info) < 0) {
        perror("[Sidecar] sysinfo");
        return -1;
    }
    if (statfs("/", &fs) < 0) {
        perror("[Sidecar] statfs");
        return -1;
    }

    msg.hostname = hostname;
    msg.version = STRATUSD_VERSION;

    sessions[0] = ctx->active_session == NULL ? NULL : ctx->active_session->id;
    sessions[1] = NULL;
    msg.sessions = sessions;
    msg.games = games;

    msg.uptime = info.uptime;
    msg.cpu_load = info.loads[0] * (1.f / (1 << SI_LOAD_SHIFT));
    msg.cpu_count = get_nprocs();
    msg.ram_used = (info.totalram - info.freeram) * info.mem_unit;
    msg.ram_total = info.totalram * info.mem_unit;
    msg.disk_used = (fs.f_blocks - fs.f_bfree) * fs.f_bsize;
    msg.disk_total = fs.f_blocks * fs.f_bsize;
    msg.temperature = 0; // TODO

    return api_send_heartbeat(ctx->api_client, &msg);
}

/*
 * Start a stream session according to the specified parameters
 *
 * Returns 0 on success and -1 on failure.
 */
int sidecar_on_start_session(struct sidecar_context *ctx,
                             struct api_msg_start_session *data) {
    fprintf(stderr, "[Sidecar] Starting session %s...\n", data->session_id);

    assert(ctx->active_session == NULL);

    char *output_file = getenv("STRATUSD_OUTPUT_FILE");
    if (output_file == NULL)
        output_file = "encode_output.h264";

    ctx->active_session = session_start(data->session_id, data->game_id,
                                        data->width, data->height, output_file);
    if (ctx->active_session == NULL) {
        api_send_session_error(ctx->api_client, data->session_id,
                               "Failed to start session");
        return -1;
    }
    else {
        return api_send_confirm_start(ctx->api_client, data->session_id,
                                      "(TLS fingerprint)");
    }
}

/*
 * Stop a stream session
 *
 * Returns 0 on success and -1 on failure.
 */
int sidecar_on_stop_session(struct sidecar_context *ctx, char *session_id) {
    fprintf(stderr, "[Sidecar] Stopping session %s...\n", session_id);

    assert(ctx->active_session != NULL);
    assert(ctx->active_session->id == session_id);
    session_teardown(ctx->active_session);
    ctx->active_session = NULL;

    // Send another heartbeat with an updated list of active sessions
    return sidecar_heartbeat(ctx);
}

/*
 * Run the sidecar module
 *
 * Returns 0 on success and -1 on failure.
 */
int sidecar_main() {
    struct sidecar_context ctx;
    time_t last_heartbeat;

    fprintf(stderr, "[Sidecar] Starting sidecar module...\n");

    // Initialize sidecar context
    ctx.active_session = NULL;
    ctx.api_client = api_init();
    if (ctx.api_client == NULL)
        return -1;
    ctx.api_client->userdata = &ctx;
    ctx.api_client->on_start_session =
        (api_start_session_msg_handler*)&sidecar_on_start_session;
    ctx.api_client->on_stop_session =
        (api_stop_session_msg_handler*)&sidecar_on_stop_session;

    // // TODO: used for testing, remove once fully integrated with the backend
    // api_recv(ctx.api_client, "{\
    //     \"type\": \"start_session\",\
    //     \"timestamp\": \"2026-02-27 18:00:00\",\
    //     \"request_id\": \"b50e8400-e29b-41d4-a716-446655440000\",\
    //     \"payload\": {\
    //         \"session_id\": \"550e8400-e29b-41d4-a716-446655440001\",\
    //         \"game_id\": \"sleep\",\
    //         \"width\": 640,\
    //         \"height\": 480,\
    //         \"session_token\": \"b020ea96-83c0-46a8-aac0-0954abd1c8ac\",\
    //         \"user_id\": \"7341faed-f80e-457e-a71e-789214869c04\",\
    //         \"user_name\": \"Alice\"\
    //     }\
    // }");

    // Main event loop
    last_heartbeat = 0;
    while (1) {
        if (time(NULL) - last_heartbeat > HEARTBEAT_INTERVAL) {
            sidecar_heartbeat(&ctx);
            last_heartbeat = time(NULL);
        }

        if (ctx.active_session != NULL && session_poll(ctx.active_session) != 0)
        {
            api_send_stop_session(ctx.api_client, ctx.active_session->id);
            sidecar_on_stop_session(&ctx, ctx.active_session->id);
        }

        if (api_poll(ctx.api_client, 100) == -1)
            break;
    }

    api_teardown(ctx.api_client);
    if (ctx.active_session != NULL)
        session_teardown(ctx.active_session);

    return -1;
}
