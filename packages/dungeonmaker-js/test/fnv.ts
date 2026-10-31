// SPDX-License-Identifier: GPL-3.0-or-later

/** FNV-1a 32-bit hash as 8 hex digits. No node imports, so browser tests can use it too. */
export function fnv1a32(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
