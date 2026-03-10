#include <stdbool.h>

#include "SideCar.h"
#include "version.h"

#define MAX_ENCODE_OUTPUT_NAME 64

int main(int argc, char *argv[]) {
    bool daemon = false;

    if (argc >= 2 && !strcmp(argv[1], "--version")) {
        printf("stratusd %s\n", STRATUSD_VERSION);
        return 0;
    } else if (argc >= 2 && !strcmp(argv[1], "--daemon")) {
        daemon = true;
    } else if (argc >= 2) {
        printf("Usage: %s [--version] [--daemon]\n", argv[0]);
        return -1;
    }

    if (daemon) {
        char output_file[MAX_ENCODE_OUTPUT_NAME];
        for (int i = 0; true; i++) {
            snprintf((char *)&output_file, MAX_ENCODE_OUTPUT_NAME,
                     "/var/lib/stratusd/output-%d.h264", i);
            fprintf(stderr, "Starting session #%d\n", i);
            sidecar_session_run(640, 480, output_file);
        }
        return 0;
    } else {
        return sidecar_session_run(640, 480, "encode_output.h264");
    }
}
