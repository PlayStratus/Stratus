#include <stdio.h>
#include <string.h>

#include "Capture.h"
#include "Encode.h"
#include "Transport.h"

int main(int argc, char *argv[]) {
    if (argc >= 2 && !strcmp(argv[1], "capture")) {
        capture_test();
    } else if (argc >= 2 && !strcmp(argv[1], "encode")) {
        test_encode();
    } else if (argc >= 2 && !strcmp(argv[1], "transport")) {
        TransportTest();
    } 
    else {
        printf("Usage: %s [capture|encode|transport]\n", argv[0]);
    }

    return 0;
}
