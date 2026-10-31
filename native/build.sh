#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Builds packages/dungeonmaker-js/wasm/ with a pinned Emscripten container (spec §5.1, §8.1).
# Nobody needs a local emsdk: docker or podman is enough.
set -eu
cd "$(dirname "$0")/.."

IMAGE="emscripten/emsdk:6.0.13@sha256:fb7864e398acfda863dfcea78b8bc8adad359fa60c6a0bbeb845931de64aa68a"
OUT_DIR=packages/dungeonmaker-js/wasm

if [ -n "${DM_CONTAINER_RUNTIME:-}" ]; then
  RUNTIME=$DM_CONTAINER_RUNTIME
elif command -v docker >/dev/null 2>&1; then
  RUNTIME=docker
else
  RUNTIME=podman
fi
case "$RUNTIME" in
  podman) USER_FLAGS="--userns=keep-id" ;;
  *) USER_FLAGS="--user $(id -u):$(id -g)" ;;
esac

# Asserts stay active: never add -DNDEBUG (spec §5.4).
FLAGS="-std=c++17 -O3 -flto -fno-exceptions -fno-rtti
-Wno-null-arithmetic -Wno-sometimes-uninitialized -Wno-unused-private-field
-sMODULARIZE -sEXPORT_ES6 -sEXPORT_NAME=loadDungeonMakerWasm
-sENVIRONMENT=worker,node -sFILESYSTEM=0
-sALLOW_MEMORY_GROWTH -sINITIAL_MEMORY=4MB
-sEXPORTED_FUNCTIONS=_dm_generate,_dm_width,_dm_height,_dm_cells,_dm_last_error,_dm_reset,_malloc,_free
-sEXPORTED_RUNTIME_METHODS=HEAPU8,stringToUTF8,lengthBytesUTF8,UTF8ToString
-sINCOMING_MODULE_JS_API=locateFile,instantiateWasm,print,printErr
-sSTRICT
-I native/.build/vendor
--extern-pre-js native/src/license-banner.js"

mkdir -p "$OUT_DIR"
# Patched copy of the vendor sources; the path is fixed so __FILE__ in assert messages is stable.
sh native/prepare-sources.sh native/.build/vendor

run() {
  # shellcheck disable=SC2086
  "$RUNTIME" run --rm $USER_FLAGS -v "$PWD":/src -w /src \
    -e HOME=/tmp "$IMAGE" "$@"
}

# shellcheck disable=SC2086
run em++ $FLAGS native/src/dungeonmaker_unity.cpp native/src/bridge.cpp -o "$OUT_DIR/dungeonmaker.js"

# webpack aborts on node: URIs (UnhandledSchemeError) and Vite warns about them. The glue
# only runs this import under Node, so hide it from browser bundlers.
NODE_IMPORTS=$(grep -o 'import("node:module")' "$OUT_DIR/dungeonmaker.js" | wc -l | tr -d ' ')
if [ "$NODE_IMPORTS" != 1 ]; then
  echo 'expected one import("node:module") in the glue, found '"$NODE_IMPORTS" >&2
  exit 1
fi
sed 's|import("node:module")|import(/* webpackIgnore: true */ /* @vite-ignore */ "node:module")|' \
  "$OUT_DIR/dungeonmaker.js" > "$OUT_DIR/dungeonmaker.js.tmp"
mv "$OUT_DIR/dungeonmaker.js.tmp" "$OUT_DIR/dungeonmaker.js"

EMSCRIPTEN_VERSION=$(run em++ --version | head -n 1)
# native/test is excluded on purpose: tests do not change the wasm.
NATIVE_HASH=$(find native/src native/vendor native/patches native/build.sh native/prepare-sources.sh -type f |
  LC_ALL=C sort | xargs sha256sum | sha256sum | cut -d' ' -f1)

{
  printf '{\n'
  printf '  "emscripten": "%s",\n' "$EMSCRIPTEN_VERSION"
  printf '  "image": "%s",\n' "$IMAGE"
  printf '  "flags": [\n'
  n=$(printf '%s\n' $FLAGS | wc -l)
  i=0
  for f in $FLAGS; do
    i=$((i + 1))
    if [ "$i" -lt "$n" ]; then sep=','; else sep=''; fi
    printf '    "%s"%s\n' "$f" "$sep"
  done
  printf '  ],\n'
  printf '  "nativeSourceHash": "sha256:%s"\n' "$NATIVE_HASH"
  printf '}\n'
} >"$OUT_DIR/BUILD-INFO.json"

echo "built $OUT_DIR"
