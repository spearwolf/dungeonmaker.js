// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('./golden/export-sha256.json', import.meta.url);

/** SHA-256 hex of the bytes. */
export async function sha256Hex(bytes: Uint8Array | string): Promise<string> {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compares `actual` with the golden entry `key`. With `DM_WRITE_GOLDEN=1` the entry is
 * (re)written, merged into the existing file so that other keys stay. Only change a golden
 * hash after understanding why the output changed.
 */
export function checkGolden(key: string, actual: string): string | undefined {
  let golden: Record<string, string> = {};
  try {
    golden = JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    // first run
  }
  if (process.env.DM_WRITE_GOLDEN === '1') {
    golden[key] = actual;
    const sorted = Object.fromEntries(
      Object.entries(golden).sort(([a], [b]) => a.localeCompare(b)),
    );
    writeFileSync(FILE, `${JSON.stringify(sorted, null, 2)}\n`);
    return actual;
  }
  return golden[key];
}
