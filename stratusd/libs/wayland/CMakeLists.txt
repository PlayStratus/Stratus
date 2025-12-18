cmake_minimum_required(VERSION 3.10)

project(stratusd)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.c")

add_library(Wayland STATIC ${sourcefiles})
target_include_directories(Wayland PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
