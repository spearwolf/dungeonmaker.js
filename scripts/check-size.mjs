#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Size budget for the shipped WebAssembly artifacts (spec §8.3), measured as gzip -9.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const pkg = new URL('../packages/dungeonmaker-js/', import.meta.url);

/** @returns {{ wasmGzipBytes: number, glueGzipBytes: number }} */
export function measure() {
  const gz = (name) => gzipSync(readFileSync(new URL(name, pkg)), { level: 9 }).length;
  return { wasmGzipBytes: gz('wasm/dungeonmaker.wasm'), glueGzipBytes: gz('wasm/dungeonmaker.js') };
}

function main() {
  const budget = JSON.parse(readFileSync(new URL('size-budget.json', pkg), 'utf8'));
  const actual = measure();
  let ok = true;
  for (const [key, limit] of Object.entries(budget)) {
    const value = actual[key];
    const status = value <= limit ? 'ok' : 'OVER BUDGET';
    if (value > limit) ok = false;
    console.log(`${key}: ${value} / ${limit} bytes ${status}`);
  }
  if (!ok) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
