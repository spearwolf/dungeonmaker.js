// SPDX-License-Identifier: GPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installCommand, RUNNERS } from '../src/runners';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

/** Every hand-written guide page (generated `_*.md` partials are left out). */
const guidePages = (): [string, string][] =>
  readdirSync(fileURLToPath(new URL('../guide', import.meta.url)))
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => [`guide/${file}`, read(`guide/${file}`)]);

const firstJsBlock = (md: string, heading: string) =>
  md.slice(md.indexOf(heading)).match(/```js\n([\s\S]*?)```/)?.[1];

test('the getting-started browser snippet is the README quick start that bundler:smoke runs', () => {
  const readme = read('../packages/dungeonmaker-js/README.md');
  const page = read('guide/getting-started.md');
  expect(firstJsBlock(page, '## Quick start (browser)')).toBeDefined();
  expect(firstJsBlock(page, '## Quick start (browser)')).toBe(
    firstJsBlock(readme, '## Quick start (browser)'),
  );
});

test('every code group offers pnpm, npm, yarn and bun, pnpm first', () => {
  const pages = guidePages();
  expect(pages.map(([file]) => file)).toEqual(
    expect.arrayContaining(['guide/getting-started.md', 'guide/cli.md']),
  );
  for (const [file, md] of pages) {
    for (const group of md.match(/::: code-group[\s\S]*?\n:::/g) ?? []) {
      const labels = [...group.matchAll(/```\w+ \[(\w+)\]/g)].map((m) => m[1]);
      expect(labels, file).toEqual(['pnpm', 'npm', 'yarn', 'bun']);
    }
  }
});

test('install commands on the page are the ones the demo uses', () => {
  const page = read('guide/getting-started.md');
  for (const runner of RUNNERS) expect(page).toContain(installCommand(runner));
});

test('the license page names the upstream author, the license and the CC0 format', () => {
  const page = read('license.md');
  for (const s of [
    'Peter Henningsen',
    'Aaron Dalton',
    'GPL-3.0-or-later',
    'CC0-1.0',
    'v<version>',
  ]) {
    expect(page).toContain(s);
  }
});

test('the about page credits upstream and the port with equal weight', () => {
  const page = read('about.md');
  for (const s of [
    '## Where DungeonMaker comes from',
    'Peter Henningsen',
    'Aaron Dalton',
    '## Who carries it on',
    '[spearwolf](https://www.spearwolf.de)',
    'unofficial',
  ]) {
    expect(page).toContain(s);
  }
});
