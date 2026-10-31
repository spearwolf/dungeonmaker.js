// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import type { CoreResult } from '../src/core.js';

const VENDOR = new URL('../../../native/vendor/dungeonmaker-2.05/', import.meta.url);

export const DESIGNS = [
  'design',
  'design2',
  'design3A',
  'design3WithTunnelers',
  'design4A',
  'design5',
  'design6',
  'design7',
  'designEmpty',
  'designEmpty2',
  'designOld1',
] as const;

export const SEEDS = [1, 2, 3, 42, 4294967295] as const;

/** Golden FNV-1a hashes written by the native reference build (native/test/run.sh --write). */
export const golden: Record<string, string> = JSON.parse(
  readFileSync(new URL('./golden/native-fnv.json', import.meta.url), 'utf8'),
);

export function readDesign(name: string): string {
  return readFileSync(new URL(name, VENDOR), 'utf8');
}

/** Replaces the two numbers of the first D line (library dimX, dimY), like native/test/design_util.h. */
export function withDimensions(text: string, dimX: number, dimY: number): string {
  return text.replace(/^([Dd])\s+\S+\s+\S+/m, `$1   ${dimX}   ${dimY}`);
}

/** Removes every line whose first token is `tag`, like native/test/design_util.h. */
export function dropRecord(text: string, tag: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim().split(/\s+/)[0] !== tag)
    .join('\n');
}

export function fnv1a32(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function cellAt(r: CoreResult, x: number, y: number): number {
  const v = r.cells[y * r.width + x];
  if (v === undefined) throw new RangeError(`(${x}, ${y}) is outside ${r.width}x${r.height}`);
  return v;
}
