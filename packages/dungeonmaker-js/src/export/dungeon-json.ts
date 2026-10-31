// SPDX-License-Identifier: GPL-3.0-or-later
import { CELL_NAMES } from '../config/tokens.js';
import type { DungeonLayers } from '../layers.js';
import type { DungeonLike } from '../render/ascii.js';
import type { DungeonFile } from '../schema/dungeon-file.js';
import type { DesignConfig } from '../schema/model.js';
import { VERSION } from '../version.js';
import { bytesToBase64, typedToBase64 } from './base64.js';

export interface ExportableDungeon extends DungeonLike, DungeonLayers {
  readonly seed: number;
}

/** A preset by name, or any other design by hash (and optionally the design itself). */
export type DungeonSource =
  | { readonly preset: string }
  | { readonly designHash: string; readonly design?: DesignConfig };

export interface DungeonFileOptions {
  source?: DungeonSource;
  /** Default `'base64'`. */
  cells?: 'base64' | 'rows' | 'array';
  /** Default `dungeonmaker-js@<version>`. */
  generator?: string;
}

export const DUNGEON_FORMAT = 'dungeonmaker-js/dungeon';
export const DUNGEON_FORMAT_VERSION = 1;
/** One character per cell value, index = `Cell`; unlike the ASCII table it is lossless. */
export const ROWS_ALPHABET = " #~%.x_X',^=|123456@";

function encodeCells(
  dungeon: DungeonLike,
  kind: 'base64' | 'rows' | 'array',
): DungeonFile['cells'] {
  const { width, height, cells } = dungeon;
  if (kind === 'array') return { encoding: 'array', data: Array.from(cells) };
  if (kind === 'rows') {
    const data: string[] = [];
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) row += ROWS_ALPHABET[cells[y * width + x] ?? 0] ?? ' ';
      data.push(row);
    }
    return { encoding: 'rows', alphabet: ROWS_ALPHABET, data };
  }
  return { encoding: 'base64', data: bytesToBase64(cells) };
}

/** The self-describing file structure for a dungeon; keys in a fixed order. */
export function toDungeonFile(
  dungeon: ExportableDungeon,
  options: DungeonFileOptions = {},
): DungeonFile {
  const file: DungeonFile = {
    format: DUNGEON_FORMAT,
    formatVersion: DUNGEON_FORMAT_VERSION,
    generator: options.generator ?? `dungeonmaker-js@${VERSION}`,
    width: dungeon.width,
    height: dungeon.height,
    seed: dungeon.seed,
  } as DungeonFile;
  if (options.source !== undefined) file.source = { ...options.source } as DungeonFile['source'];
  file.legend = Object.fromEntries(
    CELL_NAMES.map((name, i) => [String(i), name]),
  ) as DungeonFile['legend'];
  file.cells = encodeCells(dungeon, options.cells ?? 'base64');
  if (dungeon.rooms) {
    file.rooms = {
      roomIds: { encoding: 'base64', data: typedToBase64(dungeon.rooms.roomIds) },
      rooms: dungeon.rooms.rooms.map((r) => ({
        id: r.id,
        area: r.area,
        size: r.size,
        bounds: { ...r.bounds },
      })),
    };
  }
  if (dungeon.entities) file.entities = dungeon.entities.map((e) => ({ ...e }));
  if (dungeon.steps) {
    file.steps = {
      offsets: typedToBase64(dungeon.steps.offsets),
      index: typedToBase64(dungeon.steps.index),
      cell: typedToBase64(dungeon.steps.cell),
    };
  }
  return file;
}

/** {@link toDungeonFile} as 2-space JSON with a trailing newline. */
export function toDungeonJson(dungeon: ExportableDungeon, options?: DungeonFileOptions): string {
  return `${JSON.stringify(toDungeonFile(dungeon, options), null, 2)}\n`;
}
