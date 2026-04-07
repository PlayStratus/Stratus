#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#include "SideCar.h"
#include "version.h"

int main(int argc, char *argv[]) {
    if (argc >= 2 && !strcmp(argv[1], "--version")) {
        printf("stratusd %s\n", STRATUSD_VERSION);
        return 0;
    } else if (argc >= 2) {
        printf("Usage: %s [--version]\n", argv[0]);
        return -1;
    }

    return sidecar_main();
}
