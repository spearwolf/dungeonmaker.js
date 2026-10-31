# Orientation and cell values

## Axes

Every output of the package uses the same orientation:

- North is up. Row 0 is the northern edge, the last row the southern one.
- `x` is the column, counted from the western (left) edge. East is `x + 1`.
- `y` is the row, counted from the northern (top) edge. South is `y + 1`, north is `y - 1`.
- The cell at `(x, y)` is `cells[y * width + x]`; `width` is the number of columns, `height` the
  number of rows.

The compass directions in a design (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`) follow the same
picture: `N` points to smaller `y`, `E` to larger `x`. The map options `width` and `height` count
columns and rows, so a map of `width: 160, height: 80` is wider than it is tall.

::: info Upstream axes
The C++ library stores the map as `Map[x * dimY + y]` and calls the row index `x` and the column
index `y`; its north is `x--`. The package hides that: read linearly, the library's array is already
north-up row-major, so `D dimY` is the `width` and `D dimX` the `height` of a design. The 2014 demo
transposed the map; this package does not.
:::

## Cell values

A dungeon has 20 cell values. In the code they are the `Cell` constants, in the dungeon file the
`legend` names:

<!--@include: ./_cell-legend.md-->

The first eight values are open and closed cells in four flavours (plain, _guaranteed_, _non-join_
and both) that the generator distinguishes while it runs; once a dungeon is done, an open flavour
is floor and a closed one is wall. The three `inside…` values mark open cells that belong
to a room, a tunnel or an anteroom. Doors, mobs, treasure and columns are placed during
generation; mobs and treasure only with the entity output (`'baked'` writes them into `cells`,
`'list'` keeps them in the separate entity list).

## Collapsing to tiles

Most games do not care about 20 values. `toTiles` from `dungeonmaker-js/render` collapses a
dungeon to six tile classes in the same layout as `cells`:

| `Tile`         | Cells                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `Floor` (0)    | `Open`, `GuaranteedOpen`, `NonJoinOpen`, `NonJoinGuaranteedOpen`, the three `Inside…Open` cells |
| `Wall` (1)     | `Closed`, `GuaranteedClosed`, `NonJoinClosed`, `NonJoinGuaranteedClosed`                        |
| `Door` (2)     | `HorizontalDoor`, `VerticalDoor`                                                                |
| `Column` (3)   | `Column`                                                                                        |
| `Mob` (4)      | `Mob1` … `Mob3`                                                                                 |
| `Treasure` (5) | `Treasure1` … `Treasure3`                                                                       |

The ASCII export is lossy in a different way: it merges cells that share a character (a space for
`Open` and `GuaranteedOpen`, `#` for the closed variants). The `rows` encoding of the dungeon file
uses a lossless alphabet instead; both are listed in the table above.
