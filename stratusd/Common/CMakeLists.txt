cmake_minimum_required(VERSION 3.10)

project(stratusd)

find_package(Threads REQUIRED)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.c" "include/*.h")

add_library(Common STATIC ${sourcefiles})
target_include_directories(Common PUBLIC include)
target_link_libraries(Common PUBLIC Transport)
