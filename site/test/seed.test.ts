// SPDX-License-Identifier: GPL-3.0-or-later
import { MAX_SEED, parseSeed, randomSeed } from '../src/seed';

afterEach(() => {
  vi.restoreAllMocks();
});

test('randomSeed draws from crypto.getRandomValues and never returns 0', () => {
  const draws = [0, 0, 7];
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    (array as Uint32Array)[0] = draws.shift() as number;
    return array;
  });
  expect(randomSeed()).toBe(7);
  expect(draws).toEqual([]);
});

test('randomSeed stays in 1 … 4294967295', () => {
  for (let i = 0; i < 100; i++) {
    const seed = randomSeed();
    expect(Number.isInteger(seed) && seed >= 1 && seed <= MAX_SEED).toBe(true);
  }
});

test('parseSeed accepts integers in range only', () => {
  expect(parseSeed('42')).toBe(42);
  expect(parseSeed(' 4294967295 ')).toBe(MAX_SEED);
  expect(parseSeed('1')).toBe(1);
  for (const bad of ['', '0', '4294967296', '-1', '1.5', '1e3', 'abc', '0x10']) {
    expect(parseSeed(bad), bad).toBeUndefined();
  }
});
