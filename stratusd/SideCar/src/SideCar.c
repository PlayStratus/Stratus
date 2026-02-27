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

#include "session.h"
#include "sidecar-priv.h"
#include "version.h"

/*
 * Contains heartbeat data
 */
struct heartbeat {
    char *hostname;
    char *version;

    char **games;       // NULL-terminated array of UUIDs
    char **sessions;    // NULL-terminated array of UUIDs

    long uptime;        // in seconds
    float cpu_load;     // 60 second load average
    int cpu_count;
    long ram_used;      // in bytes
    long ram_total;     // in bytes
    long disk_used;     // in bytes
    long disk_total;    // in bytes
};

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
    struct heartbeat msg;

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

    printf("[Sidecar] Heartbeat:\n");
    printf("\tSessions: %s\n", sessions[0]);
    printf("\tUptime: %lds\n", msg.uptime);
    printf("\tCPU: %f / %d\n", msg.cpu_load, msg.cpu_count);
    printf("\tRAM: %ldM / %ldM\n", msg.ram_used / 1024 / 1024,
           msg.ram_total / 1024 / 1024);
    printf("\tDisk: %ldM / %ldM\n", msg.disk_used / 1024 / 1024,
           msg.disk_total / 1024 / 1024);

    return 0;
}

/*
 * Run the sidecar module
 *
 * Returns 0 on success and -1 on failure.
 */
int sidecar_main() {
    struct sidecar_context ctx;

    ctx.active_session = NULL;

    fprintf(stderr, "[Sidecar] Starting sidecar module...\n");

    sidecar_heartbeat(&ctx);

    // For testing purposes, the game UUID can be set via an environment
    // variable and doesn't strictly need to be a UUID (it just needs to be less
    // than UUID_LEN characters). The default here is "sleep".
    char *game_id = getenv("STRATUSD_GAME_UUID");
    if (game_id == NULL)
        game_id = "sleep";

    char *output_file = getenv("STRATUSD_OUTPUT_FILE");
    if (output_file == NULL)
        output_file = "encode_output.h264";

    ctx.active_session = session_start("01234567-89ab-cdef-0123-456789abcdef",
                                       game_id, 640, 480, output_file);
    if (ctx.active_session == NULL)
        return -1;

    sidecar_heartbeat(&ctx);

    do {
        sidecar_heartbeat(&ctx);
        sleep(1);
    } while (session_poll(ctx.active_session) == 0);

    session_teardown(ctx.active_session);

    return 0;
}
