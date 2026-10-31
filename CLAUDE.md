# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A modernization of a 2014 experiment: the C++ procedural dungeon generator **DungeonMaker 2.05** (Peter Henningsen / alifegames, GPL) becomes the npm package **`dungeonmaker-js`** — WebAssembly core, Web Worker client, Node CLI, demo site. The binding design is `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md` (phases in §10).

**Status (2026-10-31):** phases 0–4 are done (plans: `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-0-1.md`, `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-2.md`, `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-3.md`, `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-4.md`). Phases 2 and 3 are on `master`; phase 4 (output layers, render, export, CLI) lives on branch `phase-4-layers-export-cli`. Nothing of 2–4 is **released**: the published `dungeonmaker-js@0.0.2` predates them and only has the `core` entry. The package has the entries `dungeonmaker-js` (`createDungeon`, `createDungeonMaker`, `parseDesignText`, `toDesignText`, `extendDesign`, `Cell`, error classes, model types, `OutputOptions` and layer types), `dungeonmaker-js/schema` (`validateDesign`, TypeBox schema), `dungeonmaker-js/presets` (the eleven upstream designs as JSON), `dungeonmaker-js/design.schema.json`, `dungeonmaker-js/dungeon.schema.json` (dungeon file format, CC0-1.0), `dungeonmaker-js/core` (`loadCore()` → `generate(designText, seed, output?)`, takes legacy design _text_), `dungeonmaker-js/worker` (the worker module, for the `worker` escape hatch), `dungeonmaker-js/render` (`toAscii`, `toTiles`, `toRgba`, `toImageData`, `drawToCanvas`; the only entry whose types need the DOM lib), `dungeonmaker-js/export` (dungeon JSON, PNG, Tiled `.tmj`, ASCII, raw) and `dungeonmaker-js/node` (`generateToFiles`, Node only) plus the `dungeonmaker-js` CLI (`generate`, `presets`, `validate`, `convert`, `schema`; exit codes 0 ok, 1 design/validation/generation/file error, 2 usage error). Next is the doc site and the demo.

The 2014 asm.js build (root `index.*`, `createdungeon*`, `pre.js`, `build.sh`, `dist/`) was removed from `master`; it lives at the tag `legacy-2014`, its demo at `legacy-2014-demo` (the `gh-pages` branch keeps serving it until the new site exists).

## Layout

- `native/vendor/dungeonmaker-2.05/` — upstream sources, manual and the eleven sample designs, **byte-identical** to the release tarball. Never edit; see `native/vendor/README.md`.
- `native/src/` — own C++: unity translation unit (PRNG redirection), C-ABI bridge.
- `native/patches/` — minimal upstream patches with a header (what/why/date), applied by `native/prepare-sources.sh` to a copy of the vendor sources.
- `native/build.sh` — Emscripten build in a pinned `emscripten/emsdk` container; writes `packages/dungeonmaker-js/wasm/` (committed build output).
- `packages/dungeonmaker-js/` — the npm package (TypeScript, ESM only, emitted with `tsc`).
  - `src/config/` — design text parser/serializer, semantic checks, `extendDesign` (no TypeBox runtime; axis swap only in `axes.ts`).
  - `src/client/` — main-thread client (`createDungeonMaker`: lazy worker, FIFO queue, timeout, abort); `src/worker/` — worker-side handler; `src/protocol.ts` — message types shared by both (`v: 1`).
  - `src/render/` — ASCII, tile classes, RGBA raster, canvas (`canvas.ts` is the only file naming DOM types); `src/export/` — dungeon JSON, own deterministic deflate + PNG, Tiled, ASCII/raw text; `src/node/` — `generateToFiles`, CLI logic (`commands.ts`, in-process testable) and the bin starter `cli.ts`; `src/layers.ts` — output option and layer types.
  - `src/schema/` — TypeBox model (single source of types and schema), `validateDesign`; the only place importing `typebox`.
  - `src/presets/` — generated preset modules; `design.schema.json` at the package root is generated too. Regenerate both with `pnpm --filter dungeonmaker-js generate` (a test checks for drift).
- `fixtures/bundlers/` — Vite and webpack fixtures (just `package.json` and `index.html`, deliberately no bundler config); `scripts/bundler-smoke.mjs` copies them to temp dirs and builds them against the packed tarball.

The toolchain is pnpm (versions pinned in `mise.toml`; run tools via `mise x -- …`), TypeScript, Vitest, Biome. `emcc` is never installed locally; only the container runs it.

## Commands

- `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest projects: the package and `scripts/`) · `pnpm build`
- `pnpm --filter dungeonmaker-js generate` — regenerates `src/presets/*.ts` and `design.schema.json` from the vendor designs and the TypeBox model.
- `pnpm size` · `pnpm check:package` (publint + attw) · `pnpm pack:smoke` (installs the packed tarball in an empty project, runs it, runs the CLI through `pnpm dlx` and `npx`, type-checks it without the DOM lib; `/render` is exempt)
- `pnpm --filter dungeonmaker-js test:browser` — client tests in Chromium, Firefox and WebKit against `dist/`; `DM_BROWSERS=chromium,firefox` limits the engines (WebKit is optional locally). `pnpm bundler:smoke` — Vite (build and dev) and webpack 5 build the README's browser example from the tarball without config; served under the strict CSP from the README, in Chromium. Both need `pnpm build` first.
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
- **Parser traps (upstream):** malformed tokens or lists without terminator make the original `AcceptDesign` loop forever, missing records leave `Config` fields uninitialized, a missing `BC`/`BR` trips an `assert`. Our build is protected by patch `0002` (defined `Config` values, `AcceptDesign` returns false on any failed read or unknown token) plus the bridge's own checks in `native/src/bridge.cpp` (D record + `XX`, map 3..4096, BC/BR/BT with 11 entries, S/C/AC/AT/J/ZU/ZD present, builder generations and `sizeUpGenDelay` not negative).
- **Design format:** line-oriented, first token = record type (`D`, `R`, `BC`, …), `XX` = comment. Authoritative spec: `native/vendor/dungeonmaker-2.05/DM2_Manual/manDesign.txt` plus `Config::AcceptDesign`.
- **Movie flags drive iteration:** `showMovie`/`storeMovie` (N record) are not cosmetic. `SetMap` records changes only when one is set, and `MakeIteration()` returns true only for recorded changes, so with both `0` every generation runs a single iteration (different dungeons whenever crawlers are seeded in tunnels mid-run). `toDesignText` always writes `showMovie = 1`; `parseDesignText` rejects `N` with both flags `0`.
- **Builder values that abort or hang:** a builder whose generation is below the active one (seed `gen < 0`, or offspring at `generation + sizeUpGenDelay` with a negative delay) is skipped by `StepAhead` but never deleted, so `AdvanceGeneration` never runs out of builders and `generate()` loops forever, uninterruptibly (it is synchronous). Crawler `corridorWidth < 1` (seeds and the `C` list) trips `assert(corridorWidth >= 0)` or `FrontFree`'s `leftFree >= 1`; tunneler `stepLength < 1` and `tunnelWidth < 0` trip `Tunneler::StepAhead`'s asserts. `checkDesign` (always on in `toDesignText`) rejects all of these. For raw text passed straight to `core.generate`, the bridge rejects the endless-loop cases (negative WS/WP/U generation, negative `sizeUpGenDelay`); the assert cases there still end as a recoverable `GenerationError`. Any value that might hang must be probed in a separate process with `timeout`, never in Vitest.
- **Bundler rules (client and worker code):** every `import('node:…')` in code a browser bundler reaches (all of `src/` except `*.d.ts`, plus the wasm glue) carries `/* webpackIgnore: true */ /* @vite-ignore */`, and there are no static `node:` imports there (webpack fails with `UnhandledSchemeError` otherwise); the glue gets the comments by post-processing in `native/build.sh`. No `new URL(<non-literal>, import.meta.url)` (webpack: "Critical dependency"). No top-level `await` in modules the worker loads (Vite builds workers as IIFE: `INVALID_TLA_FORMAT`).
- **Evaluation order:** several `rand()`-drawing calls as arguments of one function call give compiler-dependent results (GCC right to left, clang left to right); patch `0001` sequences the known cases. New such code must draw into locals first.
- `PlonkDownStuff()`/`PutPlonkOnMap()` are public and only called when `output.entities` is set (`'baked'` writes MOB/treasure cells, which changes `cells`; `'list'` does not). Patch `0003` makes them deterministic (initialised `startX`, `std::stable_sort` in `SortRooms`). Upstream draws `rand() % (dim - 3)`, so the bridge rejects entities on maps below 4x4; rooms are captured before `PlonkDownStuff` reorders them, ids are `uint16`.
- **`steps` needs movie flags:** frame 0 holds every cell (a 1024x1024 map is several MB); the bridge rejects `steps` when `showMovie` and `storeMovie` are both `0`, and, when `steps` is not requested, clears `storeMovie` only if `showMovie` is set (cells stay equal; a design with only `storeMovie` keeps it).
- **PNG/export:** PNG uses the package's own deflate (`src/export/deflate.ts`), not `CompressionStream`, so files are byte-identical in Node and all browser engines. `designSource` hashes with `crypto.subtle` (secure context) and does not recognise presets; `generateToFiles`/the CLI write `{ preset }` for preset content, even with `--embed-design`. The CLI validates legacy text with `parseDesignText` first.
