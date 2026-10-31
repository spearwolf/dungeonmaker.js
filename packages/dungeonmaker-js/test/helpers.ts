// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { parseDesignText } from '../src/config/parse.js';
import type { CoreResult } from '../src/core.js';
import type { DesignConfig } from '../src/schema/model.js';
import { fnv1a32 } from './fnv.js';

const VENDOR = new URL('../../../native/vendor/dungeonmaker-2.05/', import.meta.url);

export { fnv1a32 };

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

/** The vendor design `name` as a config. */
export function vendorConfig(name: string): DesignConfig {
  return parseDesignText(readDesign(name));
}

/**
 * Rewrites a design text the way another editor might save it: UTF-8 BOM, CRLF line
 * ends, every record wrapped after its tag with the values tab-separated on the next
 * line. Comment lines and blank lines stay as they are.
 */
export function reflow(text: string): string {
  const lines = text.split(/\r?\n/).flatMap((line) => {
    const [tag, ...values] = line.trim().split(/\s+/);
    return !tag || tag.startsWith('X') || values.length === 0 ? [line] : [tag, values.join('\t')];
  });
  return `\uFEFF${lines.join('\r\n')}`;
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

/** The error `fn` throws; fails the test if it does not throw. */
export function caught(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected the call to throw');
}

export function cellAt(r: CoreResult, x: number, y: number): number {
  const v = r.cells[y * r.width + x];
  if (v === undefined) throw new RangeError(`(${x}, ${y}) is outside ${r.width}x${r.height}`);
  return v;
}
