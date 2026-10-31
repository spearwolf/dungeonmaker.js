// SPDX-License-Identifier: GPL-3.0-or-later
import { Cell } from '../src/cell.js';
import { CELL_NAMES } from '../src/config/tokens.js';
import {
  ASCII_CHARS,
  DEFAULT_PALETTE,
  paletteRgb,
  Tile,
  toAscii,
  toRgba,
  toTiles,
} from '../src/render.js';

const d = {
  width: 3,
  height: 2,
  cells: Uint8Array.of(
    Cell.Open,
    Cell.Closed,
    Cell.Column,
    Cell.HorizontalDoor,
    Cell.Mob1,
    Cell.Treasure3,
  ),
};

test('toAscii joins rows with newlines and no trailing newline', () => {
  expect(toAscii(d)).toBe(' #@\n=16');
  expect(ASCII_CHARS).toEqual([
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
  ]);
});

test('toTiles collapses all 20 cell values per the table', () => {
  const all = Uint8Array.from({ length: 20 }, (_, i) => i);
  const t = toTiles({ width: 20, height: 1, cells: all });
  const by = (cells: number[]) => cells.map((c) => t[c]);
  expect(by([0, 2, 4, 6, 8, 9, 10])).toEqual(Array(7).fill(Tile.Floor));
  expect(by([1, 3, 5, 7])).toEqual(Array(4).fill(Tile.Wall));
  expect(by([11, 12])).toEqual([Tile.Door, Tile.Door]);
  expect(by([13, 14, 15])).toEqual(Array(3).fill(Tile.Mob));
  expect(by([16, 17, 18])).toEqual(Array(3).fill(Tile.Treasure));
  expect(by([19])).toEqual([Tile.Column]);
  expect([...toTiles(d)]).toEqual([
    Tile.Floor,
    Tile.Wall,
    Tile.Column,
    Tile.Door,
    Tile.Mob,
    Tile.Treasure,
  ]);
});

test('the default palette has the documented colors for all 20 cell names', () => {
  expect(Object.keys(DEFAULT_PALETTE)).toEqual([...CELL_NAMES]);
  expect(DEFAULT_PALETTE).toEqual({
    open: '#f0f0f0',
    closed: '#303030',
    guaranteedOpen: '#f0f0f0',
    guaranteedClosed: '#303030',
    nonJoinOpen: '#f0f0f0',
    nonJoinClosed: '#303030',
    nonJoinGuaranteedOpen: '#f0f0f0',
    nonJoinGuaranteedClosed: '#303030',
    insideRoomOpen: '#f0f0f0',
    insideTunnelOpen: '#e8e8e8',
    insideAnteroomOpen: '#e0e0e0',
    horizontalDoor: '#a04000',
    verticalDoor: '#a04000',
    mob1: '#ff0040',
    mob2: '#f00030',
    mob3: '#e00020',
    treasure1: '#ffff00',
    treasure2: '#f0f000',
    treasure3: '#e0e000',
    column: '#00ff00',
  });
});

test('paletteRgb has 20 * 3 bytes and accepts #rgb', () => {
  const p = paletteRgb({ open: '#abc' });
  expect(p).toHaveLength(60);
  expect([...p.slice(0, 3)]).toEqual([0xaa, 0xbb, 0xcc]);
  expect([...p.slice(3, 6)]).toEqual([0x30, 0x30, 0x30]);
});

test('toRgba scales and applies the palette', () => {
  const r = toRgba(d, { scale: 2, palette: { open: '#102030' } });
  expect([r.width, r.height, r.data.length]).toEqual([6, 4, 6 * 4 * 4]);
  expect([...r.data.slice(0, 4)]).toEqual([0x10, 0x20, 0x30, 255]);
  // pixel (2,0) belongs to cell 1 (closed)
  expect([...r.data.slice(8, 12)]).toEqual([0x30, 0x30, 0x30, 255]);
  // pixel (0,2) belongs to cell 3 (door), second pixel row of the second cell row
  expect([...r.data.slice(2 * 6 * 4, 2 * 6 * 4 + 4)]).toEqual([0xa0, 0x40, 0x00, 255]);
});

test('toRgba rejects bad scale, colors and oversized output', () => {
  expect(() => toRgba(d, { scale: 0 })).toThrow(RangeError);
  expect(() => toRgba(d, { scale: 65 })).toThrow(RangeError);
  expect(() => toRgba(d, { scale: 1.5 })).toThrow(RangeError);
  expect(() => toRgba(d, { palette: { open: 'red' } })).toThrow(TypeError);
  expect(() => toRgba(d, { palette: { open: '#12345' } })).toThrow(TypeError);
  const big = { width: 4096, height: 4096, cells: new Uint8Array(0) };
  expect(() => toRgba(big, { scale: 3 })).toThrow(RangeError);
});
