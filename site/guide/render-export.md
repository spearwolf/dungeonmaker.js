# Rendering and export

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

The dungeon JSON describes itself (`<version>` stands for the package version that wrote the file):

```jsonc
{
  "format": "dungeonmaker-js/dungeon", "formatVersion": 1,
  "generator": "dungeonmaker-js@<version>",
  "width": 160, "height": 81, "seed": 42,
  "source": { "preset": "design3A" },            // or { "designHash": "sha256:…" }, design optional
  "legend": { "0": "open", "1": "closed", … },   // cell value -> name, 0 … 19
  "cells": { "encoding": "base64", "data": "…" }, // or "rows" (with its alphabet) or "array"
  "rooms": { … }, "entities": [ … ], "steps": { … } // only when requested
}
```

Multi-byte layers are little-endian base64. The full field list is in the
[dungeon file format](/reference/dungeon-format). The tileset for Tiled is
`dungeonmaker-tiles.png` (`toTilesetPng`); `toTiledMap` references it, and the CLI writes it next
to every `.tmj`.

`designSource(design, { embed })` embeds whatever design it is given and hashes the design text
with `crypto.subtle`, which browsers only offer in a secure context (HTTPS or localhost). It
does not recognise upstream presets: a browser caller exporting a preset passes
`source: { preset: name }` itself. The CLI and `generateToFiles` always write
`{ "preset": "<name>" }` for preset content, even with `--embed-design`.

The format specification is the JSON Schema `dungeonmaker-js/dungeon.schema.json`, released
under **CC0-1.0**: write an importer in any language under any license.
