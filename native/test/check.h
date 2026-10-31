// SPDX-License-Identifier: GPL-3.0-or-later
// Minimal assertion helper for the native tests: report every failure, exit non-zero at the end.
#pragma once
#include <cstdio>

static int dm_test_failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "%s:%d: CHECK failed: %s\n", __FILE__, __LINE__, #cond); \
      ++dm_test_failures;                                                    \
    }                                                                        \
  } while (0)
#define TEST_RESULT() (dm_test_failures == 0 ? 0 : 1)
