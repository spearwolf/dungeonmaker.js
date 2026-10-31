// SPDX-License-Identifier: GPL-3.0-or-later
import type { Cell } from './cell.js';
import { type DungeonLayers, freezeLayers } from './layers.js';

export interface DungeonData extends DungeonLayers {
  width: number;
  height: number;
  seed: number;
  /** Row-major, north-up, `width * height` entries. */
  cells: Uint8Array;
  diagnostics: readonly string[];
}

export interface Dungeon extends Readonly<DungeonData> {
  /** Cell at column `x`, row `y`; RangeError when outside the map. */
  get(x: number, y: number): Cell;
}

export function toDungeon(data: DungeonData): Dungeon {
  const { width, height, seed, cells, diagnostics, rooms, entities, steps } = freezeLayers(data);
  return Object.freeze({
    width,
    height,
    seed,
    cells,
    diagnostics,
    ...(rooms && { rooms }),
    ...(entities && { entities }),
    ...(steps && { steps }),
    get(x: number, y: number): Cell {
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= width ||
        y >= height
      ) {
        throw new RangeError(`cell (${x}, ${y}) is outside the ${width}x${height} map`);
      }
      return cells[y * width + x] as Cell;
    },
  });
}
