// SPDX-License-Identifier: GPL-3.0-or-later
// The only render module that names DOM types.
import type { DungeonLike } from './ascii.js';
import { type RasterOptions, toRgba } from './raster.js';

/** The raster as `ImageData` (needs a DOM or worker global). */
export function toImageData(dungeon: DungeonLike, options?: RasterOptions): ImageData {
  const { width, height, data } = toRgba(dungeon, options);
  return new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height);
}

/** Resizes the canvas to `width * scale` x `height * scale` and paints the map. */
export function drawToCanvas(
  dungeon: DungeonLike,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options?: RasterOptions,
): void {
  const image = toImageData(dungeon, options);
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('the canvas has no 2d context');
  ctx.putImageData(image, 0, 0);
}
