# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A modernization of a 2014 experiment: the C++ procedural dungeon generator **DungeonMaker 2.05** (Peter Henningsen / alifegames, GPL) becomes the npm package **`dungeonmaker-js`** — WebAssembly core, Web Worker client, Node CLI, demo site. The binding design is `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md`; the current implementation plan (phase 0 + 1) is `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-0-1.md`.

The 2014 asm.js build (root `index.*`, `createdungeon*`, `pre.js`, `build.sh`, `dist/`) was removed from `master`; it lives at the tag `legacy-2014`, its demo at `legacy-2014-demo` (the `gh-pages` branch keeps serving it until the new site exists).

## Layout

- `native/vendor/dungeonmaker-2.05/` — upstream sources, manual and the eleven sample designs, **byte-identical** to the release tarball. Never edit; see `native/vendor/README.md`.
- `native/src/` — own C++: unity translation unit (PRNG redirection), C-ABI bridge.
- `native/patches/` — minimal upstream patches with a header (what/why/date); none yet.
- `native/build.sh` — Emscripten build in a pinned `emscripten/emsdk` container; writes `packages/dungeonmaker-js/wasm/` (committed build output).
- `packages/dungeonmaker-js/` — the npm package (TypeScript, ESM only, emitted with `tsc`).

The toolchain is pnpm (versions pinned in `mise.toml`), TypeScript, Vitest, Biome. `emcc` is never installed locally; only the container runs it.

## Gotchas in the vendored library

- **Axes:** the map is stored as `Map[x * dimY + y]`; library `x` is the _row_ (north = `x--`), `y` the _column_ (east = `y++`). Read linearly, that is already north-up row-major with `width = dimY`, `height = dimX`. The 2014 bridge transposed it.
- **Cell enum:** `alifegames::SquareData` order is `OPEN, CLOSED, G_OPEN, G_CLOSED, NJ_OPEN, NJ_CLOSED, NJ_G_OPEN, NJ_G_CLOSED, IR_OPEN, IT_OPEN, IA_OPEN, H_DOOR, V_DOOR, MOB1–3, TREAS1–3, COLUMN` (0–19).
- **Seed:** `Init_fromFile`/`Init_fromText` replace seed `0` with `time(NULL)`; `Init_fromConfig` calls `srand(seed)` directly. The package only accepts seeds `1 … 2³²−1`.
- **Exit paths:** `Init_fromFile`/`Init_fromText` call `exit(1)` on parse errors. Use `Config::AcceptDesign` + `Init_fromConfig` instead.
- **Parser traps:** a `D` record not followed by an `XX` token makes `AcceptDesign` loop forever; a design missing the `BC`/`BR` records trips an `assert` in `Init_fromConfig`.
- **Design format:** line-oriented, first token = record type (`D`, `R`, `BC`, …), `XX` = comment. Authoritative spec: `native/vendor/dungeonmaker-2.05/DM2_Manual/manDesign.txt` plus `Config::AcceptDesign`.
- `PlonkDownStuff()`/`PutPlonkOnMap()` are public but not called by `generate()`; MOB/treasure cells only appear when a design places them via `R` rectangles.
