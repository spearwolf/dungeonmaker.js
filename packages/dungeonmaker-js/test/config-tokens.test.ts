// SPDX-License-Identifier: GPL-3.0-or-later

import { Cell } from '../src/cell.js';
import {
  pointFromLibrary,
  pointToLibrary,
  sizeFromLibrary,
  sizeToLibrary,
} from '../src/config/axes.js';
import { CELL_NAMES, CELL_TOKENS, DIRECTION_TOKENS, DIRECTIONS } from '../src/config/tokens.js';

test('cell names follow the Cell numbering', () => {
  expect(CELL_NAMES.map((n) => n.charAt(0).toUpperCase() + n.slice(1))).toEqual(Object.keys(Cell));
});

test('cell tokens are the upstream SquareData names', () => {
  expect(CELL_NAMES.map((n) => CELL_TOKENS[n])).toEqual([
    'OPEN',
    'CLOSED',
    'G_OPEN',
    'G_CLOSED',
    'NJ_OPEN',
    'NJ_CLOSED',
    'NJ_G_OPEN',
    'NJ_G_CLOSED',
    'IR_OPEN',
    'IT_OPEN',
    'IA_OPEN',
    'H_DOOR',
    'V_DOOR',
    'MOB1',
    'MOB2',
    'MOB3',
    'TREAS1',
    'TREAS2',
    'TREAS3',
    'COLUMN',
  ]);
});

test('direction tokens', () => {
  expect(DIRECTIONS.map((d) => DIRECTION_TOKENS[d])).toEqual([
    'NO',
    'NE',
    'EA',
    'SE',
    'SO',
    'SW',
    'WE',
    'NW',
  ]);
});

test('axes swap row/column exactly once', () => {
  expect(pointFromLibrary(86, 44)).toEqual({ x: 44, y: 86 });
  expect(pointToLibrary({ x: 44, y: 86 })).toEqual([86, 44]);
  expect(sizeFromLibrary(80, 200)).toEqual({ width: 200, height: 80 });
  expect(sizeToLibrary({ width: 200, height: 80 })).toEqual([80, 200]);
});
