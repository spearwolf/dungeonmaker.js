// SPDX-License-Identifier: GPL-3.0-or-later

import type { RoomLayer } from '../src/layers.js';

/** FNV-1a 32-bit hash as 8 hex digits. No node imports, so browser tests can use it too. */
export function fnv1a32(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The bytes the golden `+rooms` hash covers: the roomIds (LE) followed by the rooms table
 * (6 int32 per room: inDungeon, size, minX, minY, maxX, maxY). No node imports.
 */
export function roomLayerBytes(rooms: RoomLayer): Uint8Array {
  const table = new Int32Array(
    rooms.rooms.flatMap((r) => [
      r.area === 'dungeon' ? 1 : 0,
      r.size,
      r.bounds.x,
      r.bounds.y,
      r.bounds.x + r.bounds.width - 1,
      r.bounds.y + r.bounds.height - 1,
    ]),
  );
  return new Uint8Array([
    ...new Uint8Array(rooms.roomIds.buffer, rooms.roomIds.byteOffset, rooms.roomIds.byteLength),
    ...new Uint8Array(table.buffer),
  ]);
}
