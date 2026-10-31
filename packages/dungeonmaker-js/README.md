# dungeonmaker-js

Procedural dungeon generation for JavaScript: an **unofficial** WebAssembly port of
[DungeonMaker 2.05](http://dungeonmaker.sourceforge.net/) by Peter Henningsen.

> **Status 0.0.x:** only the low-level entry point `dungeonmaker-js/core` exists. The API is
> not stable yet; the Web Worker client, JSON design configs and a CLI follow.

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

## License

GPL-3.0-or-later. This package includes a modified version of DungeonMaker 2.05,
© Peter Henningsen; see `LICENSE` and `NOTICE`.

If you build this package into an application you ship (a web bundle counts), assume that the
application must be released under a GPL-compatible license. Dungeons generated offline and
shipped as plain data are program output, not GPL-covered code.

Corresponding source for every published version: git tag `v<version>` at
<https://github.com/spearwolf/dungeonmaker.js>.
