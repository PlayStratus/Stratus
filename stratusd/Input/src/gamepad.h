#ifndef INPUT_GAMEPAD_H
#define INPUT_GAMEPAD_H

#include <linux/input-event-codes.h>
#include <stdbool.h>

/*
 * The virtual gamepad buttons
 */
enum gamepad_buttons {
    GAMEPAD_A = 0,
    GAMEPAD_B,
    GAMEPAD_X,
    GAMEPAD_Y,
    GAMEPAD_LEFT_SHOULDER,
    GAMEPAD_RIGHT_SHOULDER,
    GAMEPAD_LEFT_TRIGGER,
    GAMEPAD_RIGHT_TRIGGER,
    GAMEPAD_SELECT,
    GAMEPAD_START,
    GAMEPAD_LEFT_THUMB,
    GAMEPAD_RIGHT_THUMB,
    GAMEPAD_UP,
    GAMEPAD_DOWN,
    GAMEPAD_LEFT,
    GAMEPAD_RIGHT,
    GAMEPAD_MODE,

    GAMEPAD_BUTTON_COUNT,
};

/*
 * The virtual gamepad (joystick) axes
 */
enum gamepad_axes {
    GAMEPAD_LEFT_JOYSTICK_X = 0,
    GAMEPAD_LEFT_JOYSTICK_Y,
    GAMEPAD_RIGHT_JOYSTICK_X,
    GAMEPAD_RIGHT_JOYSTICK_Y,

    GAMEPAD_AXIS_COUNT,
};

/*
 * The state of a gamepad's buttons and axes
 *
 * See the gamepad_buttons and gamepad_axes enumerations for the order of the
 * buttons and axes.
 */
struct gamepad_state {
    bool buttons[GAMEPAD_BUTTON_COUNT];
    int axes[GAMEPAD_AXIS_COUNT];
};

/*
 * Contains data for a virtual gamepad device
 */
struct gamepad {
    struct libevdev_uinput *uidev;
    struct gamepad_state state;
};

struct gamepad *gamepad_init(char *name);

int gamepad_update(struct gamepad *gamepad, struct gamepad_state *new_state);

void gamepad_destroy(struct gamepad *gamepad);

#endif
