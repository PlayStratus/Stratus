cmake_minimum_required(VERSION 3.14)

project(stratusd)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.c" "include/*.h")

add_library(Transport STATIC ${sourcefiles})

target_include_directories(Transport PUBLIC include)
