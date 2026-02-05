#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "Input.h"
#include "gamepad.h"

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
        fprintf(stderr, "Not running SuperTuxKart controller console because stdin isn't a tty\n");
        return;
    }

    printf("Running SuperTuxKart controller console...\n");

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

int input_test() {
    struct gamepad *gamepad;

    gamepad = gamepad_init("stratus");
    if (gamepad == NULL)
        return 1;

    usleep(10000);  // Wait 10ms for device to be detected

    gamepad_stk_console(gamepad);

    gamepad_destroy(gamepad);

    return 0;
}
