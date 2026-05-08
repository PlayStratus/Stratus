/*
 * Stream session management logic
 *
 * Responsible for starting and stopping the games and all other modules for
 * each stream session.
 */

#define _GNU_SOURCE

#include <asm-generic/errno-base.h>
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
#include "Encode.h"
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
 * Per-thread constant data, including a human-readable module name and the
 * module entry function.
 */
const struct {
    const char *name;
    void *entry;
} thread_data[THREAD_COUNT] = {
    [THREAD_CAPTURE]        = { "capture",      (void *)&capture_main       },
    [THREAD_CAPTURE_PW]     = { "capture_pw",   (void *)&capture_pw_main    },
    [THREAD_AUDIO_ENCODER]  = { "audio_encode", (void *)&audio_encoder_main },
    [THREAD_ENCODER]        = { "encode",       (void *)&encode_main        },
    [THREAD_INPUT]          = { "input",        (void *)&input_main         },
    [THREAD_TRANSPORT]      = { "transport",    (void *)&transport_main     },
};

/*
 * Forcibly stop a stream session and free its resources
 */
void session_teardown(struct session *session) {
    struct audio_context *audio_context;

    if (session == NULL)
        return;

    // Notify threads of session teardown
    session->args.is_active = false;
    audio_context = &session->args.audio_context;
    pthread_mutex_lock(&audio_context->format_mutex);
    pthread_cond_broadcast(&audio_context->format_cond);
    pthread_mutex_unlock(&audio_context->format_mutex);

    // Give threads 100ms to get to a good stopping point before we kill them
    usleep(100000);

    if (audio_context->ring_buffer != NULL)
        ring_buffer_close(audio_context->ring_buffer);

    // Kill module threads and make sure they're dead
    for (int thread = 0; thread < THREAD_COUNT; thread++) {
        if (session->thread_states[thread]) {
            pthread_cancel(session->threads[thread]);
            pthread_join(session->threads[thread], NULL);
        }
    }

    // send kill to the game's process tree
    if (session->game_pid != 0) {
        killpg(session->game_pid, 9);
    }

    // Destroy ring buffers
    if (audio_context->ring_buffer != NULL)
        ring_buffer_destroy(audio_context->ring_buffer);
    if (session->args.video_encode_queue != NULL)
        rbuf_destroy(session->args.video_encode_queue);
    if (session->args.video_transport_queue != NULL)
        rbuf_destroy(session->args.video_transport_queue);
    if (session->args.audio_transport_queue != NULL)
        rbuf_destroy(session->args.audio_transport_queue);
    if (session->args.input_queue != NULL)
        rbuf_destroy(session->args.input_queue);

    pthread_cond_destroy(&audio_context->format_cond);
    pthread_mutex_destroy(&audio_context->format_mutex);

    destroy_certificate(session->args.cert);
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
        setpgid(getpid(), 0);
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
                              int height) {
    struct session *session;

    // Create session struct
    session = calloc(1, sizeof(struct session));
    if (session == NULL) {
        perror("[Sidecar] calloc");
        goto err_malloc_1;
    }

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

    session->args.is_active = true;
    session->args.client_connected = false;
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
    session->args.video_encode_queue = rbuf_init(8);
    if (session->args.video_encode_queue == NULL)
        goto err_rbuf_1;
    session->args.video_transport_queue = rbuf_init(8);
    if (session->args.video_transport_queue == NULL)
        goto err_rbuf_2;
    session->args.audio_transport_queue = rbuf_init(64);
    if (session->args.audio_transport_queue == NULL)
        goto err_rbuf_3;
    session->args.input_queue = rbuf_init(8);
    if (session->args.input_queue == NULL)
        goto err_rbuf_4;

    // Start modules in separate threads
    for (int thread = 0; thread < THREAD_COUNT; thread++) {
        if (pthread_create(&session->threads[thread], NULL,
                           thread_data[thread].entry, &session->args) < 0) {
            perror("[Sidecar] pthread_create");
            goto err_start;
        }
        session->thread_states[thread] = 1;

        assert(pthread_setname_np(session->threads[thread],
                                  thread_data[thread].name) == 0);
    }

    // Start game
    session->game_pid = session_launch_game(session->game_id,
                                            session->args.width,
                                            session->args.height);
    if (session->game_pid < 0)
        goto err_start;

    return session;

err_start:
    rbuf_destroy(session->args.input_queue);
err_rbuf_4:
    rbuf_destroy(session->args.audio_transport_queue);
err_rbuf_3:
    rbuf_destroy(session->args.video_transport_queue);
err_rbuf_2:
    rbuf_destroy(session->args.video_encode_queue);
err_rbuf_1:
    destroy_certificate(session->args.cert);
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
 * Poll the status of a session
 *
 * Returns 1 if the game exited or the user disconnected, -1 if a module has
 * crashed, and 0 otherwise.
 */
int session_poll(struct session *session) {
    int ret;

    // Check if game has exited
    if (session->game_pid == 0 ||
        (ret = waitpid(session->game_pid, NULL, WNOHANG)) > 0) {

        fprintf(stderr, "[Sidecar] Detected game exit\n");

        // Clear game_pid so we don't try to wait on the process again
        session->game_pid = 0;

        return 1;
    } else if (ret < 0) {
        perror("[Sidecar] waitpid");
        return -1;
    }

    // Check if module threads have exited
    for (int thread = 0; thread < THREAD_COUNT; thread++) {
        if (session->thread_states[thread] == 0 ||
            (ret = pthread_tryjoin_np(session->threads[thread], NULL)) == 0) {

            fprintf(stderr, "[Sidecar] Detected %s module exit\n",
                    thread_data[thread].name);

            // Unset thread_states[thread] to avoid joining to the thread again
            session->thread_states[thread] = 0;

            if (thread == THREAD_TRANSPORT) {
                // If the Transport thread exited, we'll assume it's because the
                // user disconnected.
                return 1;
            } else {
                return -1;
            }
        } else if (ret != EBUSY) {
            perror("[Sidecar] pthread_tryjoin_np");
            return -1;
        }
    }

    return 0;
}
