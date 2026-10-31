// SPDX-License-Identifier: GPL-3.0-or-later
import { inflateSync } from 'node:zlib';
import { Cell } from '../src/cell.js';
import { toDesignText } from '../src/config/serialize.js';
import { loadCore } from '../src/core.js';
import { crc32 } from '../src/export/crc32.js';
import { TILESET_IMAGE, toPng, toTilesetPng } from '../src/export/png.js';
import { design3A } from '../src/presets.js';
import { checkGolden, sha256Hex } from './golden-export.js';

const d = {
  width: 3,
  height: 2,
  seed: 42,
  cells: Uint8Array.of(
    Cell.Open,
    Cell.Closed,
    Cell.Column,
    Cell.HorizontalDoor,
    Cell.Mob1,
    Cell.Treasure3,
  ),
};
const OPTS = { generator: 'dungeonmaker-js@test' };

interface Chunk {
  type: string;
  data: Uint8Array;
  crcOk: boolean;
}
function chunks(png: Uint8Array): Chunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: Chunk[] = [];
  let o = 8;
  while (o < png.length) {
    const len = view.getUint32(o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    const data = png.subarray(o + 8, o + 8 + len);
    out.push({
      type,
      data,
      crcOk: view.getUint32(o + 8 + len) === crc32(png.subarray(o + 4, o + 8 + len)),
    });
    o += 12 + len;
  }
  return out;
}
const latin1 = (b: Uint8Array) => String.fromCharCode(...b);

test('crc32 matches the PNG IEND checksum', () => {
  expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082);
});

test('signature, chunk order, IHDR, PLTE and checksums', async () => {
  const png = await toPng(d, OPTS);
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const cs = chunks(png);
  expect(cs.map((c) => c.type)).toEqual(['IHDR', 'PLTE', 'tEXt', 'tEXt', 'IDAT', 'IEND']);
  expect(cs.every((c) => c.crcOk)).toBe(true);
  const ihdr = new DataView(cs[0]?.data.buffer as ArrayBuffer, cs[0]?.data.byteOffset);
  expect([ihdr.getUint32(0), ihdr.getUint32(4), ihdr.getUint8(8), ihdr.getUint8(9)]).toEqual([
    3, 2, 8, 3,
  ]);
  expect(cs[1]?.data.length).toBe(60);
  expect(latin1(cs[2]?.data as Uint8Array)).toBe('Software\0dungeonmaker-js@test');
  expect(latin1(cs[3]?.data as Uint8Array)).toBe('Comment\0seed=42');
});

test('IDAT holds filter byte 0 and the cell indices per row', async () => {
  const cs = chunks(await toPng(d, OPTS));
  const raw = inflateSync(cs[4]?.data as Uint8Array);
  expect([...raw]).toEqual([0, ...d.cells.subarray(0, 3), 0, ...d.cells.subarray(3, 6)]);
});

test('scale doubles width and height', async () => {
  const cs = chunks(await toPng(d, { ...OPTS, scale: 2 }));
  const ihdr = new DataView(cs[0]?.data.buffer as ArrayBuffer, cs[0]?.data.byteOffset);
  expect([ihdr.getUint32(0), ihdr.getUint32(4)]).toEqual([6, 4]);
  const raw = inflateSync(cs[4]?.data as Uint8Array);
  expect(raw.length).toBe(4 * 7);
  expect([...raw.subarray(0, 7)]).toEqual([0, 0, 0, 1, 1, 19, 19]);
});

test('bad scale and oversized images are RangeErrors', async () => {
  await expect(toPng(d, { scale: 0 })).rejects.toThrow(RangeError);
  await expect(toPng(d, { scale: 1.5 })).rejects.toThrow(RangeError);
  await expect(toPng({ ...d, width: 4096, height: 4096 }, { scale: 8 })).rejects.toThrow(
    RangeError,
  );
});

test('tileset strip: 20 tiles in one row', async () => {
  const cs = chunks(await toTilesetPng());
  expect(cs.map((c) => c.type)).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND']);
  const ihdr = new DataView(cs[0]?.data.buffer as ArrayBuffer, cs[0]?.data.byteOffset);
  expect([ihdr.getUint32(0), ihdr.getUint32(4)]).toEqual([320, 16]);
  const raw = inflateSync(cs[2]?.data as Uint8Array);
  expect(raw[1 + 16 * 19]).toBe(19);
  expect(raw[1 + 15]).toBe(0);
  expect(TILESET_IMAGE).toBe('dungeonmaker-tiles.png');
});

test('golden hashes for design3A at seed 42', async () => {
  const core = await loadCore();
  const dungeon = core.generate(toDesignText(design3A), 42);
  expect(dungeon.width).toBe(160);
  const png = await sha256Hex(await toPng(dungeon, OPTS));
  const tileset = await sha256Hex(await toTilesetPng());
  expect(png).toBe(checkGolden('png', png));
  expect(tileset).toBe(checkGolden('tileset', tileset));
});
