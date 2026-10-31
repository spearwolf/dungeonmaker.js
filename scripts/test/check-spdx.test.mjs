// SPDX-License-Identifier: GPL-3.0-or-later
import { findMissingSpdx, isCovered } from '../check-spdx.mjs';

const H = '// SPDX-License-Identifier: GPL-3.0-or-later';

test('accepts header in the first three lines', () => {
  expect(
    findMissingSpdx([
      { path: 'a.ts', content: `${H}\nexport {};` },
      { path: 'b.sh', content: '#!/bin/sh\n# SPDX-License-Identifier: GPL-3.0-or-later\n' },
    ]),
  ).toEqual([]);
});

test('reports files without header or with header below line 3', () => {
  expect(
    findMissingSpdx([
      { path: 'c.ts', content: 'export {};' },
      { path: 'd.ts', content: `\n\n\n${H}` },
    ]),
  ).toEqual(['c.ts', 'd.ts']);
});

test('Vue components carry the header as an HTML comment in line 1', () => {
  expect(
    findMissingSpdx([
      {
        path: 'site/components/X.vue',
        content: '<!-- SPDX-License-Identifier: GPL-3.0-or-later -->\n<template></template>',
      },
    ]),
  ).toEqual([]);
});

test('own site sources are covered, generated site output is not', () => {
  for (const path of [
    'site/components/X.vue',
    'site/src/a.ts',
    'site/scripts/e2e.mjs',
    'site/test/a.test.ts',
    'site/.vitepress/config.ts',
  ]) {
    expect(isCovered(path), path).toBe(true);
  }
  for (const path of [
    'site/api/index.md',
    'site/.vitepress/dist/x.js',
    'site/.vitepress/cache/x.js',
  ]) {
    expect(isCovered(path), path).toBe(false);
  }
});
