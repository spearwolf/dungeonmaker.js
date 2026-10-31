// SPDX-License-Identifier: GPL-3.0-or-later

const CHUNK = 32 * 1024;

/** Base64 of the bytes, without `Buffer` (browsers, workers, Node). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Base64 of the little-endian bytes of a typed array (the platform is little-endian in practice; others are swapped). */
export function typedToBase64(array: Uint16Array | Uint32Array | Uint8Array): string {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const width = array.BYTES_PER_ELEMENT;
  if (width === 1 || new Uint8Array(new Uint16Array([1]).buffer)[0] === 1)
    return bytesToBase64(bytes);
  const swapped = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += width) {
    for (let j = 0; j < width; j++) swapped[i + j] = bytes[i + width - 1 - j] as number;
  }
  return bytesToBase64(swapped);
}
