#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Packs dungeonmaker-js, builds the fixtures in fixtures/bundlers/ (Vite build and dev, webpack 5)
// against the tarball without any bundler configuration, and runs the README's browser example
// in Chromium: the production builds under the strict CSP documented in the README.
import { execFileSync, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../', import.meta.url));
const expected = '99cc67de'; // golden FNV-1a of design3A, seed 42
const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'";
const TIMEOUT = 30_000;

const README_SECTION = '## Quick start (browser)';
const readme = readFileSync(join(repo, 'packages/dungeonmaker-js/README.md'), 'utf8');
const readmeExample = readme
  .slice(readme.indexOf(README_SECTION))
  .match(/```js\n([\s\S]*?)```/)?.[1];
if (!readme.includes(README_SECTION) || !readmeExample) {
  throw new Error(`README.md has no js code block under "${README_SECTION}"`);
}

// The README example verbatim, followed by a reporter. FNV-1a is inlined: fixtures cannot import
// repository files.
const entry = `${readmeExample}
const fnv1a32 = (bytes) => {
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};
window.__dungeon = {
  width: dungeon.width,
  height: dungeon.height,
  byteLength: dungeon.cells.buffer.byteLength,
  hash: fnv1a32(dungeon.cells),
};
`;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.json': 'application/json',
};

const tempDirs = [];
const children = [];
const servers = [];
const failures = [];

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const run = (cmd, args, cwd) => {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
  } catch (error) {
    process.stderr.write(`${error.stdout ?? ''}${error.stderr ?? ''}`);
    throw error;
  }
};

async function serveStatic(dir, csp) {
  const port = await freePort();
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(dir, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    const headers = { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' };
    if (csp) headers['content-security-policy'] = csp;
    res.writeHead(200, headers).end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  servers.push(server);
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

/** Starts the Vite dev server on a free port and resolves once it reports readiness. */
async function startViteDev(cwd) {
  const port = await freePort();
  const child = spawn(
    'pnpm',
    ['exec', 'vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd, detached: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } },
  );
  children.push(child);
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`vite dev did not become ready:\n${output}`)),
      TIMEOUT,
    );
    const onData = (chunk) => {
      output += chunk;
      if (/ready/i.test(output)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`vite dev exited early (${code}):\n${output}`));
    });
  });
  return { url: `http://127.0.0.1:${port}/`, output: () => output };
}

/** Opens the page in Chromium; returns the problems found, or the dungeon report. */
async function inspect(browser, url, { csp }) {
  const page = await browser.newPage();
  const problems = [];
  try {
    await page.addInitScript(() => {
      // A rejected top-level await in the example surfaces as one of these two events.
      window.addEventListener('unhandledrejection', (e) => {
        window.__dungeonError = String(e.reason?.stack ?? e.reason);
      });
      window.addEventListener('error', (e) => {
        window.__dungeonError = String(e.error?.stack ?? e.message);
      });
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__cspViolations = [
          ...(window.__cspViolations ?? []),
          `${e.violatedDirective} blocked ${e.blockedURI}`,
        ];
      });
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      if (msg.location().url.endsWith('favicon.ico')) return;
      if (/favicon\.ico/.test(msg.text())) return;
      // A CSP block also logs here; the 404 for the favicon logs without a location.
      problems.push(`console error: ${msg.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    const response = await page.goto(url);
    const cspHeader = response?.headers()['content-security-policy'];
    if (csp && cspHeader !== CSP) problems.push(`CSP header missing or wrong: ${cspHeader}`);
    await page.waitForFunction(() => window.__dungeon || window.__dungeonError, undefined, {
      timeout: TIMEOUT,
    });
    const result = await page.evaluate(() => ({
      dungeon: window.__dungeon,
      error: window.__dungeonError,
      csp: window.__cspViolations ?? [],
    }));
    if (result.error) problems.push(`createDungeon rejected: ${result.error}`);
    for (const violation of result.csp) problems.push(`CSP violation: ${violation}`);
    const d = result.dungeon;
    if (d) {
      if (d.hash !== expected) problems.push(`hash ${d.hash} !== ${expected}`);
      if (d.byteLength !== d.width * d.height) {
        problems.push(`byteLength ${d.byteLength} !== ${d.width}x${d.height}`);
      }
    }
    return { problems, hash: d?.hash };
  } catch (error) {
    problems.push(`${error.message}`);
    return { problems };
  } finally {
    await page.close();
  }
}

function report(label, { problems, hash }) {
  if (problems.length === 0) {
    console.log(`bundler smoke ok: ${label} ${hash}`);
    return;
  }
  failures.push(`${label}:\n  ${problems.join('\n  ')}`);
}

async function main() {
  const packDir = mkdtempSync(join(tmpdir(), 'dm-bundler-pack-'));
  tempDirs.push(packDir);
  run('pnpm', ['--filter', 'dungeonmaker-js', 'pack', '--pack-destination', packDir], repo);
  const tarballName = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
  if (!tarballName) throw new Error('pnpm pack produced no tarball');
  const tarball = join(packDir, tarballName);

  const prepare = (name) => {
    const dir = mkdtempSync(join(tmpdir(), `dm-bundler-${name}-`));
    tempDirs.push(dir);
    cpSync(join(repo, 'fixtures/bundlers', name), dir, { recursive: true });
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src/index.js'), entry);
    run('pnpm', ['install'], dir);
    run('pnpm', ['add', tarball], dir);
    return dir;
  };

  const browser = await chromium.launch();
  try {
    const vite = prepare('vite');
    const viteOut = run('pnpm', ['exec', 'vite', 'build'], vite);
    if (/externaliz|warn/i.test(viteOut)) {
      failures.push(`vite build:\n  output mentions externalization or warnings:\n${viteOut}`);
    } else {
      const site = await serveStatic(join(vite, 'dist'), CSP);
      report('vite build', await inspect(browser, site.url, { csp: true }));
      site.close();
    }

    const dev = await startViteDev(vite);
    report('vite dev', await inspect(browser, dev.url, { csp: false }));

    const webpack = prepare('webpack');
    const webpackOut = run('pnpm', ['exec', 'webpack', '--mode', 'production'], webpack);
    if (!/compiled successfully/.test(webpackOut)) {
      failures.push(`webpack:\n  output lacks "compiled successfully":\n${webpackOut}`);
    } else {
      cpSync(join(webpack, 'index.html'), join(webpack, 'dist/index.html'));
      const site = await serveStatic(join(webpack, 'dist'), CSP);
      report('webpack', await inspect(browser, site.url, { csp: true }));
      site.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  failures.push(String(error?.stack ?? error));
} finally {
  for (const server of servers) server.close();
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`bundler smoke FAILED:\n${failures.join('\n')}`);
  process.exit(1);
}
