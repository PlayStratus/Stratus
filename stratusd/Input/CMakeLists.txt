cmake_minimum_required(VERSION 3.10)

project(stratusd)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.c" "include/*.h")

add_library(Input STATIC ${sourcefiles})
target_include_directories(Input PUBLIC include PRIVATE ${LIBEVDEV_INCLUDE_DIRS})
target_link_libraries(Input PRIVATE SideCar ${LIBCJSON_LIBRARIES}
  ${LIBEVDEV_LIBRARIES})
