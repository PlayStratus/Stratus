/*
 * Stream session management logic
 *
 * Responsible for starting and stopping the games and all other modules for
 * each stream session.
 */

#include <assert.h>
#include <sys/wait.h>
#include <unistd.h>

#include "session.h"

/*
 * The maximum length of the filepath of a game, NULL terminator included
 */
#define MAX_GAME_PATH 128

/*
 * Forcibly stop a stream session and free its resources
 */
void session_teardown(struct session *session) {
    if (session == NULL) return;

    // Kill module threads and make sure they're dead
    if (session->capture_thread != 0) {
        pthread_cancel(session->capture_thread);
        pthread_join(session->capture_thread, NULL);
    }
    if (session->input_thread != 0) {
        pthread_cancel(session->input_thread);
        pthread_join(session->input_thread, NULL);
    }

    // Teardown modules
    if (session->capture != NULL)
        capture_destroy(session->capture);
    if (session->input != NULL)
        input_destroy(session->input);

    // Check to make sure game has exited (either gracefully in response to user
    // input, or abruptly due to the Wayland proxy socket being closed).
    // Note: We can't just kill the game by sending a SIGKILL because it won't
    // be passed to AppImage child processes correctly.
    if (session->game_pid != 0) {
        if (waitpid(session->game_pid, NULL, WNOHANG) != session->game_pid)
            fprintf(stderr, "[SideCar] Warning: game did not terminate "
                    "(PID=%d)\n", session->game_pid);
    }

    free(session);
}

/*
 * Launch a game
 *
 * Returns the PID of the child game process on success and -1 on failure.
 */
static int session_launch_game(char *game_id) {
    int pid;
    char game_path[MAX_GAME_PATH];
    char *argv[2];
    char *game_dir;

    // Load game_dir config
    game_dir = getenv("STRATUSD_GAME_DIR");
    if (game_dir == NULL)
        game_dir = DEFAULT_GAME_DIR;

    assert(game_id != NULL);
    assert(strlen(game_dir) + 1 + UUID_LEN < MAX_GAME_PATH);

    // Generate game arguments
    if (snprintf(game_path, MAX_GAME_PATH, "%s/%s", game_dir, game_id) < 0) {
        perror("[Sidecar] sprintf");
        return -1;
    }
    argv[0] = game_path;
    argv[1] = NULL;

    pid = fork();
    if (pid < 0) {
        perror("[Sidecar] fork");
        return -1;
    } else if (pid == 0) {
        // Child process

        // Set environment variables
        if (setenv("WAYLAND_DISPLAY", "stratus", 1) < 0) {
            perror("[Sidecar] setenv");
            exit(1);
        }

        execvp(argv[0], argv);

        perror("[Sidecar] execvp");
        exit(1);
    } else {
        // Parent process
        return pid;
    }
}

/*
 * Create and start a new stream session
 *
 * Returns the crated session struct on success and NULL on failure.
 */
struct session *session_start(char *game_id, int width, int height,
                              char *encode_output) {
    struct session *session;

    // Create session struct
    session = malloc(sizeof(struct session));
    if (session == NULL) {
        perror("[Sidecar] malloc");
        goto err;
    }
    memset(session, 0x00, sizeof(struct session));
    strncpy(session->game_id, game_id, UUID_LEN);

    // Initialize modules
    // Order is important here! Some modules must be initialized before others.
    session->capture = capture_init(encode_output, width, height, NULL);
    if (session->capture == NULL)
        goto err;
    session->input = input_init();
    if (session->input == NULL)
        goto err;

    // Start modules in separate threads
    pthread_create(&session->capture_thread, NULL, (void *)&capture_run,
                   session->capture);
    pthread_create(&session->input_thread, NULL, (void *)&input_run,
                   session->input);

    // Start game
    session->game_pid = session_launch_game(session->game_id);
    if (session->game_pid < 0)
        goto err;

    return session;

err:
    session_teardown(session);
    return NULL;
}

/*
 * Check to see if game has exited
 *
 * Returns 1 if the game has exited, 0 if it has not, and -1 on failure.
 */
int session_poll(struct session *session) {
    if (session->game_pid == 0) {
        // Game has already exited
        return 1;
    }

    int ret = waitpid(session->game_pid, NULL, WNOHANG);
    if (ret < 0) {
        perror("[Sidecar] waitpid");
        return -1;
    } else if (ret > 0) {
        // Game has exited - clear game_pid so we don't try to wait on it again
        session->game_pid = 0;
        return 1;
    }

    return 0;
}
