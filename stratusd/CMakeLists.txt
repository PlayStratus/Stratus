cmake_minimum_required(VERSION 3.14)

project(stratusd VERSION 0.1.0)

add_subdirectory(src)

# Add future dependencies like this.
add_subdirectory(libs/GoogleTest)

add_subdirectory(tests)
