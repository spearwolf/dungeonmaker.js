# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A modernization of a 2014 experiment: the C++ procedural dungeon generator **DungeonMaker 2.05** (Peter Henningsen / alifegames, GPL) becomes the npm package **`dungeonmaker-js`** — WebAssembly core, Web Worker client, Node CLI, demo site. The binding design is `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md` (phases in §10).

**Status (2026-10-31):** phase 0 + 1 are done (plan: `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-0-1.md`); `dungeonmaker-js@0.0.2` was published by CI with provenance. So far the package only has the `dungeonmaker-js/core` entry (`loadCore()` → `generate(designText, seed)`), which takes legacy design _text_. Next is phase 2 (JSON design config, `parseDesignText`/`toDesignText`, TypeBox schema, presets).

The 2014 asm.js build (root `index.*`, `createdungeon*`, `pre.js`, `build.sh`, `dist/`) was removed from `master`; it lives at the tag `legacy-2014`, its demo at `legacy-2014-demo` (the `gh-pages` branch keeps serving it until the new site exists).

## Layout

- `native/vendor/dungeonmaker-2.05/` — upstream sources, manual and the eleven sample designs, **byte-identical** to the release tarball. Never edit; see `native/vendor/README.md`.
- `native/src/` — own C++: unity translation unit (PRNG redirection), C-ABI bridge.
- `native/patches/` — minimal upstream patches with a header (what/why/date), applied by `native/prepare-sources.sh` to a copy of the vendor sources.
- `native/build.sh` — Emscripten build in a pinned `emscripten/emsdk` container; writes `packages/dungeonmaker-js/wasm/` (committed build output).
- `packages/dungeonmaker-js/` — the npm package (TypeScript, ESM only, emitted with `tsc`).

The toolchain is pnpm (versions pinned in `mise.toml`; run tools via `mise x -- …`), TypeScript, Vitest, Biome. `emcc` is never installed locally; only the container runs it.

## Commands

- `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest projects: the package and `scripts/`) · `pnpm build`
- `pnpm size` · `pnpm check:package` (publint + attw) · `pnpm pack:smoke` (installs the packed tarball in an empty project)
- `sh native/test/run.sh` — native tests with GCC and clang; compares hashes against `packages/dungeonmaker-js/test/golden/native-fnv.json`. `--write` regenerates that file — only after understanding _why_ a hash changed; it must never be adjusted to make a test pass.
- `sh native/build.sh` — rebuilds the wasm (docker/podman, ~45 s cold); the output is bit-reproducible and CI's `wasm-drift` job fails if the committed wasm does not match `native/`. Commit native changes together with the rebuilt `wasm/`.
- Releases: bump the version, push — see `RELEASING.md`.

## Determinism contract

Same design text + same seed + same major version = byte-identical cells, on every platform. Guarded by the golden hashes (native GCC, native clang and wasm must agree). Anything that changes generated output for an existing design is a major-version change.

## Gotchas in the vendored library

- **Axes:** the map is stored as `Map[x * dimY + y]`; library `x` is the _row_ (north = `x--`), `y` the _column_ (east = `y++`). Read linearly, that is already north-up row-major with `width = dimY`, `height = dimX`. The 2014 bridge transposed it.
- **Cell enum:** `alifegames::SquareData` order is `OPEN, CLOSED, G_OPEN, G_CLOSED, NJ_OPEN, NJ_CLOSED, NJ_G_OPEN, NJ_G_CLOSED, IR_OPEN, IT_OPEN, IA_OPEN, H_DOOR, V_DOOR, MOB1–3, TREAS1–3, COLUMN` (0–19).
- **Seed:** `Init_fromFile`/`Init_fromText` replace seed `0` with `time(NULL)`; `Init_fromConfig` calls `srand(seed)` directly. The package only accepts seeds `1 … 2³²−1`.
- **Exit paths:** `Init_fromFile`/`Init_fromText` call `exit(1)` on parse errors. Use `Config::AcceptDesign` + `Init_fromConfig` instead.
- **Parser traps (upstream):** malformed tokens or lists without terminator make the original `AcceptDesign` loop forever, missing records leave `Config` fields uninitialized, a missing `BC`/`BR` trips an `assert`. Our build is protected by patch `0002` (defined `Config` values, `AcceptDesign` returns false on any failed read or unknown token) plus the bridge's own checks in `native/src/bridge.cpp` (D record + `XX`, map 3..4096, BC/BR/BT with 11 entries, S/C/AC/AT/J/ZU/ZD present).
- **Design format:** line-oriented, first token = record type (`D`, `R`, `BC`, …), `XX` = comment. Authoritative spec: `native/vendor/dungeonmaker-2.05/DM2_Manual/manDesign.txt` plus `Config::AcceptDesign`.
- **Evaluation order:** several `rand()`-drawing calls as arguments of one function call give compiler-dependent results (GCC right to left, clang left to right); patch `0001` sequences the known cases. New such code must draw into locals first.
- `PlonkDownStuff()`/`PutPlonkOnMap()` are public but not called by `generate()`; MOB/treasure cells only appear when a design places them via `R` rectangles. Before enabling entities (phase 4): `PlonkDownStuff` reads a sometimes-uninitialized `startX`, and `SortRooms()` uses `std::sort` with possible ties (order may differ between libc++ and libstdc++).
