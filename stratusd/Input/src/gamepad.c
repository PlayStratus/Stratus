/*
 * Virtual gamepad device
 *
 * Implements a virtual gamepad device using libevdev. See [1] for more
 * information on gamepad support in Linux.
 *
 * [1]: https://www.kernel.org/doc/html/latest/input/gamepad.html
 */

#include <libevdev/libevdev-uinput.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "gamepad.h"

/*
 * Names for gamepad buttons
 */
const char *gamepad_button_names[GAMEPAD_BUTTON_COUNT] = {
    [GAMEPAD_A]              = "A",
    [GAMEPAD_B]              = "B",
    [GAMEPAD_X]              = "X",
    [GAMEPAD_Y]              = "Y",
    [GAMEPAD_LEFT_SHOULDER]  = "LB",
    [GAMEPAD_RIGHT_SHOULDER] = "RB",
    [GAMEPAD_LEFT_TRIGGER]   = "LT",
    [GAMEPAD_RIGHT_TRIGGER]  = "RT",
    [GAMEPAD_SELECT]         = "SELECT",
    [GAMEPAD_START]          = "START",
    [GAMEPAD_LEFT_THUMB]     = "LS",
    [GAMEPAD_RIGHT_THUMB]    = "RS",
    [GAMEPAD_UP]             = "UP",
    [GAMEPAD_DOWN]           = "DOWN",
    [GAMEPAD_LEFT]           = "LEFT",
    [GAMEPAD_RIGHT]          = "RIGHT",
    [GAMEPAD_MODE]           = "MODE",
};

/*
 * Linux input event codes for gamepad buttons
 */
const unsigned int gamepad_button_codes[GAMEPAD_BUTTON_COUNT] = {
    [GAMEPAD_A]              = BTN_A,
    [GAMEPAD_B]              = BTN_B,
    [GAMEPAD_X]              = BTN_X,
    [GAMEPAD_Y]              = BTN_Y,
    [GAMEPAD_LEFT_SHOULDER]  = BTN_TL,
    [GAMEPAD_RIGHT_SHOULDER] = BTN_TR,
    [GAMEPAD_LEFT_TRIGGER]   = BTN_TL2,
    [GAMEPAD_RIGHT_TRIGGER]  = BTN_TR2,
    [GAMEPAD_SELECT]         = BTN_SELECT,
    [GAMEPAD_START]          = BTN_START,
    [GAMEPAD_LEFT_THUMB]     = BTN_THUMBL,
    [GAMEPAD_RIGHT_THUMB]    = BTN_THUMBR,
    [GAMEPAD_UP]             = BTN_DPAD_UP,
    [GAMEPAD_DOWN]           = BTN_DPAD_DOWN,
    [GAMEPAD_LEFT]           = BTN_DPAD_LEFT,
    [GAMEPAD_RIGHT]          = BTN_DPAD_RIGHT,
    [GAMEPAD_MODE]           = BTN_MODE,
};

/*
 * Linux input event codes for gamepad axes
 */
const unsigned int gamepad_axis_codes[GAMEPAD_AXIS_COUNT] = {
    [GAMEPAD_LEFT_JOYSTICK_X]  = ABS_X,
    [GAMEPAD_LEFT_JOYSTICK_Y]  = ABS_Y,
    [GAMEPAD_RIGHT_JOYSTICK_X] = ABS_RX,
    [GAMEPAD_RIGHT_JOYSTICK_Y] = ABS_RY,
};

/*
 * Configuration for each gamepad axis
 *
 * TODO: Update config to match the configuration of a typical physical gamepad.
 */
const struct input_absinfo absinfo = {
    0,                   // value
    -GAMEPAD_AXIS_RANGE, // minimum
    +GAMEPAD_AXIS_RANGE, // maximum
    0,                   // fuzz (controls filter)
    0,                   // flat (controls dead-zone)
    1,                   // resolution
};

/*
 * Create a virtual gamepad device
 *
 * Returns the libevdev_uinput struct on success and NULL on failure.
 */
struct gamepad *gamepad_init(char *name) {
    int i;
    struct libevdev *dev;
    struct gamepad *gamepad;

    // Create gamepad struct
    gamepad = malloc(sizeof(struct gamepad));
    if (gamepad == NULL) {
        perror("[Input] malloc");
        goto err_malloc;
    }
    memset(gamepad, 0x00, sizeof(struct gamepad));

    // Initialize libevdev device
    dev = libevdev_new();
    libevdev_set_name(dev, name);

    // Configure supported uinput events
    for (i = 0; i < GAMEPAD_BUTTON_COUNT; i++) {
        if (libevdev_enable_event_code(dev, EV_KEY, gamepad_button_codes[i],
                                       NULL) < 0) {
            perror("[Input] libevdev_enable_event_code");
            goto err_event_code;
        }
    }
    for (i = 0; i < GAMEPAD_AXIS_COUNT; i++) {
        if (libevdev_enable_event_code(dev, EV_ABS, gamepad_axis_codes[i],
                                       &absinfo) < 0) {
            perror("[Input] libevdev_enable_event_code");
            goto err_event_code;
        }
    }

    // Register gamepad device
    libevdev_uinput_create_from_device(dev, LIBEVDEV_UINPUT_OPEN_MANAGED,
                                       &gamepad->uidev);
    if (gamepad->uidev == NULL) {
        perror("[Input] libevdev_uinput_create_from_device");
        goto err_create;
    }

    libevdev_free(dev);

    usleep(10000);  // Wait 10ms for gamepad device to be detected

    return gamepad;

err_create:
err_event_code:
    libevdev_free(dev);
    free(gamepad);
err_malloc:
    return NULL;
}

/*
 * Print a gamepad state as a string
 */
void gamepad_print_state(struct gamepad_state *state) {
    for (int i = 0; i < GAMEPAD_BUTTON_COUNT; i++) {
        if (state->buttons[i]) {
            printf("%s, ", gamepad_button_names[i]);
        }
    }
    printf("[");
    for (int i = 0; i < GAMEPAD_AXIS_COUNT; i++) {
        printf("%d, ", state->axes[i]);
    }
    printf("]");
}

/*
 * Update the state of a virtual gamepad device
 *
 * Sends uinput events for any gamepad buttons/axes that are active or have
 * changed since the last update.
 *
 * Returns 0 on success and -1 on failure.
 */
int gamepad_update(struct gamepad *gamepad, struct gamepad_state *new_state) {
    bool changed;
    int i, err;

    changed = false;
    err = 0;

    for (i = 0; i < GAMEPAD_BUTTON_COUNT; i++) {
        if (new_state->buttons[i] || gamepad->state.buttons[i]) {
            // Button is pressed, or was just unpressed
            changed = true;
            err += libevdev_uinput_write_event(gamepad->uidev, EV_KEY,
                                               gamepad_button_codes[i],
                                               new_state->buttons[i] ? 1 : 0);
            gamepad->state.buttons[i] = new_state->buttons[i];
        }
    }

    for (i = 0; i < GAMEPAD_AXIS_COUNT; i++) {
        if (new_state->axes[i] != 0 || gamepad->state.axes[i] != 0) {
            // Axis is off-center, or was just re-centered
            changed = true;
            err += libevdev_uinput_write_event(gamepad->uidev, EV_ABS,
                                               gamepad_axis_codes[i],
                                               new_state->axes[i]);
            gamepad->state.axes[i] = new_state->axes[i];
        }
    }

    if (changed)
        err += libevdev_uinput_write_event(gamepad->uidev, EV_SYN, SYN_REPORT,
                                           0);

    if (err != 0) {
        perror("[Input] libevdev_uinput_write_event");
        return -1;
    }

    return 0;
}

/*
 * Destroy a virtual gamepad device and free its resources
 */
void gamepad_destroy(struct gamepad *gamepad) {
    libevdev_uinput_destroy(gamepad->uidev);
    free(gamepad);
}
