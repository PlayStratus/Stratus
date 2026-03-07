cmake_minimum_required(VERSION 3.16.0)

project(stratusd VERSION 0.1.0 LANGUAGES C CXX)

file(GLOB sourcefiles CONFIGURE_DEPENDS "*.h" "*.c")

# Load dependencies
add_subdirectory(libs/wayland)
add_subdirectory(libs/libquiche)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
find_package(PipeWire REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_search_module(LIBEVDEV REQUIRED libevdev)
pkg_check_modules(FFMPEG REQUIRED IMPORTED_TARGET
    libavcodec
    libavformat
    libavutil
    libswscale)

add_subdirectory(Capture)
add_subdirectory(Encode)
add_subdirectory(Input)
add_subdirectory(SideCar)
add_subdirectory(Title)
add_subdirectory(Transport)

add_executable(stratusd ${sourcefiles})

target_include_directories(stratusd PUBLIC ${CMAKE_BINARY_DIR})

# Link modules here
target_link_libraries(stratusd PRIVATE Capture Encode Transport Input SideCar)

# Get version from git
execute_process(
    COMMAND git describe --tags --long --always --dirty
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE GIT_DESCRIBE_VERSION
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
configure_file(
    ${CMAKE_SOURCE_DIR}/version.h.in
    ${CMAKE_BINARY_DIR}/version.h
    @ONLY
)
