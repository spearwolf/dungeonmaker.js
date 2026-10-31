// SPDX-License-Identifier: GPL-3.0-or-later
// Deterministic zlib encoder: one fixed-Huffman deflate block, greedy LZ77 with a single-slot
// hash of 3 bytes. Same bytes on every engine, unlike `CompressionStream`.

const LEN_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LEN_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

const WINDOW = 32768;
const MAX_MATCH = 258;
const HASH_BITS = 15;

/** Adler-32 of the bytes (unsigned). */
export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; ) {
    const end = Math.min(i + 5552, data.length);
    for (; i < end; i++) {
      a += data[i] ?? 0;
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

class BitWriter {
  private buf = new Uint8Array(1024);
  private len = 0;
  private acc = 0;
  private n = 0;

  /** Writes `count` bits, least significant first. */
  bits(value: number, count: number): void {
    this.acc |= value << this.n;
    this.n += count;
    while (this.n >= 8) {
      this.byte(this.acc & 0xff);
      this.acc >>>= 8;
      this.n -= 8;
    }
  }

  /** Writes a Huffman code (most significant bit first). */
  code(value: number, count: number): void {
    let rev = 0;
    for (let i = 0; i < count; i++) rev |= ((value >>> i) & 1) << (count - 1 - i);
    this.bits(rev, count);
  }

  private byte(b: number): void {
    if (this.len === this.buf.length) {
      const bigger = new Uint8Array(this.buf.length * 2);
      bigger.set(this.buf);
      this.buf = bigger;
    }
    this.buf[this.len++] = b;
  }

  finish(): Uint8Array {
    if (this.n > 0) this.byte(this.acc & 0xff);
    return this.buf.subarray(0, this.len);
  }
}

function literalLength(w: BitWriter, sym: number): void {
  if (sym < 144) w.code(0x30 + sym, 8);
  else if (sym < 256) w.code(0x190 + sym - 144, 9);
  else if (sym < 280) w.code(sym - 256, 7);
  else w.code(0xc0 + sym - 280, 8);
}

function indexOfBase(table: readonly number[], value: number): number {
  let i = table.length - 1;
  while ((table[i] ?? 0) > value) i--;
  return i;
}

/** zlib stream (RFC 1950) around a single fixed-Huffman deflate block (RFC 1951). */
export function zlibDeflate(data: Uint8Array): Uint8Array {
  const w = new BitWriter();
  w.bits(1, 1); // BFINAL
  w.bits(1, 2); // BTYPE = fixed Huffman
  const head = new Int32Array(1 << HASH_BITS).fill(-1);
  const hash = (i: number) =>
    ((((data[i] ?? 0) << 10) ^ ((data[i + 1] ?? 0) << 5) ^ (data[i + 2] ?? 0)) * 0x9e3779b1) >>>
    (32 - HASH_BITS);
  const insert = (i: number) => {
    if (i + 2 < data.length) head[hash(i)] = i;
  };
  let i = 0;
  while (i < data.length) {
    let matchLen = 0;
    let matchDist = 0;
    if (i + 2 < data.length) {
      const cand = head[hash(i)] ?? -1;
      if (cand >= 0 && i - cand <= WINDOW) {
        const max = Math.min(MAX_MATCH, data.length - i);
        let l = 0;
        while (l < max && data[cand + l] === data[i + l]) l++;
        if (l >= 3) {
          matchLen = l;
          matchDist = i - cand;
        }
      }
    }
    if (matchLen === 0) {
      literalLength(w, data[i] ?? 0);
      insert(i);
      i++;
      continue;
    }
    const lc = indexOfBase(LEN_BASE, matchLen);
    literalLength(w, 257 + lc);
    w.bits(matchLen - (LEN_BASE[lc] ?? 0), LEN_EXTRA[lc] ?? 0);
    const dc = indexOfBase(DIST_BASE, matchDist);
    w.code(dc, 5);
    w.bits(matchDist - (DIST_BASE[dc] ?? 0), DIST_EXTRA[dc] ?? 0);
    for (let k = 0; k < matchLen; k++) insert(i + k);
    i += matchLen;
  }
  literalLength(w, 256); // end of block
  const body = w.finish();
  const out = new Uint8Array(2 + body.length + 4);
  out[0] = 0x78;
  out[1] = 0x01; // (0x78 * 256 + 0x01) % 31 === 0
  out.set(body, 2);
  new DataView(out.buffer).setUint32(2 + body.length, adler32(data));
  return out;
}
