# Patches to the vendored DungeonMaker sources

Each patch is a unified diff (`*.patch`, applied with `patch -p1` in name order) that
starts, before its first `---` line, with this header:

```
Patch: <name>.patch
Applies to: native/vendor/dungeonmaker-2.05/<file>
What: <one sentence: what changes>
Why: <one sentence, with the spec section that requires it>
Date: YYYY-MM-DD
SPDX-License-Identifier: GPL-3.0-or-later
```

`native/prepare-sources.sh` applies them to a copy of the sources (the WebAssembly build
uses `native/.build/vendor/`, the native tests a temp directory). The directory
`native/vendor/dungeonmaker-2.05/` itself always stays byte-identical to the upstream
release (see `native/vendor/README.md`), so every modification is visible as a file here.

## Current patches

- `0001-sequence-random-arguments.patch` — fixes the order in which random values passed
  as several arguments of one call are drawn (spec §5.3, platform-independent output).
- `0002-defined-config-and-strict-parsing.patch` — every `Config` field gets a defined value,
  and `AcceptDesign` rejects malformed input instead of looping forever (spec §5.3, §5.4).
