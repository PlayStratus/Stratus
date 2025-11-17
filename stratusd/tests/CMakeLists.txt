add_executable(
  stratusdTests
  stratusdtests.cpp
)
target_link_libraries(stratusdTests PRIVATE GTest::gtest_main Encode)

target_link_libraries(stratusdTests PUBLIC Encode)

include(GoogleTest)
gtest_discover_tests(stratusdTests)