// SPDX-License-Identifier: GPL-3.0-or-later
import { pointerRanges, rangeFor } from '../src/pointer';

const slice = (text: string, range: { from: number; to: number } | undefined) =>
  range ? text.slice(range.from, range.to) : undefined;

test('pointers address value ranges, with ~0/~1 escaping', () => {
  const text = '{"map": {"width": 80}, "a~b/c": [1, 2]}';
  const r = pointerRanges(text);
  expect(slice(text, r.get('/map/width'))).toBe('80');
  expect(slice(text, r.get('/a~0b~1c/1'))).toBe('2');
  expect(r.get('')).toEqual({ from: 0, to: text.length });
});

test('every kind of value gets its exact range, whitespace excluded', () => {
  const text =
    ' {\n  "s": "a\\"b}",\n  "n": -1.5e3,\n  "t": true,\n  "f": false,\n  "z": null,\n  "o": {},\n  "l": [ ]\n} ';
  const r = pointerRanges(text);
  expect(slice(text, r.get(''))).toBe(text.trim());
  expect(slice(text, r.get('/s'))).toBe('"a\\"b}"');
  expect(slice(text, r.get('/n'))).toBe('-1.5e3');
  expect(slice(text, r.get('/t'))).toBe('true');
  expect(slice(text, r.get('/f'))).toBe('false');
  expect(slice(text, r.get('/z'))).toBe('null');
  expect(slice(text, r.get('/o'))).toBe('{}');
  expect(slice(text, r.get('/l'))).toBe('[ ]');
});

test('keys with escapes are decoded before they become tokens', () => {
  const text = '{"\\u0061\\/b": 1}';
  expect(slice(text, pointerRanges(text).get('/a~1b'))).toBe('1');
});

test('broken JSON throws a SyntaxError', () => {
  expect(() => pointerRanges('{"map": ')).toThrow(SyntaxError);
  expect(() => pointerRanges('')).toThrow(SyntaxError);
});

test('rangeFor falls back to the nearest existing ancestor', () => {
  const text = '{"map": {"width": 80}}';
  const r = pointerRanges(text);
  expect(rangeFor(r, '/map/height')).toEqual(r.get('/map'));
  expect(rangeFor(r, '/map/width')).toEqual(r.get('/map/width'));
  expect(rangeFor(r, '/rooms/0/x')).toEqual(r.get(''));
  expect(rangeFor(r, '')).toEqual(r.get(''));
});
