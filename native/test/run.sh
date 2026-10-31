#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Native tests for native/src. Run from anywhere; builds into a temp directory.
# Asserts stay active: never add -DNDEBUG here (spec §5.4).
set -eu
cd "$(dirname "$0")/../.."

MODE=${1:---check}
GOLDEN=packages/dungeonmaker-js/test/golden/native-fnv.json

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

echo "bridge_test"
$CXX $CXXFLAGS -w native/src/dungeonmaker_unity.cpp native/src/bridge.cpp native/test/bridge_test.cpp -o "$OUT/bridge_test"
"$OUT/bridge_test" >/dev/null

echo "native_hashes ($MODE)"
$CXX $CXXFLAGS -w native/src/dungeonmaker_unity.cpp native/src/bridge.cpp native/test/native_hashes.cpp -o "$OUT/native_hashes"
"$OUT/native_hashes" 2>/dev/null >"$OUT/hashes.json" || {
  "$OUT/native_hashes" >/dev/null
  exit 1
}
case "$MODE" in
  --write)
    mkdir -p "$(dirname "$GOLDEN")"
    cp "$OUT/hashes.json" "$GOLDEN"
    echo "wrote $GOLDEN"
    ;;
  --check)
    diff -u "$GOLDEN" "$OUT/hashes.json"
    ;;
  *)
    echo "usage: $0 [--check|--write]" >&2
    exit 2
    ;;
esac

echo "native tests passed"
