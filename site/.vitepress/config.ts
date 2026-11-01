// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type DefaultTheme, defineConfig } from 'vitepress';

const { version } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../packages/dungeonmaker-js/package.json', import.meta.url)),
    'utf8',
  ),
) as { version: string };

const apiSidebarFile = fileURLToPath(new URL('../api/typedoc-sidebar.json', import.meta.url));

// The TypeDoc sidebar is generated; without it (fresh checkout) the /api/ entry stays out.
const sidebar: DefaultTheme.SidebarMulti = existsSync(apiSidebarFile)
  ? { '/api/': JSON.parse(readFileSync(apiSidebarFile, 'utf8')) }
  : {};
sidebar['/guide/'] = [
  {
    text: 'Guide',
    items: [
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'Worker client', link: '/guide/client' },
      { text: 'Output layers', link: '/guide/layers' },
      { text: 'Rendering and export', link: '/guide/render-export' },
      { text: 'Command line', link: '/guide/cli' },
      { text: 'Generate offline, ship data', link: '/guide/offline' },
      { text: 'Design concepts', link: '/guide/design-concepts' },
      { text: 'Orientation and cell values', link: '/guide/orientation' },
    ],
  },
];
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
      { text: 'Guide', link: '/guide/getting-started' },
      {
        text: 'Reference',
        items: [
          { text: 'Design config', link: '/reference/config' },
          { text: 'Dungeon file format', link: '/reference/dungeon-format' },
          { text: 'API', link: '/api/' },
        ],
      },
      { text: 'About', link: '/about' },
      {
        text: version,
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/spearwolf/dungeonmaker.js/blob/master/packages/dungeonmaker-js/CHANGELOG.md',
          },
          { text: 'npm', link: 'https://www.npmjs.com/package/dungeonmaker-js' },
        ],
      },
    ],
    sidebar,
    footer: {
      message:
        'DungeonMaker 2.05 © Peter Henningsen. WebAssembly port, package and site created by <a href="https://www.spearwolf.de">spearwolf</a>. Released under GPL-3.0-or-later. <a href="/dungeonmaker.js/about">About</a> · <a href="/dungeonmaker.js/license">License</a>',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/spearwolf/dungeonmaker.js' }],
  },
});
