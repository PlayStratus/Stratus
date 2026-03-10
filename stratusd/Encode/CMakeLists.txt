cmake_minimum_required(VERSION 3.10)

project(stratusd)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.c" "include/*.h")

add_library(Encode STATIC ${sourcefiles})
target_include_directories(Encode PUBLIC include /usr/include/libdrm)
target_link_libraries(Encode PRIVATE PkgConfig::FFMPEG)
