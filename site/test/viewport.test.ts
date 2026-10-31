// SPDX-License-Identifier: GPL-3.0-or-later
import { fitView, panBy, ZOOM_LIMITS, zoomAt } from '../src/viewport';

test('fitView scales the whole map into the view and centres it', () => {
  const s = fitView({ width: 160, height: 81 }, { width: 800, height: 400 });
  expect(s.scale).toBeCloseTo(400 / 81);
  expect(s.offsetX).toBeCloseTo((800 - 160 * s.scale) / 2);
  expect(s.offsetY).toBeCloseTo(0);
});

test('zoomAt keeps the map point under the cursor fixed', () => {
  const s0 = { scale: 2, offsetX: 10, offsetY: 20 };
  const s1 = zoomAt(s0, 1.5, 300, 200);
  expect((300 - s1.offsetX) / s1.scale).toBeCloseTo((300 - s0.offsetX) / s0.scale);
  expect((200 - s1.offsetY) / s1.scale).toBeCloseTo((200 - s0.offsetY) / s0.scale);
});

test('zoom is clamped to ZOOM_LIMITS', () => {
  expect(zoomAt({ scale: 60, offsetX: 0, offsetY: 0 }, 2, 0, 0).scale).toBe(ZOOM_LIMITS.max);
  expect(zoomAt({ scale: 0.3, offsetX: 0, offsetY: 0 }, 0.5, 0, 0).scale).toBe(ZOOM_LIMITS.min);
});

test('a clamped zoom still keeps the cursor point fixed', () => {
  const s0 = { scale: 60, offsetX: 5, offsetY: 7 };
  const s1 = zoomAt(s0, 2, 100, 50);
  expect((100 - s1.offsetX) / s1.scale).toBeCloseTo((100 - s0.offsetX) / s0.scale);
});

test('panBy shifts the offset and keeps the scale', () => {
  expect(panBy({ scale: 3, offsetX: 1, offsetY: 2 }, 10, -4)).toEqual({
    scale: 3,
    offsetX: 11,
    offsetY: -2,
  });
});

test('fitView of an empty view stays finite', () => {
  const s = fitView({ width: 10, height: 10 }, { width: 0, height: 0 });
  expect(Number.isFinite(s.scale)).toBe(true);
  expect(s.scale).toBeGreaterThanOrEqual(ZOOM_LIMITS.min);
});
