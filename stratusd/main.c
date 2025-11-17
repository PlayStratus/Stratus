#include <stdio.h>
#include "Encode.h"

int main()
{
    printf("Stratus Service: Hello World \n");
    test_ffmpeg();
    init_encoder();

    return 0;
}
