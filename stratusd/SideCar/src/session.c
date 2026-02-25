#include "session.h"

/*
 * Forcibly stop a stream session and free its resources
 */
void session_teardown(struct session *session) {
    if (session == NULL) return;

    // Kill remaining threads and make sure they're dead
    if (session->capture_thread != 0) {
        pthread_cancel(session->capture_thread);
        pthread_join(session->capture_thread, NULL);
    }
    if (session->input_thread != 0) {
        pthread_cancel(session->input_thread);
        pthread_join(session->input_thread, NULL);
    }

    if (session->capture != NULL)
        capture_destroy(session->capture);
    if (session->input != NULL)
        input_destroy(session->input);

    free(session);
}

/*
 * Create and start a new stream session
 *
 * Returns the crated session struct on success and NULL on failure.
 */
struct session *session_start(int width, int height, char *encode_output) {
    struct session *session;

    // Create session struct
    session = malloc(sizeof(struct session));
    if (session == NULL) {
        perror("[Sidecar] malloc");
        goto err;
    }
    memset(session, 0x00, sizeof(struct session));

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

    return session;

err:
    session_teardown(session);
    return NULL;
}

/*
 * Wait for the stream session to closed locally
 *
 * This is currently implemented by waiting for the Wayland proxy to exit.
 */
void session_wait(struct session *session) {
    pthread_join(session->capture_thread, NULL);
}
