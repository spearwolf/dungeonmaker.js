#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Decides whether release.yml publishes: only when the package version on master is
// higher than every version already on npm (spec §8.6).
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const PACKAGE = 'dungeonmaker-js';

/**
 * @param {{ version: string, published: readonly string[] }} input
 * @returns {{ publish: boolean, distTag: 'latest' | 'next' }}
 */
export function decideRelease({ version, published }) {
  if (!semver.valid(version)) throw new Error(`"${version}" is not a valid semver version`);
  const distTag = semver.prerelease(version) ? 'next' : 'latest';
  if (published.includes(version)) return { publish: false, distTag };
  const highest = semver.maxSatisfying([...published], '*', { includePrerelease: true });
  if (highest && semver.lte(version, highest)) {
    throw new Error(`refusing downgrade: ${version} <= already published ${highest}`);
  }
  return { publish: true, distTag };
}

function publishedVersions() {
  try {
    const out = execFileSync('npm', ['view', PACKAGE, 'versions', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    if (String(e.stdout ?? '').includes('E404') || String(e.stderr ?? '').includes('E404'))
      return [];
    throw e;
  }
}

function main() {
  const pkg = JSON.parse(
    readFileSync(new URL('../packages/dungeonmaker-js/package.json', import.meta.url), 'utf8'),
  );
  const { publish, distTag } = decideRelease({
    version: pkg.version,
    published: publishedVersions(),
  });
  const lines = `publish=${publish}\nversion=${pkg.version}\ndist-tag=${distTag}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
  else process.stdout.write(lines);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
