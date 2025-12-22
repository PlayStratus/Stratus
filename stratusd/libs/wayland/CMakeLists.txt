cmake_minimum_required(VERSION 3.10)

project(stratusd)

add_executable(wayland-scanner src/scanner.c src/wayland-util.c)
target_link_libraries(wayland-scanner PRIVATE expat)

set(protocols
  linux-dmabuf-v1 presentation-time tablet-v2 viewporter wayland xdg-shell
)
foreach(protocol ${protocols})
  add_custom_command(
    COMMAND wayland-scanner --strict public-code
      ${CMAKE_CURRENT_SOURCE_DIR}/protocols/${protocol}.xml
      ${CMAKE_CURRENT_SOURCE_DIR}/protocols/${protocol}-protocol.c
    DEPENDS wayland-scanner protocols/${protocol}.xml
    OUTPUT ${CMAKE_CURRENT_SOURCE_DIR}/protocols/${protocol}-protocol.c
  )
  set(protocol_headers
    ${protocol_headers}
    ${CMAKE_CURRENT_SOURCE_DIR}/protocols/${protocol}-protocol.c
  )
endforeach()

file(GLOB_RECURSE source_files CONFIGURE_DEPENDS "src/*.c")

add_library(Wayland STATIC ${source_files} ${protocol_headers})
target_include_directories(Wayland PUBLIC src)
