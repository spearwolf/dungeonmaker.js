// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test, vi } from 'vitest';
import { randomSeed, resolveSeed } from '../../src/client/seed.js';

test.each([0, -1, 1.5, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY])(
  'resolveSeed(%d) is a RangeError',
  (s) => {
    expect(() => resolveSeed(s)).toThrow(RangeError);
  },
);

test.each([1, 42, 0xffff_ffff])('resolveSeed(%d) keeps it', (s) => {
  expect(resolveSeed(s)).toBe(s);
});

test('resolveSeed(undefined) draws a valid seed', () => {
  const s = resolveSeed(undefined);
  expect(s).toBeGreaterThanOrEqual(1);
  expect(s).toBeLessThanOrEqual(0xffff_ffff);
});

test('randomSeed draws again on 0', () => {
  const spy = vi
    .spyOn(crypto, 'getRandomValues')
    .mockImplementationOnce((a) => {
      (a as Uint32Array)[0] = 0;
      return a;
    })
    .mockImplementationOnce((a) => {
      (a as Uint32Array)[0] = 7;
      return a;
    });
  expect(randomSeed()).toBe(7);
  spy.mockRestore();
});
