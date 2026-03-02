#include "SideCar.h"

int main(int argc, char *argv[]) {
    if (argc >= 2) {
        printf("Usage: %s\n", argv[0]);
        return -1;
    }

    return sidecar_session_run(640, 480);
}
