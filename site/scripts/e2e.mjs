// SPDX-License-Identifier: GPL-3.0-or-later
// Browser checks for the built site. Without E2E_BASE_URL a static server serves
// site/.vitepress/dist below the Pages path /dungeonmaker.js/ (and nowhere else);
// with it, a running site is checked instead.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE_PATH = '/dungeonmaker.js/';
const dist = fileURLToPath(new URL('../.vitepress/dist', import.meta.url));
const pkgDist = new URL('../../packages/dungeonmaker-js/dist/', import.meta.url);

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

/** FNV-1a (32 bit) as 8 hex digits, the same function as `site/src/fnv.ts`. */
function fnv1a32(bytes) {
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** Reference generation with the built core, independent of the site. */
async function referenceDungeon(seed, output) {
  const { loadCore } = await import(new URL('core.js', pkgDist).href);
  const { toDesignText } = await import(new URL('index.js', pkgDist).href);
  const { design3A } = await import(new URL('presets.js', pkgDist).href);
  return (await loadCore()).generate(toDesignText(design3A), seed, output);
}

const DUNGEON = '[data-testid="dungeon"]';

/** Opens the playground and waits for the first dungeon. */
async function openPlayground(page, base) {
  await page.goto(base);
  await page.waitForSelector(`${DUNGEON}[data-state="ready"]`);
}

/** Waits until the dungeon is ready and its seed differs from `seed`. */
async function waitForNewSeed(page, seed) {
  await page.waitForFunction(
    ([selector, old]) => {
      const el = document.querySelector(selector);
      return el?.dataset.state === 'ready' && el.dataset.seed !== old;
    },
    [DUNGEON, seed],
  );
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
  {
    name: 'playground renders design3A seed 42',
    async run(page, base) {
      await openPlayground(page, base);
      const dungeon = page.locator(DUNGEON);
      const hash = await dungeon.getAttribute('data-hash');
      assert(hash === '99cc67de', `data-hash ${hash}, expected 99cc67de`);
      const seed = await dungeon.getAttribute('data-seed');
      assert(seed === '42', `data-seed ${seed}, expected 42`);
      const elapsed = (await page.locator('[data-testid="elapsed"]').textContent())?.trim();
      assert(/^\d+ ms$/.test(elapsed ?? ''), `elapsed "${elapsed}" does not match "<n> ms"`);
    },
  },
  {
    name: 'every download matches the CLI byte for byte',
    async run(page, base) {
      await openPlayground(page, base);
      await page.locator('[data-testid="rooms"]').check();
      await page.waitForSelector(`${DUNGEON}[data-state="ready"]`);
      await page.locator('[data-testid="entities"]').selectOption('list');
      await page.locator('[data-testid="png-scale"]').selectOption('2');
      await page.waitForSelector(`${DUNGEON}[data-state="ready"]`);
      const command = (await page.locator('[data-testid="cli-command"]').textContent())?.trim();
      for (const part of [
        '--preset design3A',
        '--seed 42',
        '--rooms',
        '--entities list',
        '--scale 2',
      ]) {
        assert(command?.includes(part), `command "${command}" lacks "${part}"`);
      }
      const dir = mkdtempSync(join(tmpdir(), 'dm-site-e2e-'));
      try {
        const cli = fileURLToPath(new URL('node/cli.js', pkgDist));
        execFileSync(process.execPath, [cli, ...command.split(' ').slice(3)], { cwd: dir });
        for (const kind of ['json', 'png', 'tmj', 'tileset', 'txt', 'bin']) {
          const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator(`[data-download="${kind}"]`).click(),
          ]);
          const name = download.suggestedFilename();
          const expected = join(dir, name);
          assert(existsSync(expected), `${kind}: the CLI wrote no ${name}`);
          const bytes = readFileSync(await download.path());
          assert(
            bytes.equals(readFileSync(expected)),
            `${kind}: ${name} differs from the CLI file`,
          );
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  {
    name: 'reroll draws a new seed and dungeon',
    async run(page, base) {
      await openPlayground(page, base);
      await page.locator('[data-testid="reroll"]').click();
      await waitForNewSeed(page, '42');
      const dungeon = page.locator(DUNGEON);
      const seed = await dungeon.getAttribute('data-seed');
      const field = await page.locator('[data-testid="seed"]').inputValue();
      assert(field === seed, `seed field ${field} differs from data-seed ${seed}`);
      const hash = await dungeon.getAttribute('data-hash');
      assert(hash !== '99cc67de', 'data-hash did not change');
    },
  },
  {
    name: 'the steps player replays to the final cells',
    async run(page, base) {
      await openPlayground(page, base);
      await page.locator('[data-testid="steps"]').check();
      await page.waitForSelector(`${DUNGEON}[data-state="ready"] [data-testid="player"]`);
      const frame = page.locator('input[data-testid="frame"]');
      const max = await frame.getAttribute('max');
      assert(Number(max) > 0, `slider max ${max}`);
      await frame.fill(max);
      await frame.dispatchEvent('input');
      const frameHash = await page
        .locator('[data-testid="player"]')
        .getAttribute('data-frame-hash');
      const hash = await page.locator(DUNGEON).getAttribute('data-hash');
      assert(frameHash === hash, `last frame ${frameHash} differs from the cells ${hash}`);
    },
  },
  {
    name: 'new requests stop the player and drop stale results',
    async run(page, base) {
      await openPlayground(page, base);
      await page.locator('[data-testid="steps"]').check();
      await page.waitForSelector(`${DUNGEON}[data-state="ready"] [data-testid="player"]`);
      await page.locator('[data-testid="play"]').click();
      // The old player must really be under way, so that a leftover frame would show.
      await page.waitForFunction(() => {
        const player = document.querySelector('[data-testid="player"]');
        const frame = document.querySelector('input[data-testid="frame"]');
        return player?.dataset.playing === 'true' && Number(frame?.value) > 0;
      });
      // Two requests in one task: the first is still running when the second is made.
      await page.evaluate(() => {
        const reroll = document.querySelector('[data-testid="reroll"]');
        reroll.click();
        reroll.click();
      });
      await waitForNewSeed(page, '42');
      const dungeon = page.locator(DUNGEON);
      const seed = await dungeon.getAttribute('data-seed');
      const field = await page.locator('[data-testid="seed"]').inputValue();
      assert(field === seed, `seed field ${field} differs from data-seed ${seed}`);
      const player = page.locator('[data-testid="player"]');
      const playing = await player.getAttribute('data-playing');
      assert(playing === 'false', `player still playing (${playing})`);
      const frame = await page.locator('input[data-testid="frame"]').inputValue();
      assert(frame === '0', `player at frame ${frame}, expected 0`);
      const reference = await referenceDungeon(Number(seed), { steps: true });
      const hash = await dungeon.getAttribute('data-hash');
      const expected = fnv1a32(reference.cells);
      assert(hash === expected, `data-hash ${hash}, the core gives ${expected} for seed ${seed}`);
      const { offsets, index, cell } = reference.steps;
      const first = new Uint8Array(reference.cells.length);
      for (let i = offsets[0]; i < offsets[1]; i++) first[index[i]] = cell[i];
      const frameHash = await player.getAttribute('data-frame-hash');
      assert(frameHash === fnv1a32(first), `frame 0 shows ${frameHash}, not the new dungeon's`);
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
