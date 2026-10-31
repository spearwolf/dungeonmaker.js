# dungeonmaker-js

Procedural dungeon generation for JavaScript: an **unofficial** WebAssembly port of
[DungeonMaker 2.05](http://dungeonmaker.sourceforge.net/) by Peter Henningsen.

> **Status 0.x:** core, JSON designs, presets and schema are available. The API is not stable
> yet; the Web Worker client and a CLI follow.

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

## License

GPL-3.0-or-later. This package includes a modified version of DungeonMaker 2.05,
© Peter Henningsen; see `LICENSE` and `NOTICE`.

If you build this package into an application you ship (a web bundle counts), assume that the
application must be released under a GPL-compatible license. Dungeons generated offline and
shipped as plain data are program output, not GPL-covered code.

Corresponding source for every published version: git tag `v<version>` at
<https://github.com/spearwolf/dungeonmaker.js>.
