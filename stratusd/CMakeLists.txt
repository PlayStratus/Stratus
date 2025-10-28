cmake_minimum_required(VERSION 3.16.0)

project(stratusd VERSION 0.1.0 LANGUAGES C)

# Load dependencies
list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
find_package(PipeWire REQUIRED)
find_package(Wayland REQUIRED)

add_subdirectory(src)

# Add future dependencies like this.
#add_subdirectory(libs/GoogleTest)
