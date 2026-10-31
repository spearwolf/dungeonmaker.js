// SPDX-License-Identifier: GPL-3.0-or-later

/** Which optional layers `generate` returns besides the cells. */
export interface OutputOptions {
  /** Room ids per cell and a table of the rooms. */
  rooms?: boolean;
  /** `'list'`: MOBs and treasure as a list; `'baked'`: written into the cells (changes them). */
  entities?: false | 'list' | 'baked';
  /** The recorded generation steps; needs showMovie or storeMovie in the design. */
  steps?: boolean;
}

export interface Room {
  /** Index + 1 in creation order; matches the values in `RoomLayer.roomIds`. */
  readonly id: number;
  readonly area: 'labyrinth' | 'dungeon';
  /** Number of squares. */
  readonly size: number;
  /** Bounding box in screen coordinates (x = column, y = row). */
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface RoomLayer {
  /** width * height room ids, indexed like the cells; 0 = no room. */
  readonly roomIds: Uint16Array;
  readonly rooms: readonly Room[];
}

export interface Entity {
  readonly kind: 'mob' | 'treasure';
  readonly x: number;
  readonly y: number;
  /** Index in the design's population list. */
  readonly level: number;
}

/** All MOBs first, then all treasure, each in library order. */
export type EntityLayer = readonly Entity[];

/** Frame `k` spans `index[offsets[k] … offsets[k + 1])`; frame 0 is the start map. */
export interface StepLayer {
  readonly offsets: Uint32Array;
  /** `y * width + x` */
  readonly index: Uint32Array;
  /** The cell value set at the matching `index`. */
  readonly cell: Uint8Array;
}

export interface DungeonLayers {
  rooms?: RoomLayer;
  entities?: EntityLayer;
  steps?: StepLayer;
}

export const OUTPUT_ROOMS = 1;
export const OUTPUT_ENTITIES_LIST = 2;
export const OUTPUT_ENTITIES_BAKED = 4;
export const OUTPUT_STEPS = 8;

const KEYS = new Set(['rooms', 'entities', 'steps']);

/** Validates an untrusted value; TypeError naming the offending key. undefined → undefined. */
export function parseOutput(value: unknown): OutputOptions | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('output must be an object like { rooms?, entities?, steps? }');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!KEYS.has(key)) throw new TypeError(`unknown output option "${key}"`);
  }
  const { rooms, entities, steps } = record;
  if (rooms !== undefined && typeof rooms !== 'boolean') {
    throw new TypeError('output.rooms must be a boolean');
  }
  if (steps !== undefined && typeof steps !== 'boolean') {
    throw new TypeError('output.steps must be a boolean');
  }
  if (entities !== undefined && entities !== false && entities !== 'list' && entities !== 'baked') {
    throw new TypeError(`output.entities must be false, 'list' or 'baked'`);
  }
  return { ...record } as OutputOptions;
}

/** The bit set for the native `dm_generate` flags. */
export function outputFlags(output: OutputOptions | undefined): number {
  if (output === undefined) return 0;
  return (
    (output.rooms === true ? OUTPUT_ROOMS : 0) |
    (output.entities === 'list' ? OUTPUT_ENTITIES_LIST : 0) |
    (output.entities === 'baked' ? OUTPUT_ENTITIES_BAKED : 0) |
    (output.steps === true ? OUTPUT_STEPS : 0)
  );
}
