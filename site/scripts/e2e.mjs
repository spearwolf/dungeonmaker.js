// SPDX-License-Identifier: GPL-3.0-or-later
// Browser checks for the built site. Without E2E_BASE_URL a static server serves
// site/.vitepress/dist below the Pages path /dungeonmaker.js/ (and nowhere else);
// with it, a running site is checked instead.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE_PATH = '/dungeonmaker.js/';
const dist = fileURLToPath(new URL('../.vitepress/dist', import.meta.url));

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** @param {boolean} cond @param {string} message */
export function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/** Later tasks append their checks here. */
export const checks = [
  {
    name: 'home page loads under the base path',
    async run(page, base) {
      await page.goto(base);
      assert(
        (await page.title()).includes('dungeonmaker-js'),
        `unexpected title "${await page.title()}"`,
      );
    },
  },
];

async function serveDist() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (!pathname.startsWith(BASE_PATH)) {
      res.writeHead(404).end();
      return;
    }
    let file = normalize(join(dist, pathname.slice(BASE_PATH.length)));
    if (!file.startsWith(dist)) {
      res.writeHead(404).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res
      .writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      .end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}${BASE_PATH}`, close: () => server.close() };
}

async function main() {
  const external = process.env.E2E_BASE_URL;
  if (!external && !existsSync(join(dist, 'index.html'))) {
    console.error('site/.vitepress/dist is missing; run `pnpm site:build` first.');
    process.exit(1);
  }
  const server = external ? undefined : await serveDist();
  const base = external ?? server.url;
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const check of checks) {
      const page = await browser.newPage();
      const problems = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
      });
      try {
        await check.run(page, base);
        if (problems.length > 0) throw new Error(problems.join('\n  '));
        console.log(`ok ${check.name}`);
      } catch (error) {
        failed++;
        console.error(`FAIL ${check.name}\n  ${error instanceof Error ? error.message : error}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server?.close();
  }
  if (failed > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
