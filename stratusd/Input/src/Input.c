#include <cjson/cJSON.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "Input.h"
#include "gamepad.h"
#include "input-queue.h"

/*
 * Whether to log all incoming input messages
 *
 * Set in input_main according to the STRATUSD_INPUT_DEBUG variable.
 */
static bool input_debug = false;

/*
 * Contains data associated with an instance of the Input module
 */
struct input_session {
    struct gamepad *gamepad;
    struct rbuf *input_queue;
};

/*
 * Parse an input message and update the state of the virtual gamepad device
 *
 * Returns 0 on success and -1 on failure.
 */
int input_recv(struct input_session *session, const char *msg) {
    int ret;
    cJSON *json, *arr, *el;
    struct gamepad_state state = {0};

    if (input_debug)
        printf("[Input] received message: %s\n", msg);

    json = cJSON_Parse(msg);
    if (json == NULL) {
        fprintf(stderr, "[Sidecar] cJSON_Parse: Error before \"%s\"\n",
                cJSON_GetErrorPtr());
        goto err;
    }

    arr = cJSON_GetObjectItemCaseSensitive(json, "buttons");
    if (!cJSON_IsArray(arr))
        goto err;
    if (cJSON_GetArraySize(arr) < GAMEPAD_BUTTON_COUNT)
        goto err;
    for (int i = 0; i < GAMEPAD_BUTTON_COUNT; i++) {
        el = cJSON_GetArrayItem(arr, i);
        if (!cJSON_IsNumber(el))
            goto err;
        state.buttons[i] = el->valuedouble >= 0.5;
    }

    arr = cJSON_GetObjectItemCaseSensitive(json, "axes");
    if (!cJSON_IsArray(arr))
        goto err;
    if (cJSON_GetArraySize(arr) < GAMEPAD_AXIS_COUNT)
        goto err;
    for (int i = 0; i < GAMEPAD_AXIS_COUNT; i++) {
        el = cJSON_GetArrayItem(arr, i);
        if (!cJSON_IsNumber(el))
            goto err;
        state.axes[i] = el->valuedouble * 127; // TODO: tune min/max values?
    }

    ret = gamepad_update(session->gamepad, &state);

    cJSON_Delete(json);

    return ret;

err:
    cJSON_Delete(json);
    fprintf(stderr, "[Input] Error: received invalid message\n");
    return -1;
}

/*
 * Destroy an input session and free its resources
 */
static void input_destroy(struct input_session *session) {
    gamepad_destroy(session->gamepad);
    free(session);
}

/*
 * Run the input module
 *
 * Returns 0 on success and -1 on failure.
 */
int input_main(struct session_args *args) {
    int ret = 0;
    struct input_session *session;

    input_debug = (getenv("STRATUSD_INPUT_DEBUG") != NULL);

    session = malloc(sizeof(struct input_session));
    if (session == NULL) {
        perror("[Input] malloc");
        return -1; // No need to jump to end outside of pthread_cleanup_* macro
    }
    session->input_queue = args->input_queue;

    pthread_cleanup_push((void (*)(void*))input_destroy, session);

    session->gamepad = gamepad_init("stratus");
    if (session->gamepad == NULL) {
        free(session);
        ret = -1;
        goto end;
    }

    usleep(10000);  // Wait 10ms for gamepad device to be detected

    while (args->is_active) {
        struct input_queue_msg *msg = rbuf_wait_peak_latest(session->input_queue);
        input_recv(session, msg->c_str);
        rbuf_pop(session->input_queue);
    }

    // Wait to be killed by SideCar
    while (1)
        sleep(1);

end:
    pthread_cleanup_pop(1);
    return ret;
}
