// SPDX-License-Identifier: GPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = (path: string) =>
  fileURLToPath(new URL(`../packages/dungeonmaker-js/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^dungeonmaker-js$/, replacement: pkg('src/index.ts') },
      { find: /^dungeonmaker-js\/node$/, replacement: pkg('src/node/index.ts') },
      { find: /^dungeonmaker-js\/design\.schema\.json$/, replacement: pkg('design.schema.json') },
      { find: /^dungeonmaker-js\/dungeon\.schema\.json$/, replacement: pkg('dungeon.schema.json') },
      ...['core', 'schema', 'presets', 'render', 'export'].map((entry) => ({
        find: new RegExp(`^dungeonmaker-js/${entry}$`),
        replacement: pkg(`src/${entry}.ts`),
      })),
    ],
  },
  test: {
    name: 'site',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
});
