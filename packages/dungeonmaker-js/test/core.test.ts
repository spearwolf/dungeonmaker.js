// SPDX-License-Identifier: GPL-3.0-or-later
import { Cell, type DungeonMakerCore, loadCore } from '../src/core.js';
import { cellAt, DESIGNS, fnv1a32, golden, readDesign, SEEDS, withDimensions } from './helpers.js';

let core: DungeonMakerCore;
beforeAll(async () => {
  core = await loadCore();
});

test.each(DESIGNS.flatMap((d) => SEEDS.map((s) => [d, s] as const)))(
  'matches the native reference build: %s seed %i',
  (d, s) => {
    expect(fnv1a32(core.generate(readDesign(d), s).cells)).toBe(golden[`${d}:${s}`]);
  },
);

test('north-up orientation (NO/SO openings)', () => {
  const r = core.generate(readDesign('design3WithTunnelers'), 7);
  expect([r.width, r.height]).toEqual([100, 140]);
  expect(cellAt(r, 50, 0)).toBe(Cell.GuaranteedOpen);
  expect(cellAt(r, 50, 139)).toBe(Cell.GuaranteedOpen);
  expect(cellAt(r, 0, 70)).toBe(Cell.GuaranteedClosed);
  expect(cellAt(r, 99, 70)).toBe(Cell.GuaranteedClosed);
});

test('north-up orientation (WE/EA openings)', () => {
  const r = core.generate(readDesign('design3A'), 7);
  expect([r.width, r.height]).toEqual([160, 81]);
  expect(cellAt(r, 0, 40)).toBe(Cell.GuaranteedOpen);
  expect(cellAt(r, 159, 40)).toBe(Cell.GuaranteedOpen);
  expect(cellAt(r, 80, 0)).toBe(Cell.GuaranteedClosed);
});

test('is deterministic across interleaved calls', () => {
  const first = core.generate(readDesign('design3A'), 42).cells;
  core.generate(readDesign('design5'), 1);
  const third = core.generate(readDesign('design3A'), 42).cells;
  expect(third).toEqual(first);
});

test('returns an exact, detached copy', () => {
  const r = core.generate(readDesign('design'), 42);
  const snapshot = fnv1a32(r.cells);
  expect(r.seed).toBe(42);
  expect(r.cells.buffer.byteLength).toBe(r.width * r.height);
  core.generate(readDesign('design2'), 3);
  expect(fnv1a32(r.cells)).toBe(snapshot);
});

test.each([0, -1, 1.5, 2 ** 32, Number.NaN])('rejects invalid seed %s before calling wasm', (s) => {
  expect(() => core.generate(readDesign('design'), s)).toThrow(RangeError);
  expect(core.aborted).toBe(false);
});

test('survives memory growth on a 1024x1024 map', () => {
  const r = core.generate(withDimensions(readDesign('design'), 1024, 1024), 42);
  expect(fnv1a32(r.cells)).toBe(golden['design[1024x1024]:42']);
});
