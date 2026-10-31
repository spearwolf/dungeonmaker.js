// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import config from '../.vitepress/config';

test('the site is served below the GitHub Pages project path', () => {
  expect(config.base).toBe('/dungeonmaker.js/');
});

test('workers are emitted as ES modules (the client starts a module worker)', () => {
  expect(config.vite?.worker?.format).toBe('es');
});

test('dead links fail the build', () => {
  expect(config.ignoreDeadLinks ?? false).toBe(false);
});

test('the nav shows the package version with links to the changelog and npm', () => {
  const { version } = JSON.parse(
    readFileSync(new URL('../../packages/dungeonmaker-js/package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  const item = config.themeConfig?.nav?.find((n) => 'text' in n && n.text === version);
  expect(item).toBeDefined();
  expect(JSON.stringify(item)).toContain('CHANGELOG.md');
  expect(JSON.stringify(item)).toContain('npmjs.com/package/dungeonmaker-js');
});
