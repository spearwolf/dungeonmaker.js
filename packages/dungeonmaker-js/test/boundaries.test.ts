// SPDX-License-Identifier: GPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs';

/**
 * The TypeBox runtime belongs to the `dungeonmaker-js/schema` entry only: the main entry,
 * the presets and the core stay free of it. Every module outside `src/schema/` and the
 * entry `src/schema.ts` may therefore import from 'typebox', and from the schema modules
 * that load it, with `import type` only. Scans the source, not `dist/`, so the test
 * needs no build.
 */
const SRC = new URL('../src/', import.meta.url);

/** 'typebox', 'typebox/value', … and relative paths into `schema/` (or `schema.js`). */
const RUNTIME = String.raw`(?:typebox(?:\/[^'"]*)?|\.{1,2}\/(?:[^'"]*\/)?schema(?:\/[^'"]*|\.js))`;
/** `import … from '…'` and `export … from '…'`, one whole statement each. */
const FROM = new RegExp(
  String.raw`\b(?:import|export)\s+([^;]*?)\s*from\s*['"]${RUNTIME}['"]`,
  'g',
);
/** Side-effect and dynamic imports: `import '…'`, `import('…')`. */
const BARE = new RegExp(String.raw`\bimport\s*\(?\s*['"]${RUNTIME}['"]`, 'g');

function runtimeImports(source: string): string[] {
  const viaFrom = [...source.matchAll(FROM)]
    .filter(([, clause]) => !/^type\b/.test(clause ?? ''))
    .map(([statement]) => statement);
  return [...viaFrom, ...[...source.matchAll(BARE)].map(([statement]) => statement)];
}

const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.replaceAll('\\', '/'));

test('the scan sees the source tree and recognises runtime imports', () => {
  expect(files).toContain('index.ts');
  expect(runtimeImports(readFileSync(new URL('schema/model.ts', SRC), 'utf8'))).not.toEqual([]);
  expect(runtimeImports(readFileSync(new URL('schema.ts', SRC), 'utf8'))).not.toEqual([]);
  expect(runtimeImports("import type { Static } from 'typebox';")).toEqual([]);
  expect(runtimeImports("import type {\n  A,\n  B,\n} from '../schema/model.js';")).toEqual([]);
  expect(runtimeImports("import { type Static } from 'typebox';")).not.toEqual([]);
  expect(runtimeImports("import Value from 'typebox/value';")).not.toEqual([]);
  expect(runtimeImports("export { DESIGN_SCHEMA_ID } from '../schema/model.js';")).not.toEqual([]);
  expect(runtimeImports("await import('typebox');")).not.toEqual([]);
});

/** The one module that may reach the schema, and only through a dynamic import. */
const DYNAMIC_ONLY = 'client/validate.ts';

test('client/validate.ts loads the schema only dynamically', () => {
  const source = readFileSync(new URL(DYNAMIC_ONLY, SRC), 'utf8');
  expect(source).toMatch(/import\(\s*['"]\.\.\/schema\/validate\.js['"]\s*\)/);
  expect([...source.matchAll(FROM)].filter(([, c]) => !/^type\b/.test(c ?? ''))).toEqual([]);
});

// `node/` may load the schema runtime: the CLI validates designs with it, and the `./node`
// entry is reachable under the `node` condition only, never by browser bundlers.
test.each(
  files.filter(
    (f) =>
      !f.startsWith('schema/') && !f.startsWith('node/') && f !== 'schema.ts' && f !== DYNAMIC_ONLY,
  ),
)('src/%s loads neither typebox nor a schema module at runtime', (file) => {
  expect(runtimeImports(readFileSync(new URL(file, SRC), 'utf8'))).toEqual([]);
});
