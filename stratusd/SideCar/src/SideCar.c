#include "SideCar.h"

/*
 * Free the resources used by a session
 */
static void session_teardown(struct session *session) {
    if (session == NULL) return;

    if (session->capture != NULL)
        capture_destroy(session->capture);
    if (session->encode != NULL)
        encoder_teardown(session->encode);
    if (session->input != NULL)
        input_destroy(session->input);

    free(session);
}

/*
 * Create and run a new stream session
 *
 * Returns 0 on success and -1 on failure.
 */
int sidecar_session_run(int width, int height) {
    struct session *session;

    // Create session struct
    session = malloc(sizeof(struct session));
    if (session == NULL)
        goto err;
    memset(session, 0x00, sizeof(struct session));

    // Initialize modules
    // Order is important here! Some modules must be initialized before others.
    session->encode = encoder_startup(width, height);
    if (session->encode == NULL)
        goto err;
    session->capture = capture_init(width, height, session->encode);
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

    // Wait for game to disconnect from Wayland proxy
    pthread_join(session->capture_thread, NULL);

    // Kill remaining threads and make sure they're dead
    pthread_cancel(session->input_thread);
    pthread_join(session->input_thread, NULL);

    // Teardown modules & session
    session_teardown(session);
    return 0;

err:
    session_teardown(session);
    return -1;
}
