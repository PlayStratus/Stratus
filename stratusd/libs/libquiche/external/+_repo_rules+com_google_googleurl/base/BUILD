load("@rules_cc//cc:defs.bzl", "cc_library")

# Copyright 2019 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.
load("//build_config:build_config.bzl", "build_config")

cc_library(
    name = "base",
    srcs = [
        "debug/crash_logging.cc",
        "strings/string_util.cc",
        "strings/string_util_constants.cc",
        "strings/utf_ostream_operators.cc",
        "strings/utf_string_conversion_utils.cc",
        "strings/utf_string_conversions.cc",
    ] + select({
        "//build_config:windows_x86_64": ["strings/string_util_win.cc"],
        "//conditions:default": [],
    }),
    hdrs = [
        "bits.h",
        "compiler_specific.h",
        "containers/checked_iterators.h",
        "containers/contains.h",
        "containers/span.h",
        "containers/span_forward_internal.h",
        "debug/crash_logging.h",
        "debug/leak_annotations.h",
        "memory/raw_ptr_exclusion.h",
        "memory/stack_allocated.h",
        "no_destructor.h",
        "numerics/checked_math.h",
        "numerics/checked_math_impl.h",
        "numerics/clamped_math.h",
        "numerics/clamped_math_impl.h",
        "numerics/integral_constant_like.h",
        "numerics/safe_conversions.h",
        "numerics/safe_conversions_arm_impl.h",
        "numerics/safe_conversions_impl.h",
        "numerics/safe_math.h",
        "numerics/safe_math_arm_impl.h",
        "numerics/safe_math_clang_gcc_impl.h",
        "numerics/safe_math_shared_impl.h",
        "stl_util.h",
        "strings/string_number_conversions.h",
        "strings/string_util.h",
        "strings/string_util_impl_helpers.h",
        "strings/string_util_internal.h",
        "strings/utf_ostream_operators.h",
        "strings/utf_string_conversion_utils.h",
        "strings/utf_string_conversions.h",
        "types/supports_ostream_operator.h",
        "types/to_address.h",
        "win/win_handle_types.h",
    ] + build_config.strings_hdrs,
    copts = build_config.default_copts,
    textual_hdrs = [
        "win/win_handle_types_list.inc",
    ],
    visibility = ["//visibility:public"],
    deps = [
        "//base/third_party/icu",
        "//build:build_config",
        "//build:buildflag",
        "//polyfills",
        "@com_google_absl//absl/types:optional",
    ],
)
