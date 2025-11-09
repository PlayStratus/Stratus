cmake_minimum_required(VERSION 3.10)

project(stratusd)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.c" "include/*.h")

add_library(Capture STATIC ${sourcefiles})
target_include_directories(Capture PUBLIC include)
target_link_libraries(Capture PRIVATE PipeWire::PipeWire)
target_link_libraries(Capture PRIVATE Wayland::Client)
target_link_libraries(Capture PRIVATE Wayland::Server)
