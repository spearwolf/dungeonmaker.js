# Getting started

`dungeonmaker-js` generates procedural dungeons in JavaScript. It is an **unofficial**
WebAssembly port of [DungeonMaker 2.05](http://dungeonmaker.sourceforge.net/) by Peter Henningsen
(with contributions by Aaron Dalton), the C++ generator published by alifegames in 2014. The
package compiles the original generator to WebAssembly, runs it in a Web Worker and wraps it in a
typed API, a set of renderers and exporters, and a command line tool. The same design and seed
always produce the same dungeon, on every platform.

The package is released under GPL-3.0-or-later; read [License](/license) before you ship it inside
an application. Want to see it first? The [Playground](/) generates dungeons in your browser.

## Install

::: code-group

```sh [pnpm]
pnpm add dungeonmaker-js
```

```sh [npm]
npm install dungeonmaker-js
```

```sh [yarn]
yarn add dungeonmaker-js
```

```sh [bun]
bun add dungeonmaker-js
```

:::

The package is ESM only. Its entries are `dungeonmaker-js` (client and design helpers),
`dungeonmaker-js/presets`, `dungeonmaker-js/schema`, `dungeonmaker-js/core`,
`dungeonmaker-js/render`, `dungeonmaker-js/export` and `dungeonmaker-js/node`.

## Quick start (browser)

```js
import { createDungeon } from 'dungeonmaker-js';
import { design3A } from 'dungeonmaker-js/presets';

const dungeon = await createDungeon({ design: design3A, seed: 42 });
// dungeon.width, dungeon.height, dungeon.cells (Uint8Array, row-major), dungeon.get(x, y)
```

`createDungeon` runs the generator in a Web Worker, so the page stays responsive. The worker
and the wasm file are found through `new URL(…, import.meta.url)`; Vite and webpack 5 need no
configuration (see [Bundlers](#bundlers)). More on the client in [Worker client](/guide/client).

## Quick start (CLI)

::: code-group

```sh [pnpm]
pnpm dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png --out ./dungeons
```

```sh [npm]
npx dungeonmaker-js generate --preset design3A --seed 42 --format json,png --out ./dungeons
```

```sh [yarn]
yarn dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png --out ./dungeons
```

```sh [bun]
bunx dungeonmaker-js generate --preset design3A --seed 42 --format json,png --out ./dungeons
```

:::

This writes `design3A-42.dungeon.json` and `design3A-42.png` into `./dungeons`. All commands and
options are listed in [Command line](/guide/cli).

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
design at runtime. Old design files are read with `parseDesignText`. Every field is listed in the
[design config reference](/reference/config); the ideas behind them are in
[Design concepts](/guide/design-concepts).

## Bundlers

Vite (build and dev) and webpack 5 (`--mode production`) build the client without configuration;
`pnpm bundler:smoke` in the repository verifies this against the packed tarball. webpack 5
production builds print a size hint for the ~264 KiB wasm file (~90 KiB gzip); it is harmless,
and `performance.assetFilter` silences it.

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

## Where to go next

- [Worker client](/guide/client): options, queueing, timeouts and errors.
- [Output layers](/guide/layers): rooms, entities and generation steps.
- [Rendering and export](/guide/render-export): ASCII, tiles, pixels, PNG, Tiled and JSON.
- [Command line](/guide/cli) and [Generate offline, ship data](/guide/offline).
- [Orientation and cell values](/guide/orientation): axes and the meaning of every cell value.
