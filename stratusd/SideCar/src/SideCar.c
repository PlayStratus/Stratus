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

    // Run modules
    capture_run(session->capture);

    // Teardown modules & session
    session_teardown(session);
    return 0;

err:
    session_teardown(session);
    return -1;
}
