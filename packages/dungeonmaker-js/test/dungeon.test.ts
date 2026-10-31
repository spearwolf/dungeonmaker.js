// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from 'vitest';
import { toDungeon } from '../src/dungeon.js';
import { TimeoutError, WorkerError } from '../src/errors.js';

const cells = Uint8Array.of(0, 1, 2, 3, 4, 5);
const d = toDungeon({ width: 3, height: 2, seed: 7, cells, diagnostics: [] });

test('get reads row-major', () => {
  expect(d.get(2, 1)).toBe(5);
  expect(d.get(0, 1)).toBe(3);
});

test.each([
  [-1, 0],
  [3, 0],
  [0, 2],
  [0.5, 0],
  [Number.NaN, 0],
])('get(%d, %d) is a RangeError', (x, y) => {
  expect(() => d.get(x, y)).toThrow(RangeError);
});

test('the dungeon object is frozen, cells are not copied', () => {
  expect(Object.isFrozen(d)).toBe(true);
  expect(d.cells).toBe(cells);
});

test('TimeoutError and WorkerError have their names', () => {
  const t = new TimeoutError(250);
  expect(t.name).toBe('TimeoutError');
  expect(t).toBeInstanceOf(Error);
  expect(t.timeout).toBe(250);
  expect(t.message).toBe('generation timed out after 250 ms');
  const cause = new Error('inner');
  const w = new WorkerError('worker died', { cause });
  expect(w.name).toBe('WorkerError');
  expect(w).toBeInstanceOf(Error);
  expect(w.cause).toBe(cause);
});

test('toDungeon carries the layers and stays frozen', () => {
  const rooms = { roomIds: new Uint16Array(6), rooms: [] };
  const entities = [{ kind: 'mob' as const, x: 1, y: 1, level: 0 }];
  const steps = {
    offsets: Uint32Array.of(0, 6),
    index: new Uint32Array(6),
    cell: new Uint8Array(6),
  };
  const full = toDungeon({
    width: 3,
    height: 2,
    seed: 7,
    cells,
    diagnostics: [],
    rooms,
    entities,
    steps,
  });
  expect(full.rooms).toBe(rooms);
  expect(full.entities).toBe(entities);
  expect(full.steps).toBe(steps);
  expect(Object.isFrozen(full)).toBe(true);
  expect('rooms' in d).toBe(false);
});
