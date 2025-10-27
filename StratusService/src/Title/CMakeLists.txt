cmake_minimum_required(VERSION 3.10)

project(StratusService)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.c" "include/*.h")

add_library(Title STATIC ${sourcefiles})

target_include_directories(Title PUBLIC include)