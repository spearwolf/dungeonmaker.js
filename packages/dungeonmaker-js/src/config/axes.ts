// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * The only place where row and column swap.
 *
 * Upstream stores the map as `Map[x * dimY + y]`: library `x` is the _row_
 * (north is `x--`), library `y` the _column_ (east is `y++`), and the design
 * text lists coordinates as `row column` and sizes as `dimX dimY`
 * (`height width`). The JSON model uses the screen convention instead: `x` is
 * the column (to the right), `y` the row (downwards), north is up, and size is
 * `{ width, height }`. Every conversion between the two goes through this
 * module, so the swap happens exactly once in each direction.
 */

/** Library `(row, column)` to a JSON point `{ x: column, y: row }`. */
export function pointFromLibrary(row: number, col: number): { x: number; y: number } {
  return { x: col, y: row };
}

/** JSON point `{ x, y }` to library `[row, column]`. */
export function pointToLibrary(p: { x: number; y: number }): [row: number, col: number] {
  return [p.y, p.x];
}

/** Library `(dimX, dimY)` (rows, columns) to `{ width: dimY, height: dimX }`. */
export function sizeFromLibrary(dimX: number, dimY: number): { width: number; height: number } {
  return { width: dimY, height: dimX };
}

/** JSON size to library `[dimX, dimY]` (rows, columns). */
export function sizeToLibrary(size: {
  width: number;
  height: number;
}): [dimX: number, dimY: number] {
  return [size.height, size.width];
}
