#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copies the vendored DungeonMaker sources to OUT_DIR and applies native/patches/*.patch
# in name order. The vendor directory itself is never modified (spec §9.3).
# Usage: native/prepare-sources.sh OUT_DIR
set -eu
cd "$(dirname "$0")/.."
OUT_DIR=${1:?usage: native/prepare-sources.sh OUT_DIR}

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp native/vendor/dungeonmaker-2.05/DungeonMaker.cpp native/vendor/dungeonmaker-2.05/DungeonMaker.h "$OUT_DIR/"
for p in native/patches/*.patch; do
  [ -e "$p" ] || continue
  patch -p1 -s --no-backup-if-mismatch -d "$OUT_DIR" <"$p"
done
