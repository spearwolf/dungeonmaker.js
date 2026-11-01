# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A modernization of a 2014 experiment: the C++ procedural dungeon generator **DungeonMaker 2.05** (Peter Henningsen / alifegames, GPL) becomes the npm package **`dungeonmaker-js`** — WebAssembly core, Web Worker client, Node CLI, demo site. The binding design is `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md` (phases in §10).

**Status (2026-11-01):** phases 0–5 are done (plans: `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-0-1.md`, `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-2.md`, `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-3.md`, `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-4.md`, `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-5.md`). All of them are merged into `master` (phase 4: output layers, render, export, CLI; phase 5: site, docs, release tooling). Nothing of 2–5 is **released** (release `1.0.0` is pending): the published `dungeonmaker-js@0.0.2` predates them and only has the `core` entry. The package has the entries `dungeonmaker-js` (`createDungeon`, `createDungeonMaker`, `parseDesignText`, `toDesignText`, `extendDesign`, `Cell`, error classes, model types, `OutputOptions` and layer types), `dungeonmaker-js/schema` (`validateDesign`, TypeBox schema), `dungeonmaker-js/presets` (the eleven upstream designs as JSON), `dungeonmaker-js/design.schema.json`, `dungeonmaker-js/dungeon.schema.json` (dungeon file format, CC0-1.0), `dungeonmaker-js/core` (`loadCore()` → `generate(designText, seed, output?)`, takes legacy design _text_), `dungeonmaker-js/worker` (the worker module, for the `worker` escape hatch), `dungeonmaker-js/render` (`toAscii`, `toTiles`, `toRgba`, `toImageData`, `drawToCanvas`; the only entry whose types need the DOM lib), `dungeonmaker-js/export` (dungeon JSON, PNG, Tiled `.tmj`, ASCII, raw) and `dungeonmaker-js/node` (`generateToFiles`, Node only) plus the `dungeonmaker-js` CLI (`generate`, `presets`, `validate`, `convert`, `schema`; exit codes 0 ok, 1 design/validation/generation/file error, 2 usage error). Phase 5 adds `site/` (VitePress doc site and demo at `https://spearwolf.github.io/dungeonmaker.js/`, base `/dungeonmaker.js/`), short READMEs, `packages/dungeonmaker-js/CHANGELOG.md`, `scripts/compliance-check.mjs` and the Pages deploy workflow. The old 2014 demo is served from the `gh-pages` branch until the owner switches over.

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
- `site/` — private workspace package `dungeonmaker-js-site` (VitePress 1.6.4, English only), built against the local package.
  - `src/` — framework-free demo logic, tested in Node (`test/`): CLI command and runner choice, source rule, downloads, overlay raster, step player, viewport, design lint, save/legacy import, seed, `takeLatest`.
  - `components/` — thin Vue SFCs (`Playground`, `Workbench`, `DungeonView`, `DownloadMenu`, `DesignEditor`); no logic that needs tests; not type-checked (no `vue-tsc`). Interactive components sit in `<ClientOnly>` and `import()` their modules in `onMounted`.
  - `scripts/` — `generate-reference.mjs` + `reference.mjs` (config reference, dungeon-field table and cell legend from the JSON schemas and the package), `e2e.mjs` (Playwright/Chromium).
  - `guide/`, `reference/`, `editor.md`, `index.md`, `license.md` — hand-written pages. Generated and gitignored: `site/api/**` (TypeDoc), `site/reference/config.md`, `site/reference/_dungeon-fields.md`, `site/guide/_cell-legend.md`; `pnpm generate` in `site/` (run by `dev`/`build`) writes them.
- `fixtures/bundlers/` — Vite and webpack fixtures (just `package.json` and `index.html`, deliberately no bundler config); `scripts/bundler-smoke.mjs` copies them to temp dirs and builds them against the packed tarball.

The toolchain is pnpm (versions pinned in `mise.toml`; run tools via `mise x -- …`), TypeScript, Vitest, Biome. `emcc` is never installed locally; only the container runs it.

## Commands

- `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest projects: the package, `scripts/` and `site/`) · `pnpm build` (builds only the package, not the site)
- `pnpm site:dev` · `pnpm site:build` (both build the package first, then regenerate reference/API pages) · `pnpm site:e2e` (Chromium against `site/.vitepress/dist`; needs `site:build` first) · `pnpm compliance` (checks the packed tarball against the licence rules; also runs before every publish)
- `pnpm --filter dungeonmaker-js generate` — regenerates `src/presets/*.ts` and `design.schema.json` from the vendor designs and the TypeBox model.
- `pnpm size` · `pnpm check:package` (publint + attw) · `pnpm pack:smoke` (installs the packed tarball in an empty project, runs it, runs the CLI through `pnpm dlx` and `npx`, type-checks it without the DOM lib; `/render` is exempt)
- `pnpm --filter dungeonmaker-js test:browser` — client tests in Chromium, Firefox and WebKit against `dist/`; `DM_BROWSERS=chromium,firefox` limits the engines (WebKit is optional locally). `pnpm bundler:smoke` — Vite (build and dev) and webpack 5 build the README's browser example from the tarball without config; served under the strict CSP from the README, in Chromium. Both need `pnpm build` first.
- `sh native/test/run.sh` — native tests with GCC and clang; compares hashes against `packages/dungeonmaker-js/test/golden/native-fnv.json`. `--write` regenerates that file — only after understanding _why_ a hash changed; it must never be adjusted to make a test pass.
- `sh native/build.sh` — rebuilds the wasm (docker/podman, ~45 s cold); the output is bit-reproducible and CI's `wasm-drift` job fails if the committed wasm does not match `native/`. Commit native changes together with the rebuilt `wasm/`.
- Releases: bump the version, push — see `RELEASING.md`.

## Site gotchas

- **TypeScript 6.0.3 in `site/`** (the package stays on TS 7): TypeDoc 0.28 accepts TS 6.0 at most. `site/tsconfig.json` has no `allowJs`: it would make tsc infer the package's wasm glue and break the package's `@ts-expect-error`. A `.mjs` imported from a `.ts` test ships a `.d.mts` next to it (`scripts/reference.d.mts`).
- **Downloads must stay byte-identical to the CLI** (same exporters, same options, `generator` = `dungeonmaker-js@<VERSION>`, same source rule incl. `{ preset }` for preset-equal text): guarded by `site/test/downloads.test.ts`. The "Copy CLI command" pins the version for the same reason.
- **README sections run as tests:** `## Quick start (browser)` and `## JSON designs and presets` in the package README are executed by `bundler:smoke` and `pack:smoke`; keep both headings and their code blocks runnable.
- **VitePress 1.x runs on Vite 5**; `vite.worker.format` is `'es'` (module worker). `pnpm-workspace.yaml` sets `allowBuilds: esbuild: false` so VitePress's esbuild postinstall is skipped.
- **The editor chunk is large (~931 kB):** `codemirror-json-schema` statically pulls in json5/yaml parsers and markdown-it/shiki. `build.chunkSizeWarningLimit` is raised in `site/.vitepress/config.ts` instead of fighting it.
- **E2E:** `site/scripts/e2e.mjs` serves `site/.vitepress/dist` only below `/dungeonmaker.js/` (a base mistake fails loudly); `E2E_BASE_URL` checks a live site instead. Checks wait on `data-state` attributes, never on sleeps or load.
- `ignoreDeadLinks` is `false`: dead links break the build. TypeDoc runs with `treatWarningsAsErrors`; fix by exporting the type or an `intentionallyNotExported` entry with a reason.

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
