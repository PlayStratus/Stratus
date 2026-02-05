#include "Input.h"
#include "SideCar.h"

int main(int argc, char *argv[]) {
    if (argc >= 2 && !strcmp(argv[1], "input")) {
        return input_test(); // TODO: call from sidecar module
    } else if (argc >= 2) {
        printf("Usage: %s [input]\n", argv[0]);
        return -1;
    }

    sidecar_session_run(640, 480);

    return 0;
}
