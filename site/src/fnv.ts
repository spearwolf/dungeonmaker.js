// SPDX-License-Identifier: GPL-3.0-or-later

/** FNV-1a (32 bit) as 8 lowercase hex digits; same function as `scripts/bundler-smoke.mjs`. */
export function fnv1a32(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
