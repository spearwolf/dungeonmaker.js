#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Native tests for native/src. Run from anywhere; builds into a temp directory.
# Asserts stay active: never add -DNDEBUG here (spec §5.4).
set -eu
cd "$(dirname "$0")/../.."

CXX=${CXX:-c++}
CXXFLAGS="-std=c++17 -O2 -fno-exceptions -fno-rtti -I native/src"
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

echo "prng_test"
$CXX $CXXFLAGS native/test/prng_test.cpp -o "$OUT/prng_test"
"$OUT/prng_test"

echo "unity translation unit: no libc rand/srand"
$CXX $CXXFLAGS -w -c native/src/dungeonmaker_unity.cpp -o "$OUT/unity.o"
if nm -u "$OUT/unity.o" | grep -wE 'rand|srand'; then
  echo "libc rand/srand leaked into the unity translation unit" >&2
  exit 1
fi

echo "native tests passed"
