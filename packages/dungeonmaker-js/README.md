# dungeonmaker-js

Procedural dungeon generation for JavaScript: an **unofficial** WebAssembly port of
[DungeonMaker 2.05](http://dungeonmaker.sourceforge.net/) by Peter Henningsen, created and
maintained by [spearwolf](https://www.spearwolf.de). Same design, same
seed, same dungeon on every platform; the generator runs in a Web Worker or on the command line.

Demo, guides and API reference: <https://spearwolf.github.io/dungeonmaker.js/>

## Install

```sh
pnpm add dungeonmaker-js
```

`npm install`, `yarn add` and `bun add` work the same.

## Quick start (browser)

```js
import { createDungeon } from 'dungeonmaker-js';
import { design3A } from 'dungeonmaker-js/presets';

const dungeon = await createDungeon({ design: design3A, seed: 42 });
// dungeon.width, dungeon.height, dungeon.cells (Uint8Array, row-major), dungeon.get(x, y)
```

`createDungeon` runs the generator in a Web Worker. Vite and webpack 5 need no configuration; see
the [client guide](https://spearwolf.github.io/dungeonmaker.js/guide/client) for options and errors, [bundlers](https://spearwolf.github.io/dungeonmaker.js/guide/getting-started#bundlers) and the [CSP](https://spearwolf.github.io/dungeonmaker.js/guide/getting-started#content-security-policy).

## Quick start (CLI)

```sh
pnpm dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj --out ./dungeons
```

`npx dungeonmaker-js …` works the same. More in the [CLI guide](https://spearwolf.github.io/dungeonmaker.js/guide/cli).

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
`toDesignText` throws a `DesignValidationError` for a design the generator cannot run.

## Documentation

- [Getting started](https://spearwolf.github.io/dungeonmaker.js/guide/getting-started)
- [Worker client and errors](https://spearwolf.github.io/dungeonmaker.js/guide/client)
- [Bundlers](https://spearwolf.github.io/dungeonmaker.js/guide/getting-started#bundlers) and [Content Security Policy](https://spearwolf.github.io/dungeonmaker.js/guide/getting-started#content-security-policy)
- [Output layers](https://spearwolf.github.io/dungeonmaker.js/guide/layers): rooms, entities, steps
- [Rendering and export formats](https://spearwolf.github.io/dungeonmaker.js/guide/render-export)
- [Command line](https://spearwolf.github.io/dungeonmaker.js/guide/cli)
- [Generate offline, ship data](https://spearwolf.github.io/dungeonmaker.js/guide/offline)
- [Design concepts](https://spearwolf.github.io/dungeonmaker.js/guide/design-concepts) and [orientation](https://spearwolf.github.io/dungeonmaker.js/guide/orientation)
- [Config reference](https://spearwolf.github.io/dungeonmaker.js/reference/config) and [dungeon file format](https://spearwolf.github.io/dungeonmaker.js/reference/dungeon-format)
- [API reference](https://spearwolf.github.io/dungeonmaker.js/api/)
- [License notes](https://spearwolf.github.io/dungeonmaker.js/license) and [about the project](https://spearwolf.github.io/dungeonmaker.js/about)

## License

GPL-3.0-or-later. This package includes a modified version of DungeonMaker 2.05,
© Peter Henningsen, with contributions by Aaron Dalton. The port and the package are by
[spearwolf](https://www.spearwolf.de). See `LICENSE` and `NOTICE`.

If you build this package into an application you ship (a web bundle counts), assume that the
application must be released under a GPL-compatible license. Dungeons generated offline and
shipped as plain data are program output, not GPL-covered code. The dungeon file format
(`dungeon.schema.json`) is CC0-1.0.

Corresponding source for every published version: git tag `v<version>` at
<https://github.com/spearwolf/dungeonmaker.js>.
