// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type DefaultTheme, defineConfig } from 'vitepress';

const apiSidebarFile = fileURLToPath(new URL('../api/typedoc-sidebar.json', import.meta.url));

// The TypeDoc sidebar is generated; without it (fresh checkout) the /api/ entry stays out.
const sidebar: DefaultTheme.SidebarMulti = existsSync(apiSidebarFile)
  ? { '/api/': JSON.parse(readFileSync(apiSidebarFile, 'utf8')) }
  : {};

export default defineConfig({
  title: 'dungeonmaker-js',
  description: 'Procedural dungeon generator for the browser and Node, powered by WebAssembly.',
  lang: 'en-US',
  base: '/dungeonmaker.js/',
  ignoreDeadLinks: false,
  vite: {
    // The client starts a module worker.
    worker: { format: 'es' },
  },
  themeConfig: {
    search: { provider: 'local' },
    nav: [{ text: 'Playground', link: '/' }],
    sidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/spearwolf/dungeonmaker.js' }],
  },
});
