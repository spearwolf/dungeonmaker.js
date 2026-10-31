// SPDX-License-Identifier: GPL-3.0-or-later

/** Anything with the core fields: `Dungeon`, `CoreResult`. */
export interface DungeonLike {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
}

/**
 * One character per cell value (index = `Cell`), the table of the legacy `toChar()`.
 * Lossy: spaces and `#` stand for several cell values.
 */
export const ASCII_CHARS: readonly string[] = [
  ' ',
  '#',
  ' ',
  '#',
  '.',
  'x',
  '_',
  'X',
  "'",
  ',',
  '^',
  '=',
  '|',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '@',
];

/** The map as text: rows joined by `\n`, no trailing newline. */
export function toAscii(dungeon: DungeonLike): string {
  const { width, height, cells } = dungeon;
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) row += ASCII_CHARS[cells[y * width + x] ?? 0] ?? ' ';
    rows.push(row);
  }
  return rows.join('\n');
}
