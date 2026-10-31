// SPDX-License-Identifier: GPL-3.0-or-later
import { type DungeonLike, toAscii } from '../render/ascii.js';

/** {@link toAscii} with a trailing newline. */
export function toAsciiText(dungeon: DungeonLike): string {
  return `${toAscii(dungeon)}\n`;
}

/** u32 LE width, u32 LE height, then one byte per cell. */
export function toRaw(dungeon: DungeonLike): Uint8Array {
  const out = new Uint8Array(8 + dungeon.cells.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, dungeon.width, true);
  view.setUint32(4, dungeon.height, true);
  out.set(dungeon.cells, 8);
  return out;
}
