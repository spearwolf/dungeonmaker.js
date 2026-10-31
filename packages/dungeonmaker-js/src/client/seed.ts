// SPDX-License-Identifier: GPL-3.0-or-later

export const MAX_SEED = 0xffff_ffff;

/** A random seed in `1 … MAX_SEED`; a drawn 0 is drawn again. */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] as number;
    if (value !== 0) return value;
  }
}

/** Checks a caller-provided seed (`1 … MAX_SEED`, integer) or draws one when it is missing. */
export function resolveSeed(seed: number | undefined): number {
  if (seed === undefined) return randomSeed();
  if (!Number.isInteger(seed) || seed < 1 || seed > MAX_SEED) {
    throw new RangeError(`seed must be an integer in 1 … ${MAX_SEED}, got ${String(seed)}`);
  }
  return seed;
}
