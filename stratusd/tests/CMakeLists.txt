add_executable(
  stratusdTests
  stratusdtests.cpp
)
target_link_libraries(stratusdTests GTest::gtest_main)

include(GoogleTest)
gtest_discover_tests(stratusdTests)