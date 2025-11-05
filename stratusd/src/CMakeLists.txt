cmake_minimum_required(VERSION 3.10)

project(stratusd)

file(GLOB sourcefiles CONFIGURE_DEPENDS "*.h" "*.c")

add_subdirectory(Capture)
add_subdirectory(Encode)
add_subdirectory(SideCar)
add_subdirectory(Title)
add_subdirectory(Transport)

add_executable(stratusd ${sourcefiles})

# Link modules here
target_link_libraries(stratusd PRIVATE Encode)
target_link_libraries(stratusd PRIVATE Capture)
#target_link_libraries(Clocked imgui)
