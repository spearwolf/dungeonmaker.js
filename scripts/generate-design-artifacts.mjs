#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Writes the committed design artifacts from the built TypeBox model. Run via
// `pnpm --filter dungeonmaker-js generate` (builds first); the drift test in
// packages/dungeonmaker-js/test/validate.test.ts fails if the committed file is stale.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = fileURLToPath(new URL('../packages/dungeonmaker-js/', import.meta.url));
const { DesignConfigSchema } = await import(new URL('dist/schema.js', `file://${pkg}`));

const written = [];
const write = (relative, text) => {
  writeFileSync(`${pkg}${relative}`, text);
  written.push(`${pkg}${relative}`);
};

write('design.schema.json', `${JSON.stringify(DesignConfigSchema, null, 2)}\n`);

// Biome lints JSON and TS in this repo; normalise the output so a rerun is a no-op.
execFileSync('pnpm', ['exec', 'biome', 'format', '--write', ...written], {
  cwd: pkg,
  stdio: 'inherit',
});
