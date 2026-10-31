#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MARKER = 'SPDX-License-Identifier: GPL-3.0-or-later';

/** Own source files that must carry the SPDX header. */
const COVERED = [
  /^packages\/[^/]+\/src\//,
  /^packages\/[^/]+\/test\/.*\.ts$/,
  /^scripts\/.*\.mjs$/,
  /^native\/src\//,
  /^native\/test\//,
  /^native\/build\.sh$/,
];

/**
 * @param {{ path: string, content: string }[]} files
 * @returns {string[]} paths whose first three lines lack the SPDX header
 */
export function findMissingSpdx(files) {
  return files
    .filter(({ content }) => !content.split('\n', 3).some((line) => line.includes(MARKER)))
    .map(({ path }) => path);
}

function main() {
  const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter((p) => p && !p.endsWith('.json') && COVERED.some((re) => re.test(p)));
  const missing = findMissingSpdx(
    tracked.map((path) => ({ path, content: readFileSync(path, 'utf8') })),
  );
  if (missing.length > 0) {
    console.error(`Missing "${MARKER}" in:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
