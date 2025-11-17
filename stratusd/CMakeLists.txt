cmake_minimum_required(VERSION 3.10.0)

project(stratusd VERSION 0.1.0)

file(GLOB sourcefiles CONFIGURE_DEPENDS "*.h" "*.c")

# Load dependencies
list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
find_package(PipeWire REQUIRED)
find_package(Wayland REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(FFMPEG REQUIRED IMPORTED_TARGET
    libavcodec
    libavformat
    libavutil
    libswscale)

add_subdirectory(Capture)
add_subdirectory(Encode)
add_subdirectory(SideCar)
add_subdirectory(Title)
add_subdirectory(Transport)

# Add future dependencies like this.
#add_subdirectory(libs/GoogleTest)
