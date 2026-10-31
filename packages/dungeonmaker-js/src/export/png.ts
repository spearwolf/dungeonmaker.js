// SPDX-License-Identifier: GPL-3.0-or-later
import { CELL_NAMES } from '../config/tokens.js';
import { type Palette, paletteRgb } from '../render/palette.js';
import { checkScale, MAX_PIXELS, type RasterOptions } from '../render/raster.js';
import { VERSION } from '../version.js';
import { crc32 } from './crc32.js';
import { zlibDeflate } from './deflate.js';
import type { ExportableDungeon } from './dungeon-json.js';

export interface PngOptions extends RasterOptions {
  /** Written to the `Software` text chunk. Default `dungeonmaker-js@<version>`. */
  generator?: string;
}

export interface TilesetOptions {
  palette?: Partial<Palette>;
  /** Default 16. */
  tileWidth?: number;
  /** Default 16. */
  tileHeight?: number;
}

/** File name of the tileset strip that the Tiled map refers to. */
export const TILESET_IMAGE = 'dungeonmaker-tiles.png';

const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const latin1 = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(latin1(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** An 8-bit indexed PNG; `rows` yields the palette indices of row `y`. */
function encodeIndexed(
  width: number,
  height: number,
  plte: Uint8Array,
  texts: readonly (readonly [string, string])[],
  fillRow: (y: number, row: Uint8Array) => void,
): Uint8Array {
  const stride = width + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) fillRow(y, raw.subarray(y * stride + 1, (y + 1) * stride));
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // color type: indexed
  const parts = [
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    ...texts.map(([key, value]) => chunk('tEXt', latin1(`${key}\0${value}`))),
    chunk('IDAT', zlibDeflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function checkSize(width: number, height: number): void {
  if (width * height > MAX_PIXELS) {
    throw new RangeError(
      `image of ${width}x${height} pixels exceeds the limit of ${MAX_PIXELS} pixels`,
    );
  }
}

/** The map as an indexed PNG (one palette entry per cell value). */
export async function toPng(
  dungeon: ExportableDungeon,
  options: PngOptions = {},
): Promise<Uint8Array> {
  const scale = checkScale(options.scale);
  const plte = paletteRgb(options.palette);
  const width = dungeon.width * scale;
  const height = dungeon.height * scale;
  checkSize(width, height);
  const { cells } = dungeon;
  return encodeIndexed(
    width,
    height,
    plte,
    [
      ['Software', options.generator ?? `dungeonmaker-js@${VERSION}`],
      ['Comment', `seed=${dungeon.seed}`],
    ],
    (y, row) => {
      const base = Math.floor(y / scale) * dungeon.width;
      for (let x = 0; x < width; x++) row[x] = cells[base + Math.floor(x / scale)] ?? 0;
    },
  );
}

function tileSize(value: number | undefined, name: string): number {
  const v = value ?? 16;
  if (!Number.isInteger(v) || v < 1 || v > 1024) {
    throw new RangeError(`${name} must be an integer from 1 to 1024, got ${v}`);
  }
  return v;
}

/** A strip of one solid tile per cell value (index = `Cell`), in one row. */
export async function toTilesetPng(options: TilesetOptions = {}): Promise<Uint8Array> {
  const tw = tileSize(options.tileWidth, 'tileWidth');
  const th = tileSize(options.tileHeight, 'tileHeight');
  return encodeIndexed(CELL_NAMES.length * tw, th, paletteRgb(options.palette), [], (_y, row) => {
    for (let x = 0; x < row.length; x++) row[x] = Math.floor(x / tw);
  });
}
