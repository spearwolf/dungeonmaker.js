# Dungeon file format

A `*.dungeon.json` file is the lossless export of a generated dungeon: the cell map, optional
layers (rooms, entities, generation steps) and enough metadata to reproduce it. It is written by
`toDungeonJson` from `dungeonmaker-js/export`, by the `generate` command of the CLI and by the
download menu of the [playground](/). The format has a version (`formatVersion: 1`); a reader should
check it before it trusts the layout.

The format is described by the JSON Schema
[`dungeonmaker-js/dungeon.schema.json`](https://github.com/spearwolf/dungeonmaker.js/blob/master/packages/dungeonmaker-js/dungeon.schema.json).
This specification and `dungeon.schema.json` are released under CC0-1.0: write an importer in any
language under any license.

## Example

A shortened file for the preset `design3A` with seed 42 (the `cells` data is cut; `<version>` stands for the package version that wrote the file):

```jsonc
{
  "format": "dungeonmaker-js/dungeon",
  "formatVersion": 1,
  "generator": "dungeonmaker-js@<version>",
  "width": 160,
  "height": 81,
  "seed": 42,
  "source": { "preset": "design3A" },
  "legend": { "0": "open", "1": "closed", "…": "…", "19": "column" },
  "cells": { "encoding": "base64", "data": "…" }
  // "rooms", "entities" and "steps" appear only when the layer was requested
}
```

## Cells and layers

`cells` is row-major with north up: the cell at column `x` and row `y` is `cells[y * width + x]`.
See [Orientation](/guide/orientation) for the axes and the meaning of the 20 cell values. The
`legend` maps each value to a name, so a reader does not need the table.

`cells` comes in three encodings, chosen by the writer (`cells: 'base64' | 'rows' | 'array'`):

- `base64` (default): one byte per cell, base64 encoded. Compact; use it when you parse the file.
- `rows`: one string per row, one character per cell, taken from the stored `alphabet`. It is
  lossless (unlike the ASCII export, which merges cells) and readable in a diff.
- `array`: a plain JSON array of `width * height` integers.

Binary layers are base64 as well, and every multi-byte value is little-endian: `rooms.roomIds` is
one `uint16` per cell (0 = no room, otherwise the room `id`), `steps.offsets` and `steps.index` are
`uint32` arrays. `steps.cell` is one byte per recorded change. Entity and room positions use the
same axes as `cells`: `x` is the column, `y` the row.

## The `source` field

`source` says which design the dungeon came from, without copying designs that are not yours to
copy:

- A preset appears as `{ "preset": "<name>" }`, never with its text. The CLI and `generateToFiles`
  write this form for any design whose text equals a preset, even with `--embed-design`.
- Any other design appears as `{ "designHash": "sha256:…" }`, the SHA-256 of the design text. The
  design itself is embedded (`design`) only on request.
- A file without `source` makes no claim about its origin.

With the seed, the `generator` version and the design, a file can be reproduced byte for byte: the
same version writes the same bytes.

## Fields

<!--@include: ./_dungeon-fields.md-->
