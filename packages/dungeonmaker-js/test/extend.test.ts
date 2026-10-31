// SPDX-License-Identifier: GPL-3.0-or-later
import { extendDesign } from '../src/config/extend.js';
import { design5 } from '../src/presets/design5.js';

test('deep merge, arrays replace', () => {
  const d = extendDesign(design5, { map: { width: 120 }, crawlers: { corridorWidth: [3] } });
  expect([d.map.width, d.map.height]).toEqual([120, 140]);
  expect(d.crawlers.corridorWidth).toEqual([3]);
  expect(d.crawlers.stepLength).toEqual([4]);
});

test('undefined in a patch keeps the base value', () => {
  expect(extendDesign(design5, { map: { width: undefined } }).map.width).toBe(140);
});

test('result shares nothing with base or patch', () => {
  const patch = { crawlers: { corridorWidth: [3] } };
  const d = extendDesign(design5, patch);
  d.crawlers.stepLength.push(9);
  if (d.rectangles?.[0]) d.rectangles[0].from.x = 0;
  patch.crawlers.corridorWidth.push(1);
  expect(design5.crawlers.stepLength).toEqual([4]);
  expect(design5.rectangles?.[0]?.from.x).toBe(1);
  expect(d.crawlers.corridorWidth).toEqual([3]);
});
