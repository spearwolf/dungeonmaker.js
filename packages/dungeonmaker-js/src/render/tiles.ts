// SPDX-License-Identifier: GPL-3.0-or-later
import type { DungeonLike } from './ascii.js';

/** Coarse tile classes of a cell. */
export const Tile = { Floor: 0, Wall: 1, Door: 2, Column: 3, Mob: 4, Treasure: 5 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Tile per cell value (index = `Cell`). */
const TILE_OF_CELL: readonly Tile[] = [
  Tile.Floor, // Open
  Tile.Wall, // Closed
  Tile.Floor, // GuaranteedOpen
  Tile.Wall, // GuaranteedClosed
  Tile.Floor, // NonJoinOpen
  Tile.Wall, // NonJoinClosed
  Tile.Floor, // NonJoinGuaranteedOpen
  Tile.Wall, // NonJoinGuaranteedClosed
  Tile.Floor, // InsideRoomOpen
  Tile.Floor, // InsideTunnelOpen
  Tile.Floor, // InsideAnteroomOpen
  Tile.Door, // HorizontalDoor
  Tile.Door, // VerticalDoor
  Tile.Mob,
  Tile.Mob,
  Tile.Mob,
  Tile.Treasure,
  Tile.Treasure,
  Tile.Treasure,
  Tile.Column,
];

/** Collapses the 20 cell values to {@link Tile} classes, same layout as `cells`. */
export function toTiles(dungeon: DungeonLike): Uint8Array {
  const { cells } = dungeon;
  const out = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) out[i] = TILE_OF_CELL[cells[i] ?? 0] ?? Tile.Floor;
  return out;
}
