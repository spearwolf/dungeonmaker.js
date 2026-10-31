// SPDX-License-Identifier: GPL-3.0-or-later
import type { DungeonLike } from './ascii.js';
import { type Palette, paletteRgb } from './palette.js';

export interface RasterOptions {
  /** Overrides of {@link DEFAULT_PALETTE} per cell name. */
  palette?: Partial<Palette>;
  /** Integer pixel size per cell, 1..64. Default 1. */
  scale?: number;
}

/** RGBA pixels, row-major, top row first. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

const MAX_PIXELS = 67_108_864;

/** Renders the map to RGBA pixels. Throws `RangeError` for a bad scale or more than 2^26 pixels. */
export function toRgba(dungeon: DungeonLike, options: RasterOptions = {}): Raster {
  const scale = options.scale ?? 1;
  if (!Number.isInteger(scale) || scale < 1 || scale > 64) {
    throw new RangeError(`scale must be an integer from 1 to 64, got ${scale}`);
  }
  const rgb = paletteRgb(options.palette);
  const { cells } = dungeon;
  const width = dungeon.width * scale;
  const height = dungeon.height * scale;
  if (width * height > MAX_PIXELS) {
    throw new RangeError(
      `raster of ${width}x${height} pixels exceeds the limit of ${MAX_PIXELS} pixels`,
    );
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const cy = Math.floor(y / scale) * dungeon.width;
    for (let x = 0; x < width; x++) {
      const c = (cells[cy + Math.floor(x / scale)] ?? 0) * 3;
      const o = (y * width + x) * 4;
      data[o] = rgb[c] ?? 0;
      data[o + 1] = rgb[c + 1] ?? 0;
      data[o + 2] = rgb[c + 2] ?? 0;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}
