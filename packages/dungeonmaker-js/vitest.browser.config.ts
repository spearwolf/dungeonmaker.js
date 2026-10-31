// SPDX-License-Identifier: GPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dist = (path: string) => fileURLToPath(new URL(`./dist/${path}`, import.meta.url));
const browsers = (process.env.DM_BROWSERS ?? 'chromium,firefox,webkit')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^dungeonmaker-js$/, replacement: dist('index.js') },
      { find: /^dungeonmaker-js\/(.+)$/, replacement: `${dist('$1')}.js` },
    ],
  },
  test: {
    globals: true,
    include: ['test/browser/**/*.browser.test.ts'],
    testTimeout: 60_000,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: browsers.map((browser) => ({
        browser: browser as 'chromium' | 'firefox' | 'webkit',
      })),
    },
  },
});
