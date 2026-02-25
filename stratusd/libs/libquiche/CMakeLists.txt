cmake_minimum_required(VERSION 3.10)

project(stratusd)

set(CMAKE_CXX_STANDARD 20)

# libquiche
set(libquichepath "${CMAKE_CURRENT_SOURCE_DIR}/dist/libquiche.so")

add_library(libquiche SHARED IMPORTED GLOBAL)
set_target_properties(libquiche PROPERTIES
    IMPORTED_LOCATION "${libquichepath}"
)

target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/abseil-cpp+)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/boringssl+/include)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/quiche/common/platform/default/)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/protobuf+/src)
target_include_directories(libquiche INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/external/+_repo_rules+com_google_googleurl)

# WebTransport Demo
file(GLOB_RECURSE WebTransportDemoSRC CONFIGURE_DEPENDS "WebTransportDemo.cpp")

add_executable(WebTransportDemo ${WebTransportDemoSRC})
target_link_libraries(WebTransportDemo PRIVATE libquiche)