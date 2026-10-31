// SPDX-License-Identifier: GPL-3.0-or-later
import { MAX_SEEDS_PER_RUN, parseSeeds } from '../../src/node/seeds.js';

test('single seeds, ranges and lists', () => {
  expect(parseSeeds('42')).toEqual([42]);
  expect(parseSeeds('1..3,7')).toEqual([1, 2, 3, 7]);
  expect(parseSeeds('1,5,9')).toEqual([1, 5, 9]);
  expect(parseSeeds('4294967295')).toEqual([4294967295]);
  expect(parseSeeds('1..10000')).toHaveLength(MAX_SEEDS_PER_RUN);
});

test('duplicates are dropped, order is kept', () => {
  expect(parseSeeds('5,1..3,5,2')).toEqual([5, 1, 2, 3]);
});

test.each(['0..3', '5..1', '1..20000', 'abc', '4294967296', '', '1,,2', '1..2..3', '-1', '1.5'])(
  'rejects %j with a RangeError naming the input',
  (spec) => {
    expect(() => parseSeeds(spec)).toThrow(RangeError);
    expect(() => parseSeeds(spec)).toThrow(
      spec === '' ? /""/ : new RegExp(spec.replace(/[.\\^$*+?()[\]{}|]/g, '\\$&')),
    );
  },
);
