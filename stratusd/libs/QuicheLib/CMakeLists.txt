cmake_minimum_required(VERSION 3.10)

project(QuicheExternalTest VERSION 0.1.0 LANGUAGES C CXX)

set (CMAKE_CXX_STANDARD 20)

file(GLOB_RECURSE sourcefiles CONFIGURE_DEPENDS "src/*.h" "src/*.cpp" "include/*.h")

add_executable(WebTransportDemo ${sourcefiles})

target_include_directories(WebTransportDemo PUBLIC include)
target_include_directories(WebTransportDemo PUBLIC include/abseil-cpp+)
target_include_directories(WebTransportDemo PUBLIC include/boringssl+/include)
target_include_directories(WebTransportDemo PUBLIC include/quiche/common/platform/default/)
target_include_directories(WebTransportDemo PUBLIC include/protobuf+/src)
target_include_directories(WebTransportDemo PUBLIC include/+_repo_rules+com_google_googleurl)




target_link_libraries(WebTransportDemo ${CMAKE_CURRENT_SOURCE_DIR}/dist/libWebTransportPublic.so)