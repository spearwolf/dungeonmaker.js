# dungeonmaker-js

Procedural dungeon generation for JavaScript: an **unofficial** WebAssembly port of
[DungeonMaker 2.05](http://dungeonmaker.sourceforge.net/) by Peter Henningsen.

> **Status 0.x:** core, JSON designs, presets, schema, the Web Worker client, output layers,
> rendering, export formats and a CLI are available. The API is not stable yet.

## Quick start (browser)

```js
import { createDungeon } from 'dungeonmaker-js';
import { design3A } from 'dungeonmaker-js/presets';

const dungeon = await createDungeon({ design: design3A, seed: 42 });
// dungeon.width, dungeon.height, dungeon.cells (Uint8Array, row-major), dungeon.get(x, y)
```

`createDungeon` runs the generator in a Web Worker, so the page stays responsive. The worker
and the wasm file are found through `new URL(…, import.meta.url)`; Vite and webpack 5 need no
configuration (see [Bundlers](#bundlers)).

## Example (Node)

```js
import { readFile } from 'node:fs/promises';
import { loadCore } from 'dungeonmaker-js/core';

const core = await loadCore();
const design = await readFile('my-design.txt', 'utf8'); // DungeonMaker design text
const { width, height, cells } = core.generate(design, 42);
// cells: Uint8Array, row-major, north-up: cells[y * width + x]
```

The same design text and seed always produce the same dungeon, on every platform.

## JSON designs and presets

```js
import { extendDesign, toDesignText } from 'dungeonmaker-js';
import { loadCore } from 'dungeonmaker-js/core';
import * as presets from 'dungeonmaker-js/presets';

const design = extendDesign(presets.designEmpty, { map: { width: 80, height: 60 } });
const core = await loadCore();
const { width, height, cells } = core.generate(toDesignText(design), 42);
```

The presets are shared objects: derive variants with `extendDesign`, never mutate a preset.
`toDesignText` throws a `DesignValidationError` (with a JSON Pointer per issue) for a design the
generator cannot run, for example rooms or builders that fall outside a smaller map.

Add `"$schema": "https://unpkg.com/dungeonmaker-js/design.schema.json"` to a JSON design for
editor autocomplete and validation; `validateDesign` from `dungeonmaker-js/schema` checks a
design at runtime. Old design files are read with `parseDesignText`.

## Worker client

`createDungeon(request, opts?)` uses one shared client. For your own instance:

```js
import { createDungeonMaker } from 'dungeonmaker-js';

const maker = createDungeonMaker({ timeout: 10_000 });
await maker.ready(); // optional warm-up
const dungeon = await maker.create({ design, seed: 7 }, { signal: AbortSignal.timeout(5_000) });
maker.dispose();
```

Options of `createDungeonMaker`:

| Option     | Default  | Meaning                                                                       |
| ---------- | -------- | ----------------------------------------------------------------------------- |
| `worker`   | bundled  | Factory returning a `Worker` (`WorkerLike`); see [Bundlers](#bundlers).       |
| `wasmUrl`  | bundled  | URL of `dungeonmaker.wasm`. Relative strings resolve against the page URL.    |
| `timeout`  | `30_000` | Milliseconds per request; `Infinity` disables it, otherwise `1 … 2147483647`. |
| `validate` | `false`  | Check the design with the schema validator first (loaded lazily).             |

- The worker starts on first use. Requests run one at a time, in order (FIFO).
  With `validate: true` a config request joins the queue only after its validation, so a
  legacy-text request made later can overtake it.
- The timeout counts from dispatch to the worker. For the first request it includes worker start.
- The design is snapshotted when `create()` is called; later changes to the object have no effect.
- `ready()` starts the worker early and rejects with `TimeoutError` after `timeout`.
- `dispose()` terminates the worker and rejects pending requests with an `AbortError`.
- Per call: `{ signal, timeout }`. The seed is `1 … 2³²−1`; omitted, a random one is drawn.

## Errors

Every failure of `create()`, `createDungeon()` and `ready()` arrives as a rejection, never as a
promise that hangs.

| Error                   | Cause                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `DesignValidationError` | The design cannot run; `issues` carry JSON Pointer paths.                                                 |
| `GenerationError`       | The library hit an internal assert. The worker recovers.                                                  |
| `TimeoutError`          | The request exceeded `timeout`. The worker restarts on the next call.                                     |
| `RangeError`            | Invalid `seed` or `timeout` (an invalid `timeout` for `createDungeonMaker` throws right away).            |
| `DataCloneError`        | The design object cannot be structured-cloned (it holds a function or a symbol); a `DOMException`.        |
| `WorkerError`           | The worker could not start, crashed or speaks another protocol: a bundler or CSP problem, not the design. |
| `signal.reason`         | The call was aborted; by default an `AbortError` `DOMException`.                                          |

## Bundlers

Vite (build and dev) and webpack 5 (`--mode production`) build the client without configuration;
`pnpm bundler:smoke` in the repository verifies this against the packed tarball.

If your bundler cannot resolve the worker or the wasm file, pass them explicitly:

```js
const maker = createDungeonMaker({
  wasmUrl: '/assets/dungeonmaker.wasm', // the file at `dungeonmaker-js/dungeonmaker.wasm`
  worker: () => new Worker(new URL('./dm-worker.js', import.meta.url), { type: 'module' }),
});
```

with `dm-worker.js` containing only

```js
import 'dungeonmaker-js/worker';
```

## Content Security Policy

A strict policy works with these directives:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'
```

`'wasm-unsafe-eval'` is required because the worker calls `WebAssembly.compile`. The worker script
and the wasm file must be served from your own origin; `worker-src` covers the worker.

## Output layers

Besides the cells, `output` requests optional layers. `createDungeon`, `maker.create` and
`core.generate(designText, seed, output)` all take it; without `output` the result has only the
cells, byte-identical to before.

```js
const dungeon = await createDungeon({
  design: design3A,
  seed: 42,
  output: { rooms: true, entities: 'list', steps: true },
});
```

| Option              | Result                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rooms: true`       | `dungeon.rooms`: `roomIds` (`Uint16Array`, one id per cell, `0` = no room) and `rooms: { id, area: 'labyrinth' \| 'dungeon', size, bounds }[]` (screen coordinates). Ids are `uint16`, so at most 65 535 rooms. |
| `entities: 'list'`  | `dungeon.entities`: `{ kind: 'mob' \| 'treasure', x, y, level }[]`, MOBs first. Cells stay unchanged.                                                                                                           |
| `entities: 'baked'` | No `entities` field; MOBs and treasure are written into `cells` (`Mob1-3`, `Treasure1-3`).                                                                                                                      |
| `steps: true`       | `dungeon.steps`: `offsets`, `index` (`y * width + x`) and `cell`. Frame `k` is `index[offsets[k] … offsets[k + 1])`.                                                                                            |

- **Entities are upstream demo code.** They come from the library's `PlonkDownStuff`, which its
  author calls demo code. It may place fewer entities than the design's population asks for;
  that is logged in `dungeon.diagnostics`. `level` is the index in the population list. For
  `'baked'` the level maps to the cell kind: `level < 2` is `Mob1`/`Treasure1`, `< 4` is
  `Mob2`/`Treasure2`, everything else `Mob3`/`Treasure3`. Entities need a map of at least 4x4.
  Only `'baked'` changes `cells`.
- **`steps` can be large.** Frame 0 is the start map and holds _every_ cell, so the layer is at
  least `width * height` entries long; a 1024x1024 design yields several MB. Replaying all
  frames yields `cells`. `steps` needs `showMovie` or `storeMovie` in the design (the `N` record
  of the raw design text); otherwise the request is rejected with a `DesignValidationError`.
- Unknown keys or wrong values in `output` throw a `TypeError` (a rejection in `create()`).

## Rendering

`dungeonmaker-js/render` turns a dungeon (or a `core.generate` result) into text, tile classes
and pixels, all as pure functions.

```js
import { drawToCanvas, toAscii, toTiles, Tile } from 'dungeonmaker-js/render';

console.log(toAscii(dungeon)); // rows joined by "\n"; lossy, ' ' and '#' stand for several cells
const tiles = toTiles(dungeon); // Uint8Array like `cells`: Tile.Floor, Wall, Door, Column, Mob, Treasure
drawToCanvas(dungeon, document.querySelector('canvas'), { scale: 4 }); // sizes the canvas, then paints
```

`toImageData(dungeon, { scale, palette })` returns an `ImageData`; `toRgba` returns the same
pixels without any DOM type. `scale` is an integer from 1 to 64 (default 1), `palette` overrides
`DEFAULT_PALETTE` per cell name.

`dungeonmaker-js/render` is the one entry whose declarations need the DOM lib
(`ImageData`, `HTMLCanvasElement`); every other entry type-checks without it.

## Export formats

`dungeonmaker-js/export` builds files as `string` or `Uint8Array`, with no DOM and no
dependency. The CLI and browser code share it, so for the same design, seed and options both
produce byte-identical files; the PNG encoder has its own deterministic deflate, so a PNG is the
same in Node, Chromium, Firefox and WebKit.

| Format       | File             | Function                         | Purpose                                                     |
| ------------ | ---------------- | -------------------------------- | ----------------------------------------------------------- |
| Dungeon JSON | `*.dungeon.json` | `toDungeonJson`, `toDungeonFile` | lossless, with layers, versioned; the main format           |
| PNG          | `*.png`          | `toPng`, `toTilesetPng`          | preview; indexed colour, `scale` pixels per cell            |
| Tiled map    | `*.tmj`          | `toTiledMap`                     | import into Tiled and from there into game engines          |
| ASCII        | `*.txt`          | `toAsciiText`                    | roguelikes, tests, a look in the terminal                   |
| Raw          | `*.bin`          | `toRaw`                          | 8-byte header (`width`, `height` as uint32 LE) plus `cells` |

```js
import { designSource, toDungeonJson, toPng } from 'dungeonmaker-js/export';

const json = toDungeonJson(dungeon, { source: { preset: 'design3A' } });
const png = await toPng(dungeon, { scale: 4 });
```

The dungeon JSON describes itself:

```jsonc
{
  "format": "dungeonmaker-js/dungeon", "formatVersion": 1,
  "generator": "dungeonmaker-js@0.0.2",
  "width": 160, "height": 81, "seed": 42,
  "source": { "preset": "design3A" },            // or { "designHash": "sha256:…" }, design optional
  "legend": { "0": "open", "1": "closed", … },   // cell value -> name, 0 … 19
  "cells": { "encoding": "base64", "data": "…" }, // or "rows" (with its alphabet) or "array"
  "rooms": { … }, "entities": [ … ], "steps": { … } // only when requested
}
```

Multi-byte layers are little-endian base64. The tileset for Tiled is `dungeonmaker-tiles.png`
(`toTilesetPng`); `toTiledMap` references it, and the CLI writes it next to every `.tmj`.

`designSource(design, { embed })` embeds whatever design it is given and hashes the design text
with `crypto.subtle`, which browsers only offer in a secure context (HTTPS or localhost). It
does not recognise upstream presets: a browser caller exporting a preset passes
`source: { preset: name }` itself. The CLI and `generateToFiles` always write
`{ "preset": "<name>" }` for preset content, even with `--embed-design`.

The format specification is the JSON Schema `dungeonmaker-js/dungeon.schema.json`, released
under **CC0-1.0**: write an importer in any language under any license.

## Command line

```sh
npx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj --out ./dungeons
npx dungeonmaker-js generate --design ./my-cave.json --seeds 1..50 --format json --name "cave-{seed}"
npx dungeonmaker-js generate --design ./old-design.txt --count 10 --rooms --entities list
npx dungeonmaker-js presets                      # list the eleven presets
npx dungeonmaker-js validate ./my-cave.json      # exit code 1 on errors
npx dungeonmaker-js convert ./old-design.txt     # legacy text -> design JSON
npx dungeonmaker-js schema dungeon > dungeon.schema.json
```

`pnpm dlx` works the same. `dungeonmaker-js --help` lists every option: `--seed`, `--seeds`
(`1..50,99`, at most 10 000), `--count`, `--format`, `--out`, `--name` (`{name}` and `{seed}`;
`{seed}` is required for several seeds), `--rooms`, `--entities list|baked`, `--steps`,
`--manifest`, `--embed-design`, `--scale`. Existing files are overwritten; the output is
reproducible.

Exit codes: `0` success; `1` design, validation, generation or file error; `2` usage error
(unknown command, missing or conflicting options, invalid seeds or formats).
Legacy design text is checked with `parseDesignText` first, so text the parser rejects (for
example an `N` record with `showMovie` and `storeMovie` both `0`) has to be fixed before the CLI
generates it; `dungeonmaker-js/core` takes raw text directly.

The same from a build script (Node only):

```js
import { generateToFiles } from 'dungeonmaker-js/node';

await generateToFiles({
  preset: 'design3A',
  seeds: [1, 2, 3],
  formats: ['json', 'png'],
  outDir: './dungeons',
  output: { rooms: true },
});
```

### Generate offline, ship data

Generated files are program output and are not covered by the GPL; this CLI and the package are
GPL-3.0-or-later. A game that only ships the generated maps does not link the package. Export
files contain data only (map, layers, metadata, legend, no code); upstream presets appear only
by name, and your own designs only as a hash unless you pass `--embed-design`. This is a
description of how the files are built, not legal advice.

## License

GPL-3.0-or-later. This package includes a modified version of DungeonMaker 2.05,
© Peter Henningsen; see `LICENSE` and `NOTICE`.

If you build this package into an application you ship (a web bundle counts), assume that the
application must be released under a GPL-compatible license. Dungeons generated offline and
shipped as plain data are program output, not GPL-covered code.

Corresponding source for every published version: git tag `v<version>` at
<https://github.com/spearwolf/dungeonmaker.js>.
