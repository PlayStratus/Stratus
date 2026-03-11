#include "SideCar.h"

/*
 * Free the resources used by a session
 */
static void session_teardown(struct session *session) {
    if (session == NULL) return;

    if (session->transport != NULL)
       transport_destroy(session->transport);
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
int sidecar_session_run(int width, int height, char *encode_output) {
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
    session->transport = transport_init(4433);
    if (session->transport == NULL)
        goto err;
    session->encode = encoder_startup(encode_output, width, height);
    if (session->encode == NULL)
        goto err;
    session->capture = capture_init(width, height, session->encode);
    if (session->capture == NULL)
        goto err;

    // Start modules in separate threads
    pthread_create(&session->transport_thread, NULL, (void *)&transport_thread,
                   session->transport);

    pthread_create(&session->capture_thread, NULL, (void *)&capture_run,
                   session->capture);

    // Wait for game to disconnect from Wayland proxy
    pthread_join(session->capture_thread, NULL);


    // Teardown modules & session
    session_teardown(session);
    return 0;

err:
    session_teardown(session);
    return -1;
}
