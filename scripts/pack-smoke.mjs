#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Packs dungeonmaker-js, installs the tarball into an empty project outside the repo and
// generates a dungeon through the published entry point. Proves the shipped files work.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const design = join(repo, 'native/vendor/dungeonmaker-2.05/design3A');
const expected = '99cc67de'; // golden FNV-1a of design3A, seed 42

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
import { loadCore } from 'dungeonmaker-js/core';
const core = await loadCore();
const { cells } = core.generate(readFileSync(process.argv[2], 'utf8'), 42);
let h = 0x811c9dc5;
for (const b of cells) h = Math.imul(h ^ b, 0x01000193) >>> 0;
const hex = h.toString(16).padStart(8, '0');
if (hex !== '${expected}') { console.error('hash ' + hex + ' !== ${expected}'); process.exit(1); }
console.log('pack smoke ok: ' + hex);
`,
  );
  run('node', ['smoke.mjs', design], projectDir);
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
}
