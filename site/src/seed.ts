// SPDX-License-Identifier: GPL-3.0-or-later

/** The seeds the package accepts: `1 … 2³²−1`. */
export const MAX_SEED = 4_294_967_295;

/** A random seed in `1 … 4294967295`, drawn with `crypto.getRandomValues`. */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0] === 0);
  return buffer[0] as number;
}

/** The seed typed into the field, or `undefined` unless it is an integer in `1 … 4294967295`. */
export function parseSeed(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const seed = Number(trimmed);
  return seed >= 1 && seed <= MAX_SEED ? seed : undefined;
}
