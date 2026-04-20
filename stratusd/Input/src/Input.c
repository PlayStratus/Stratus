#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "Input.h"
#include "gamepad.h"
#include "input-queue.h"

/*
 * Contains data associated with an instance of the Input module
 */
struct input_session {
    struct gamepad *gamepad;
    struct rbuf *input_queue;
};

/*
 * Run a very primitive gamepad interface, optimized for SuperTuxKart
 *
 * Supported keys:
 *  - q: quit
 *  - w: Y (accelerate)
 *  - a: Left joystick left (turn left)
 *  - s: X (brake / reverse)
 *  - d: Left joystick right (turn right)
 *  - <ENTER>: A (select / look back)
 *
 * Note that only one key can be active at a time, and that each key remains
 * pressed until a new key is pressed. Use an unbound key (such as <SPACE>) to
 * force the previous key to be released. These controls are far from ideal, but
 * technically allow the game to be played and demonstrate the potential of a
 * libevdev-based virtual gamepad device.
 */
void gamepad_stk_console(struct gamepad *gamepad) {
    char c;
    struct gamepad_state state;

    if (!isatty(0)) {
        fprintf(stderr, "[Input] Not running SuperTuxKart controller console because stdin isn't a tty\n");
        return;
    }

    fprintf(stderr, "[Input] Running SuperTuxKart controller console...\n");

    system("/bin/stty cbreak");
    while ((c = getchar()) != 'q') {
        system ("/bin/stty cooked");

        memset(&state, 0x00, sizeof(struct gamepad_state));

        if (c == '\n')
            state.buttons[GAMEPAD_A] = 1;
        else if (c == 'w')
            state.buttons[GAMEPAD_Y] = 1;
        else if (c == 's')
            state.buttons[GAMEPAD_X] = 1;
        else if (c == 'a')
            state.axes[GAMEPAD_LEFT_JOYSTICK_X] = -32;
        else if (c == 'd')
            state.axes[GAMEPAD_LEFT_JOYSTICK_X] = +32;

        gamepad_update(gamepad, &state);

        system ("/bin/stty cbreak");
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

    while (1) {
        struct input_queue_msg *msg = rbuf_wait_peak_latest(session->input_queue);
        printf("[Input] Received msg: %s\n", msg->c_str);
        rbuf_pop(session->input_queue);
    }


end:
    pthread_cleanup_pop(1);
    return ret;
}
