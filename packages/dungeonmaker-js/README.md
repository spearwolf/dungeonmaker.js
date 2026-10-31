# dungeonmaker-js

Procedural dungeon generation for JavaScript: an **unofficial** WebAssembly port of
[DungeonMaker 2.05](http://dungeonmaker.sourceforge.net/) by Peter Henningsen.

> **Status 0.x:** core, JSON designs, presets, schema and the Web Worker client are available.
> The API is not stable yet; a CLI follows.

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

## License

GPL-3.0-or-later. This package includes a modified version of DungeonMaker 2.05,
© Peter Henningsen; see `LICENSE` and `NOTICE`.

If you build this package into an application you ship (a web bundle counts), assume that the
application must be released under a GPL-compatible license. Dungeons generated offline and
shipped as plain data are program output, not GPL-covered code.

Corresponding source for every published version: git tag `v<version>` at
<https://github.com/spearwolf/dungeonmaker.js>.
