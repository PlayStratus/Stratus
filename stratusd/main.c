#include <stdio.h>
#include <string.h>

#include "Capture.h"
#include "Encode.h"

int main(int argc, char *argv[]) {
    if (argc >= 2 && !strcmp(argv[1], "capture")) {
        capture_test();
    } else if (argc >= 2 && !strcmp(argv[1], "encode")) {
        test_ffmpeg();
        init_encoder();
    } else {
        printf("Usage: %s [capture|encode]\n", argv[0]);
    }

    return 0;
}
