#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Packs dungeonmaker-js, installs the tarball into an empty project outside the repo and
// generates a dungeon through the published entry point. Proves the shipped files work.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const design = join(repo, 'native/vendor/dungeonmaker-2.05/design3A');
const expected = '99cc67de'; // golden FNV-1a of design3A, seed 42

// The README's JSON example runs verbatim against the tarball, so it cannot rot.
const README_SECTION = '## JSON designs and presets';
const readme = readFileSync(join(repo, 'packages/dungeonmaker-js/README.md'), 'utf8');
const readmeExample = readme
  .slice(readme.indexOf(README_SECTION))
  .match(/```js\n([\s\S]*?)```/)?.[1];
if (!readme.includes(README_SECTION) || !readmeExample) {
  throw new Error(`README.md has no js code block under "${README_SECTION}"`);
}

const packDir = mkdtempSync(join(tmpdir(), 'dm-pack-'));
const projectDir = mkdtempSync(join(tmpdir(), 'dm-smoke-'));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

try {
  run('pnpm', ['--filter', 'dungeonmaker-js', 'pack', '--pack-destination', packDir], repo);
  const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
  if (!tarball) throw new Error('pnpm pack produced no tarball');

  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify({ name: 'dm-smoke', private: true, type: 'module' }),
  );
  run('pnpm', ['add', join(packDir, tarball)], projectDir);
  writeFileSync(
    join(projectDir, 'smoke.mjs'),
    `import { readFileSync } from 'node:fs';
import { toDesignText } from 'dungeonmaker-js';
import { loadCore } from 'dungeonmaker-js/core';
import { design3A } from 'dungeonmaker-js/presets';
import { validateDesign } from 'dungeonmaker-js/schema';
const core = await loadCore();
const fnv = (cells) => {
  let h = 0x811c9dc5;
  for (const b of cells) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};
const fail = (msg) => { console.error(msg); process.exit(1); };
const hex = fnv(core.generate(readFileSync(process.argv[2], 'utf8'), 42).cells);
if (hex !== '${expected}') fail('hash ' + hex + ' !== ${expected}');
const issues = validateDesign(design3A);
if (issues.length !== 0) fail('design3A preset invalid: ' + JSON.stringify(issues));
const viaJson = fnv(core.generate(toDesignText(design3A), 42).cells);
if (viaJson !== hex) fail('JSON preset hash ' + viaJson + ' !== ' + hex);
const schemaUrl = import.meta.resolve('dungeonmaker-js/design.schema.json');
const schema = JSON.parse(readFileSync(new URL(schemaUrl), 'utf8'));
if (schema.$id !== 'https://unpkg.com/dungeonmaker-js/design.schema.json') fail('bad schema $id: ' + schema.$id);
console.log('pack smoke ok: ' + hex);
`,
  );
  run('node', ['smoke.mjs', design], projectDir);
  writeFileSync(
    join(projectDir, 'readme-example.mjs'),
    `${readmeExample}
if (!(width === design.map.width && height === design.map.height && cells.length === width * height)) {
  console.error('README example produced ' + width + 'x' + height + ', ' + cells.length + ' cells');
  process.exit(1);
}
console.log('README example ok: ' + width + 'x' + height);
`,
  );
  run('node', ['readme-example.mjs'], projectDir);
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
}
