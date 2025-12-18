#include <stdio.h>

#include "proxy.h"

int capture_test() {
    struct proxy *proxy = proxy_init("stratus");
    if (proxy != NULL) {
        proxy_run(proxy);
        proxy_destroy(proxy);
    }
    return 0;
}
