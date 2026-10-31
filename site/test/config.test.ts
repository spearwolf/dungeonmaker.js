// SPDX-License-Identifier: GPL-3.0-or-later
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
