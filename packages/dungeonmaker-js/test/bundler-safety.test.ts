// SPDX-License-Identifier: GPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Browser bundlers reach everything under `src/` and the Emscripten glue. webpack 5 aborts
 * on `node:` URIs (UnhandledSchemeError) and Vite warns, so every dynamic `import('node:…')`
 * must carry both ignore hints; static `node:` imports are not allowed at all. A
 * non-literal `new URL(x, import.meta.url)` makes webpack report a critical dependency.
 * Scans the source, not `dist/`, so the test needs no build.
 */
const ROOT = new URL('../', import.meta.url);

const NODE_IMPORT = /import\(((?:\s*\/\*.*?\*\/)*)\s*['"](node:[^'"]+)['"]\s*\)/g;
const STATIC_NODE = /\bfrom\s*['"]node:|\bimport\s*['"]node:/;
const VARIABLE_URL = /new URL\(\s*(?!['"`])[^,()]+,\s*import\.meta\.url\s*\)/;

function read(file: string): string {
  return readFileSync(new URL(file, ROOT), 'utf8');
}

const files = [
  'wasm/dungeonmaker.js',
  ...readdirSync(new URL('src/', ROOT), { recursive: true, encoding: 'utf8' })
    // `src/node/` is exempt: the `./node` export has only the `node` condition, so browser
    // bundlers never resolve it and static `node:` imports are fine there.
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.startsWith('node/'))
    .map((f) => `src/${f.replaceAll('\\', '/')}`),
];

test('the scan finds the known node imports', () => {
  expect([...read('wasm/dungeonmaker.js').matchAll(NODE_IMPORT)]).toHaveLength(1);
  expect([...read('src/core/core.ts').matchAll(NODE_IMPORT)]).toHaveLength(2);
});

test.each(files)('%s: every node: import is hidden from bundlers', (file) => {
  const source = read(file);
  expect(source).not.toMatch(STATIC_NODE);
  for (const [, comments, specifier] of source.matchAll(NODE_IMPORT)) {
    expect(comments, specifier).toContain('webpackIgnore: true');
    expect(comments, specifier).toContain('@vite-ignore');
  }
});

test.each(files)('%s: new URL(…, import.meta.url) only with a literal', (file) => {
  expect(read(file)).not.toMatch(VARIABLE_URL);
});
