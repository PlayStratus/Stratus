#include <assert.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "Input.h"
#include "gamepad.h"
#include "input-queue.h"

/*
 * The offsets of each component of an input event packet
 */
enum input_packet {
    INPUT_PKT_DEVICE  = 0,
    INPUT_PKT_BUTTONS = INPUT_PKT_DEVICE  + sizeof(uint8_t),
    INPUT_PKT_AXES    = INPUT_PKT_BUTTONS + sizeof(uint8_t) * GAMEPAD_BUTTON_COUNT,
    INPUT_PKT_LENGTH  = INPUT_PKT_AXES    + sizeof(float) * GAMEPAD_AXIS_COUNT,
};

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
    char msg_buffer[INPUT_PKT_LENGTH];
    ssize_t msg_buffer_len; // Current number of buffer bytes used
    struct gamepad *gamepad;
    struct rbuf *input_queue;
};

/*
 * Parse an input event and update the state of the virtual gamepad device
 *
 * Returns 0 on success and -1 on failure.
 */
static int input_recv_event(struct input_session *session, const char *event) {
    int ret, idx;
    struct gamepad_state state = {0};

    idx = event[INPUT_PKT_DEVICE];
    if (idx != 0) {
        // TODO: add support for multiple gamepads
        printf("[Input] Skipping event for unknown gamepad #%d\n", idx);
        return 0;
    }

    for (int i = 0; i < GAMEPAD_BUTTON_COUNT; i++) {
        state.buttons[i] = event[INPUT_PKT_BUTTONS + i];
    }
    for (int i = 0; i < GAMEPAD_AXIS_COUNT; i++) {
        state.axes[i] = ((float*)(event + INPUT_PKT_AXES))[i]
            * GAMEPAD_AXIS_RANGE;
    }

    if (input_debug) {
        printf("[Input] received message: ");
        gamepad_print_state(&state);
        printf("\n");
    }

    return gamepad_update(session->gamepad, &state);
}

/*
 * Handle a raw input message containing (buffers events if necessary)
 *
 * Returns 0 on success and -1 on failure.
 */
static int input_recv_raw(struct input_session *session,
                          struct input_queue_msg *msg) {

    if (msg->length != INPUT_PKT_LENGTH)
        printf("[Input] Received %zd byte input packet\n", msg->length);

    while (true) {
        // Note that Input owns the msg->data and msg->length fields, so we
        // inc/decrement them directly to keep track of what has been parsed.

        if (session->msg_buffer_len == 0 && msg->length >= INPUT_PKT_LENGTH) {
            // Parse event directly from message, no buffering required
            if (input_recv_event(session, msg->data) < 0)
                return -1;
            msg->data += INPUT_PKT_LENGTH;
            msg->length -= INPUT_PKT_LENGTH;
        }

        // Copy next message chunk to buffer
        while (session->msg_buffer_len < INPUT_PKT_LENGTH && msg->length > 0) {
            session->msg_buffer[session->msg_buffer_len++] = msg->data[0];
            msg->data++;
            msg->length--;
        }

        if (session->msg_buffer_len == INPUT_PKT_LENGTH) {
            printf("[INPUT] Handled buffered input event\n");
            // Parse event from full buffer
            if (input_recv_event(session, session->msg_buffer) < 0)
                return -1;
            session->msg_buffer_len = 0;
        }

        if (msg->length == 0)
            return 0;
    }
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
    session->msg_buffer_len = 0;
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
        if (input_recv_raw(session, msg) < 0) {
            ret = -1;
            goto end;
        }
        rbuf_pop(session->input_queue);
    }

    // Wait to be killed by SideCar
    while (1)
        sleep(1);

end:
    pthread_cleanup_pop(1);
    return ret;
}
