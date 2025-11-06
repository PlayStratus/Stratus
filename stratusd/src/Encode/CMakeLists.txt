cmake_minimum_required(VERSION 3.10)

project(stratusd)

find_package(PkgConfig REQUIRED)
pkg_check_modules(FFMPEG REQUIRED IMPORTED_TARGET
    libavcodec
    libavformat
    libavutil
    libswscale)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.c" "include/*.h")
add_library(Encode STATIC ${sourcefiles})
target_include_directories(Encode PUBLIC include)

target_link_libraries(Encode PRIVATE PkgConfig::FFMPEG)
