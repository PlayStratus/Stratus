cmake_minimum_required(VERSION 3.10)

project(stratusd)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.c" "include/*.h")

add_library(SideCar STATIC ${sourcefiles})

target_include_directories(SideCar PUBLIC include)
target_link_libraries(SideCar PRIVATE Capture Encode Input Transport)
