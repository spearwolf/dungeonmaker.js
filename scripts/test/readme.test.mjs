// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');
const SITE = 'https://spearwolf.github.io/dungeonmaker.js/';

test('the package README is short and keeps the sections the smoke tests run', () => {
  const md = read('packages/dungeonmaker-js/README.md');
  expect(md.split('\n').length).toBeLessThanOrEqual(120);
  for (const s of [
    '## Quick start (browser)',
    '## JSON designs and presets',
    SITE,
    'pnpm dlx dungeonmaker-js generate',
    'unofficial',
    'Corresponding source',
    '`v<version>`',
  ]) {
    expect(md).toContain(s);
  }
});

test('the root README points to the site and the package', () => {
  const md = read('README.md');
  expect(md.split('\n').length).toBeLessThanOrEqual(80);
  expect(md).toContain(SITE);
  expect(md).toContain('https://www.npmjs.com/package/dungeonmaker-js');
  expect(md).toContain('packages/dungeonmaker-js');
});

test('the package ships its CHANGELOG and points homepage at the site', () => {
  const pkg = JSON.parse(read('packages/dungeonmaker-js/package.json'));
  expect(pkg.files).toContain('CHANGELOG.md');
  expect(pkg.homepage).toBe(SITE);
  expect(read('package.json')).toContain('"compliance": "node scripts/compliance-check.mjs"');
});

test('both READMEs credit the upstream author and link spearwolf', () => {
  for (const file of ['README.md', 'packages/dungeonmaker-js/README.md']) {
    const md = read(file);
    expect(md, file).toContain('Peter Henningsen');
    expect(md, file).toContain('[spearwolf](https://www.spearwolf.de)');
  }
});
