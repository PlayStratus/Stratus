/*
 * Stream session management logic
 *
 * Responsible for starting and stopping the games and all other modules for
 * each stream session.
 */

#include <assert.h>
#include <fcntl.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

#include "session.h"
#include "AudioEncode.h"
#include "Capture.h"
#include "CapturePw.h"
#include "Input.h"
#include "Transport.h"

/*
 * The maximum length of the filepath of a game, NULL terminator included
 */
#define MAX_GAME_PATH 128

/*
 * The maximum length of a dimensions string (e.g. NNNNxMMMM)
 */
#define MAX_DIMENSIONS_LEN 10

/*
 * Forcibly stop a stream session and free its resources
 */
void session_teardown(struct session *session) {
    struct audio_context *audio_context;

    if (session == NULL)
        return;

    audio_context = &session->args.audio_context;

    pthread_mutex_lock(&audio_context->format_mutex);
    audio_context->shutdown_requested = 1;
    pthread_cond_broadcast(&audio_context->format_cond);
    pthread_mutex_unlock(&audio_context->format_mutex);

    // Kill module threads and make sure they're dead
    if (session->capture_thread != 0) {
        pthread_cancel(session->capture_thread);
        pthread_join(session->capture_thread, NULL);
    }
    if (session->capture_pw_thread != 0) {
        pthread_cancel(session->capture_pw_thread);
        pthread_join(session->capture_pw_thread, NULL);
    }
    if (session->input_thread != 0) {
        pthread_cancel(session->input_thread);
        pthread_join(session->input_thread, NULL);
    }
    if (audio_context->ring_buffer != NULL)
        ring_buffer_close(audio_context->ring_buffer);
    if (session->audio_encoder_thread != 0)
        pthread_join(session->audio_encoder_thread, NULL);
    if (session->transport_thread != 0) {
        pthread_cancel(session->transport_thread);
        pthread_join(session->transport_thread, NULL);
    }

    // Check to make sure game has exited (either gracefully in response to user
    // input, or abruptly due to the Wayland proxy socket being closed).
    // Note: We can't just kill the game by sending a SIGKILL because it won't
    // be passed to AppImage child processes correctly.
    if (session->game_pid != 0) {
        if (waitpid(session->game_pid, NULL, WNOHANG) != session->game_pid)
            fprintf(stderr,
                    "[SideCar] Warning: game did not terminate "
                    "(PID=%d)\n",
                    session->game_pid);
    }

    if (audio_context->ring_buffer != NULL)
        ring_buffer_destroy(audio_context->ring_buffer);

    pthread_cond_destroy(&audio_context->format_cond);
    pthread_mutex_destroy(&audio_context->format_mutex);

    free(session->args.cert);
    free(session);
}

/*
 * Launch a game
 *
 * Returns the PID of the child game process on success and -1 on failure.
 */
static int session_launch_game(char *game_id, int width, int height) {
    int pid, devnull;
    char game_path[MAX_GAME_PATH], dimensions[MAX_DIMENSIONS_LEN];
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
        if (snprintf(dimensions, MAX_DIMENSIONS_LEN, "%dx%d", width, height) <
            0) {

            perror("[Sidecar] sprintf");
            return -1;
        }
        if (setenv("STRATUS_DIMENSIONS", dimensions, 1) < 0) {
            perror("[Sidecar] setenv");
            exit(1);
        }

        // Hide game output unless explicitly enabled
        if (getenv("STRATUSD_GAME_DEBUG") == NULL) {
            if ((devnull = open("/dev/null", O_WRONLY, 0)) < 0) {
                perror("[Sidecar] open");
                exit(1);
            }
            dup2(devnull, 1);
            dup2(devnull, 2);
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
struct session *session_start(char *session_id, char *game_id, int width,
                              int height, char *encode_output) {
    struct session *session;

    // Create session struct
    session = malloc(sizeof(struct session));
    if (session == NULL) {
        perror("[Sidecar] malloc");
        goto err_malloc_1;
    }
    memset(session, 0x00, sizeof(struct session));

    if (pthread_mutex_init(&session->args.audio_context.format_mutex, NULL) !=
        0) {
        perror("[Sidecar] pthread_mutex_init");
        goto err_mutex_init;
    }
    if (pthread_cond_init(&session->args.audio_context.format_cond, NULL) !=
        0) {
        perror("[Sidecar] pthread_cond_init");
        goto err_cond_init;
    }

    session->args.encode_output = encode_output;
    session->args.width = width;
    session->args.height = height;
    session->args.cert = create_certificate();
    if (session->args.cert == NULL) {
        goto err_malloc_2;
    }
    printf("[Sidecar] Generated TLS certificate: %s (DER) / %s (SPKI)\n",
           get_der_hash(session->args.cert), get_spki_hash(session->args.cert));
    strncpy(session->id, session_id, UUID_LEN);
    strncpy(session->game_id, game_id, UUID_LEN);

    // Start modules in separate threads
    pthread_create(&session->capture_thread, NULL, (void *)&capture_main,
                   &session->args);
    pthread_create(&session->capture_pw_thread, NULL, (void *)&capture_pw_main,
                   &session->args);
    pthread_create(&session->audio_encoder_thread, NULL,
                   (void *)&audio_encoder_main, &session->args);
    pthread_create(&session->input_thread, NULL, (void *)&input_main,
                   &session->args);
    pthread_create(&session->transport_thread, NULL, (void *)&transport_main,
                   &session->args);

    // Start game
    session->game_pid = session_launch_game(session->game_id,
                                            session->args.width,
                                            session->args.height);
    if (session->game_pid < 0)
        goto err_start;

    return session;

err_start:
    free(session->args.cert);
err_malloc_2:
    pthread_cond_destroy(&session->args.audio_context.format_cond);
err_cond_init:
    pthread_mutex_destroy(&session->args.audio_context.format_mutex);
err_mutex_init:
    session_teardown(session);
err_malloc_1:
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
