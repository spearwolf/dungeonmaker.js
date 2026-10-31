// SPDX-License-Identifier: GPL-3.0-or-later

/** Upper limit of seeds in one run (a CLI call or one `generateToFiles` call). */
export const MAX_SEEDS_PER_RUN = 10_000;

const MAX_SEED = 0xffff_ffff;
const INTEGER = /^\d+$/;

function seedValue(token: string, spec: string): number {
  if (!INTEGER.test(token)) {
    throw new RangeError(`Invalid seed "${token}" in "${spec}": expected an integer`);
  }
  const value = Number(token);
  if (value < 1 || value > MAX_SEED) {
    throw new RangeError(`Invalid seed "${token}" in "${spec}": seeds are 1 … ${MAX_SEED}`);
  }
  return value;
}

/**
 * Parses a seed specification: `"42"`, a range `"1..50"`, a list `"1,5,9"` or a mix
 * `"1..3,7"`. Duplicates are dropped, the first occurrence keeps its place.
 *
 * @throws RangeError (naming the input) for anything else, for seeds outside 1 … 2³²−1, for
 * descending ranges and for more than {@link MAX_SEEDS_PER_RUN} seeds.
 */
export function parseSeeds(spec: string): number[] {
  const seen = new Set<number>();
  for (const part of spec.split(',')) {
    const range = part.split('..');
    if (range.length > 2) throw new RangeError(`Invalid seed range "${part}" in "${spec}"`);
    const from = seedValue(range[0] ?? '', spec);
    const to = range.length === 2 ? seedValue(range[1] ?? '', spec) : from;
    if (to < from) throw new RangeError(`Descending seed range "${part}" in "${spec}"`);
    if (to - from + 1 > MAX_SEEDS_PER_RUN) {
      throw new RangeError(`Too many seeds in "${spec}": at most ${MAX_SEEDS_PER_RUN} per run`);
    }
    for (let s = from; s <= to; s++) {
      seen.add(s);
      if (seen.size > MAX_SEEDS_PER_RUN) {
        throw new RangeError(`Too many seeds in "${spec}": at most ${MAX_SEEDS_PER_RUN} per run`);
      }
    }
  }
  return [...seen];
}
