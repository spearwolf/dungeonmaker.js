# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 2014 experiment: the C++ procedural dungeon generator **DungeonMaker 2.05** (Peter Henningsen / alifegames, GPL, archived as `dungeonmaker-2.05.tar.gz`) cross-compiled with an old **fastcomp-era Emscripten to asm.js**, wrapped in a small browser API that runs generation in a Web Worker and renders the result to a `<canvas>`. No package.json, no tests, no linter, no bundler — plain ES5 scripts, a shell build script, and committed build output.

The `gh-pages` branch holds a copy of `dist/` (the live demo).

## Build & run

The toolchain is **not installed** on this machine (`emcc` is missing), and `build.sh` targets a 2014 Emscripten (asm.js + separate `.mem` memory-init file, `--embed-file`, `cwrap` with return type `'[number]'`). A current emsdk will emit WASM and different glue; treat any rebuild as a port, not a re-run.

Original build steps (from README):

```sh
tar xvf dungeonmaker-2.05.tar.gz && ln -s dungeonmaker-2.05 dungeonmaker   # both are .gitignored
cd dungeonmaker && emconfigure ./configure && emmake make && cd ..
sh build.sh                                                                  # links + assembles dist/
```

Running the demo needs an HTTP server (Worker + `.mem` are fetched via XHR):

```sh
cd dist && python3 -m http.server     # then open http://localhost:8000/
```

`createdungeon.html` (synchronous, main-thread variant) and `createdungeon_worker.html` (worker variant) can be served the same way from the repo root.

## Build pipeline — which files are source, which are generated

```
dungeonmaker/.libs/DungeonMaker.o + createdungeon.cpp + pre.js + design* (embedded FS)
        │ emcc -O2 -o index.html
        ▼
index.html (emcc's default shell, unused) · index.js (asm.js module, ~1.1 MB) · index.html.mem
        │ build.sh concatenates
        ├─ index.js + createdungeon.cwrap.js         → createdungeon.js          (sync API, globals)
        └─ index.js + createdungeon_worker.cwrap.js  → createdungeon_worker.js   (worker script)
        │ build.sh copies with sed-renamed references
        ▼
dist/index.html          ← createdungeon_worker.html  (createdungeon_main.js → dungeonmaker.js)
dist/dungeonmaker.js     ← createdungeon_main.js      (createdungeon_worker.js → dungeonmaker_worker.js)
dist/dungeonmaker_worker.js / .mem  ← createdungeon_worker.js / index.html.mem
```

Hand-written sources: `createdungeon.cpp`, `pre.js`, `createdungeon.cwrap.js`, `createdungeon_worker.cwrap.js`, `createdungeon_main.js`, `createdungeon.html`, `createdungeon_worker.html`, `build.sh`, and the `design*` files.
Everything else (`index.*`, `createdungeon.js`, `createdungeon_worker.js`, all of `dist/`) is build output that is committed. `dist/` is currently byte-for-byte in sync with its sources; edits to `createdungeon_main.js` or `createdungeon_worker.html` must be mirrored into `dist/` (build.sh does this with `sed`, no emcc needed for those two).

## Architecture

**C++ bridge (`createdungeon.cpp`)** — exports one C function, `createDungeonData(designFile, seed)`: runs `DungeonMaker::Init_fromFile` + `generate()` and writes the map into a single global `int[]` buffer laid out as `[width, height, cell(0,0), cell(1,0), …]` (row-major, `index = 2 + y*width + x`). The buffer is freed and reallocated on every call, so a previous result's pointer becomes invalid. The rest of the file (ASCII/JSON converters, `main`) is dead code from the 2009 native CLI.

**Cell codes are this project's own numbering, not the library enum.** `toInt()` maps by name: OPEN 0, CLOSED 1, G_CLOSED 2, G_OPEN 3, NJ_OPEN 4, NJ_G_OPEN 5, NJ_CLOSED 6, NJ_G_CLOSED 7, IR_OPEN 8, IT_OPEN 9, IA_OPEN 10, H_DOOR 11, V_DOOR 12, MOB1–3 13–15, TREAS1–3 16–18, COLUMN 19, unknown −1. `alifegames::SquareData` in `DungeonMaker.h` orders the first eight differently (G_OPEN=2, G_CLOSED=3, NJ_CLOSED=5, …). The JS colour tables index with `COLOR[val + 1]` against the `toInt` numbering.

**Design files (`design`, `design2`, … `designOld1`)** — unmodified copies of the library's sample designs, embedded into Emscripten's virtual FS at `/`; the design *name* passed from JS is a file path. Line-oriented text format: the first token of each line is a record type (`D` dimensions/background/openings, `R` rectangles, `BC`/`BR`/`BT` spawn probabilities, `T` room sizes, …), `XX` marks comments. The authoritative spec is `DM2_Manual/manDesign.txt` inside the tarball. The library also has `Init_fromText(designText, seed)`, which would allow passing design strings from JS without embedding files — it is not exported yet.

**Two JS front ends:**
- *Sync* (`createdungeon.cwrap.js` → `createdungeon.js`): globals `createDungeon(design, seed?)` and `showDungeon(dungeon)`. Copies the result out of `HEAP32` into a fresh `Int32Array`.
- *Worker* (the published one): `createdungeon_main.js` is a UMD-ish module exposing `dungeonmaker.{createDungeon, onCreateDungeon, showDungeon, Dungeon}`. `createDungeon(design, seed?)` lazily spawns one Worker from `createDungeon.workerUrl`, waits for the `"Ready."` message (sent by `pre.js`'s `Module.postRun`), posts `{design, seed, uuid}`, and returns a Promise resolved by matching `uuid`. Every result is also broadcast to all `onCreateDungeon` listeners (the demo page renders via that broadcast, not via the Promise). `Dungeon` wraps the array with `width`, `height`, `get(x, y)`, `set(x, y, v)`.

## Gotchas worth knowing before changing anything

- The worker posts `HEAP32.subarray(...)`; structured clone copies the **whole underlying ArrayBuffer** (16 MB `TOTAL_MEMORY`) per dungeon, and `Dungeon.data` is a view into that clone.
- Seed: JS picks `Math.random()*1e7|0` when none is given; the library calls `srand(seed)`, but treats `seed == 0` as "use `time(NULL)`", so seed 0 is not reproducible. Determinism holds only within the same libc `rand()` (native builds will not match).
- An unknown design name makes `Init_fromFile` call `exit(1)`; in the worker the Promise then never settles.
- `pre.js` assumes a worker context (`self.postMessage("Ready.")`) and routes stdout/stderr to `console.debug`/`console.warn`; it is also linked into the sync build.
- The colour table and `showDungeon` exist twice (`createdungeon.cwrap.js`, `createdungeon_main.js`) and must be kept in step.
- README says the pre-built version is in `dict/` — it means `dist/`.
