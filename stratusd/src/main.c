#include <stdio.h>
#include "Encode.h"
#include <Capture.h>

int main()
{
    printf("Stratus Service: Hello World \n");
    test_ffmpeg();
    init_encoder();

    wayland_poc();

    return 0;
}
