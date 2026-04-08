/*
 * Stratusd SideCar implementation
 *
 * Manages high-level stream sessions in response to API events.
 */

#include <assert.h>
#include <errno.h>
#include <dirent.h>
#include <sensors/sensors.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
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
#define HEARTBEAT_INTERVAL 30

/*
 * The maximum number of installed games that can be detected
 */
#define MAX_GAMES 16

/*
 * Get the first temperature of the first sensor found resembling a CPU
 *
 * Returns the temperature in Celsius on success and 0 on failure.
 */
static float get_cpu_temperature() {
    int i, j;
    double temp = 0;
    const sensors_chip_name *chip;
    const sensors_feature *feature;
    const sensors_subfeature *subfeature;

    if (sensors_init(NULL) != 0) {
        fprintf(stderr, "[SideCar] sensors_init failed\n");
        return 0;
    }

    i = 0;
    while ((chip = sensors_get_detected_chips(NULL, &i)) != NULL) {
        if ((strstr(chip->prefix, "cpu") != NULL) ||
            (strcmp(chip->prefix, "coretemp") == 0) ||
            (strcmp(chip->prefix, "k10temp") == 0) ||
            (strcmp(chip->prefix, "zenpower") == 0)) {

            // Chip prefix matchs a common CPU prefix (see tempDriverPriority in
            // linux/LibSensors.c of htop)

            j = 0;
            while ((feature = sensors_get_features(chip, &j)) != NULL) {
                if (feature->type == SENSORS_FEATURE_TEMP) {
                    subfeature = sensors_get_subfeature(chip, feature, SENSORS_SUBFEATURE_TEMP_INPUT);
                    if (subfeature) {
                        if (!sensors_get_value(chip, subfeature->number, &temp))
                            goto end;
                    }
                }
            }
        }
    }

end:
    sensors_cleanup();
    return temp;
}

/*
 * Perform a heartbeat and send it to the backend server
 *
 * Returns 0 on success and -1 on failure.
 */
int sidecar_heartbeat(struct sidecar_context *ctx) {
    int i = 0, ret;
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
        goto err_opendir;
    }
    errno = 0;
    while (i < MAX_GAMES && (ent = readdir(dir)) != NULL) {
        if (ent->d_name[0] != '.')
            games[i++] = ent->d_name;
    }
    if (errno != 0) {
        perror("[Sidecar] readdir");
        goto err_post_opendir;
    }
    games[i] = NULL;

    // Get system stats
    if (gethostname(hostname, HOST_NAME_MAX) < 0) {
        perror("[Sidecar] gethostname");
        goto err_post_opendir;
    }
    if (sysinfo(&info) < 0) {
        perror("[Sidecar] sysinfo");
        goto err_post_opendir;
    }
    if (statfs("/", &fs) < 0) {
        perror("[Sidecar] statfs");
        goto err_post_opendir;
    }

    msg.hostname = hostname;
    msg.ip = getenv("STRATUSD_IP");
    if (msg.ip == NULL)
        msg.ip = "127.0.0.1";
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
    msg.temperature = get_cpu_temperature();

    ret = api_send_heartbeat(ctx->api_client, &msg);

    closedir(dir);
    return ret;

err_post_opendir:
    closedir(dir);
err_opendir:
    return -1;
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
    char *test_api_msg;

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

    // Send test API message to Api client
    test_api_msg = getenv("STRATUSD_API_MSG");
    if (test_api_msg != NULL)
        api_recv(ctx.api_client, test_api_msg);

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
            if (getenv("STRATUSD_SIDECAR_ONESHOT") != NULL)
                break;
        }

        if (api_poll(ctx.api_client, 100) == -1)
            break;
    }

    api_teardown(ctx.api_client);
    if (ctx.active_session != NULL)
        session_teardown(ctx.active_session);

    return -1;
}
