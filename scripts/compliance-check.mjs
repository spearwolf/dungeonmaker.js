#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Checks the packed tarball for the licence and source obligations before every publish.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_URL = 'git+https://github.com/spearwolf/dungeonmaker.js.git';

/**
 * @param {{ files: Map<string, string>, version: string }} input
 *   files: path inside the tarball (without the `package/` prefix) -> text content
 * @returns {string[]} one message per violation, each naming the file; empty = compliant
 */
export function checkCompliance({ files, version }) {
  const problems = [];
  const need = (name, test, message) => {
    const text = files.get(name);
    if (text === undefined) problems.push(`${name}: missing from the tarball`);
    else if (!test(text)) problems.push(`${name}: ${message}`);
  };

  need(
    'LICENSE',
    (t) => t.includes('GNU GENERAL PUBLIC LICENSE') && t.includes('Version 3, 29 June 2007'),
    'is not the GNU GPL version 3 text',
  );
  need(
    'NOTICE',
    (t) => t.includes('Peter Henningsen') && t.includes('GPL-3.0-or-later'),
    'lacks the upstream copyright (Peter Henningsen) or GPL-3.0-or-later',
  );
  need(
    'wasm/dungeonmaker.js',
    (t) =>
      t
        .split('\n', 3)
        .some((l) =>
          l.includes('/*! dungeonmaker-js | GPL-3.0-or-later | includes DungeonMaker 2.05'),
        ),
    'lacks the licence banner in its first three lines',
  );
  need(
    'package.json',
    (t) => {
      let pkg;
      try {
        pkg = JSON.parse(t);
      } catch {
        return false;
      }
      return (
        pkg.license === 'GPL-3.0-or-later' &&
        pkg.repository?.url === REPO_URL &&
        pkg.repository?.directory === 'packages/dungeonmaker-js' &&
        pkg.version === version
      );
    },
    `needs license GPL-3.0-or-later, repository.url ${REPO_URL}, repository.directory packages/dungeonmaker-js and version ${version}`,
  );
  need(
    'README.md',
    (t) =>
      t.includes('Corresponding source') &&
      t.includes('`v<version>`') &&
      t.includes('https://github.com/spearwolf/dungeonmaker.js'),
    'needs "Corresponding source", the literal `v<version>` and the repository URL',
  );
  need('CHANGELOG.md', (t) => t.includes(`## [${version}]`), `has no entry "## [${version}]"`);
  need('dungeon.schema.json', (t) => t.includes('CC0-1.0'), 'does not declare CC0-1.0');

  for (const path of files.keys()) {
    if (/^(src|test)\//.test(path) || /\.(cpp|h|map)$/.test(path)) {
      problems.push(`${path}: must not be part of the tarball (sources, tests, source maps)`);
    }
  }
  return problems;
}

/** @param {string} dir @returns {string[]} file paths relative to dir */
function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full)];
  });
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'dm-compliance-'));
  try {
    execFileSync('pnpm', ['--filter', 'dungeonmaker-js', 'pack', '--pack-destination', tmp], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
    if (!tgz) throw new Error('pnpm pack produced no tarball (run pnpm build first)');
    const out = join(tmp, 'x');
    execFileSync('mkdir', [out]);
    execFileSync('tar', ['-xzf', join(tmp, tgz), '-C', out]);
    const root = join(out, 'package');
    const files = new Map();
    const binary = /\.(png|wasm)$/;
    for (const path of walk(root)) {
      if (!binary.test(path)) files.set(path, readFileSync(join(root, path), 'utf8'));
      else files.set(path, '');
    }
    const { version } = JSON.parse(files.get('package.json'));
    const problems = checkCompliance({ files, version });
    if (problems.length > 0) {
      console.error(
        `Compliance check failed for dungeonmaker-js@${version}:\n  ${problems.join('\n  ')}`,
      );
      process.exit(1);
    }
    console.log(`compliance ok: dungeonmaker-js@${version} (${files.size} files)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
