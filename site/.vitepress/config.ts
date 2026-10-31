// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type DefaultTheme, defineConfig } from 'vitepress';

const apiSidebarFile = fileURLToPath(new URL('../api/typedoc-sidebar.json', import.meta.url));

// The TypeDoc sidebar is generated; without it (fresh checkout) the /api/ entry stays out.
const sidebar: DefaultTheme.SidebarMulti = existsSync(apiSidebarFile)
  ? { '/api/': JSON.parse(readFileSync(apiSidebarFile, 'utf8')) }
  : {};
sidebar['/reference/'] = [
  {
    text: 'Reference',
    items: [
      { text: 'Design config', link: '/reference/config' },
      { text: 'Dungeon file format', link: '/reference/dungeon-format' },
    ],
  },
];

export default defineConfig({
  title: 'dungeonmaker-js',
  description: 'Procedural dungeon generator for the browser and Node, powered by WebAssembly.',
  lang: 'en-US',
  base: '/dungeonmaker.js/',
  ignoreDeadLinks: false,
  vite: {
    build: {
      // The editor chunk (CodeMirror plus codemirror-json-schema, which statically pulls in its
      // YAML/JSON5 parsers and the markdown renderer for hover texts) is about 930 kB. It loads
      // only on /editor, through import() after mount; the limit stays a tripwire above it.
      chunkSizeWarningLimit: 1024,
    },
    worker: {
      // The client starts a module worker.
      format: 'es',
      // Core and wasm glue import node: builtins only on their Node path (`import()` behind an
      // environment check); left external, they stay unresolved instead of being stubbed with an
      // "externalized for browser compatibility" warning each.
      rollupOptions: { external: [/^node:/] },
    },
  },
  themeConfig: {
    search: { provider: 'local' },
    nav: [
      { text: 'Playground', link: '/' },
      { text: 'Editor', link: '/editor' },
      {
        text: 'Reference',
        items: [
          { text: 'Design config', link: '/reference/config' },
          { text: 'Dungeon file format', link: '/reference/dungeon-format' },
          { text: 'API', link: '/api/' },
        ],
      },
    ],
    sidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/spearwolf/dungeonmaker.js' }],
  },
});
