cmake_minimum_required(VERSION 3.10)

project(stratusd)

set(CMAKE_CXX_STANDARD 20)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.cpp" "include/*.h")

add_library(Transport STATIC ${sourcefiles})

target_include_directories(Transport PUBLIC include)
target_link_libraries(Transport PUBLIC libquiche Common)