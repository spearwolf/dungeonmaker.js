// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Entry point `dungeonmaker-js/render`: ASCII, tile classes and RGBA/canvas rendering of a
 * generated dungeon. Unlike the other entries, its declarations name DOM types
 * (`ImageData`, `HTMLCanvasElement`, `OffscreenCanvas`) for `toImageData` and `drawToCanvas`.
 *
 * @module
 */
export { ASCII_CHARS, type DungeonLike, toAscii } from './render/ascii.js';
export { drawToCanvas, toImageData } from './render/canvas.js';
export { DEFAULT_PALETTE, type Palette, paletteRgb } from './render/palette.js';
export { type Raster, type RasterOptions, toRgba } from './render/raster.js';
export { Tile, toTiles } from './render/tiles.js';
