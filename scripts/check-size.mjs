#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Size budget for the shipped WebAssembly artifacts (spec §8.3) and the client closure, measured as gzip -9.
import { readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const pkg = new URL('../packages/dungeonmaker-js/', import.meta.url);

const STATIC_RELATIVE = /\b(?:import|export)\s+(?:[^;'"]*?\s+from\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;

/**
 * Files (relative to `dist/`) that the client entry `client/default.js` loads statically:
 * relative `import … from` / `export … from` / `import '…'`, not `import(…)`. Type-only
 * imports are erased by tsc, so they never show up in the emitted JavaScript.
 * @returns {string[]}
 */
export function clientClosure() {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(new URL(join('dist', file), pkg), 'utf8');
    for (const [, specifier] of source.matchAll(STATIC_RELATIVE)) {
      visit(posix.normalize(join(dirname(file), specifier)));
    }
  };
  visit('client/default.js');
  return [...seen].sort();
}

/** @returns {{ wasmGzipBytes: number, glueGzipBytes: number, clientGzipBytes: number }} */
export function measure() {
  const gz = (name) => gzipSync(readFileSync(new URL(name, pkg)), { level: 9 }).length;
  const client = clientClosure()
    .map((file) => readFileSync(new URL(join('dist', file), pkg)))
    .reduce((all, buf) => Buffer.concat([all, buf]), Buffer.alloc(0));
  return {
    wasmGzipBytes: gz('wasm/dungeonmaker.wasm'),
    glueGzipBytes: gz('wasm/dungeonmaker.js'),
    clientGzipBytes: gzipSync(client, { level: 9 }).length,
  };
}

function main() {
  const forbidden = clientClosure().filter(
    (f) => f.startsWith('schema/') || f.startsWith('config/') || f === 'worker.js',
  );
  if (forbidden.length > 0) {
    console.error(`client closure pulls in files that must stay out:\n  ${forbidden.join('\n  ')}`);
    process.exit(1);
  }
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
