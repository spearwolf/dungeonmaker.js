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
  const rectangle = d.rectangles?.[0];
  expect(rectangle).toBeDefined();
  if (rectangle) rectangle.from.x = 0;
  patch.crawlers.corridorWidth.push(1);
  expect(design5.crawlers.stepLength).toEqual([4]);
  expect(design5.rectangles?.[0]?.from.x).toBe(1);
  expect(d.crawlers.corridorWidth).toEqual([3]);
});

test('the patch object is not mutated', () => {
  const patch = { map: { width: 120, height: undefined }, crawlers: { corridorWidth: [3] } };
  const copy = structuredClone(patch);
  extendDesign(design5, patch);
  expect(patch).toEqual(copy);
});

test('a plain object under a key absent from the base is merged fresh', () => {
  const dungeon = { groupSize: 1, groupSizeVariance: undefined, byLevel: [1] };
  const { population: _dropped, ...withoutPopulation } = design5;
  expect(withoutPopulation).not.toHaveProperty('population');
  const d = extendDesign(withoutPopulation, { population: { treasure: { dungeon } } } as never);
  const result = (
    d as unknown as { population: { treasure: { dungeon: Record<string, unknown> } } }
  ).population.treasure.dungeon;
  expect(Object.hasOwn(result, 'groupSizeVariance')).toBe(false);
  expect(result).not.toBe(dungeon);
  expect(result.byLevel).not.toBe(dungeon.byLevel);
});

test('__proto__ keys in a patch do not pollute', () => {
  const patch = JSON.parse('{"__proto__":{"polluted":1},"map":{"__proto__":{"polluted":2}}}');
  try {
    const d = extendDesign(design5, patch);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(d)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(d.map)).toBe(Object.prototype);
  } finally {
    Reflect.deleteProperty(Object.prototype, 'polluted');
  }
});

test('a value structuredClone cannot copy throws a DataCloneError, not a DesignValidationError', () => {
  const patch = { map: { width: (() => 120) as unknown as number } };
  expect(() => extendDesign(design5, patch)).toThrow(
    expect.objectContaining({ name: 'DataCloneError' }),
  );
});
