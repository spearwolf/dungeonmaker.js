#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Decides what release.yml does (spec §8.6):
// - publish: the package version on master is higher than every version on npm;
// - tag: tag v<version> and create the GitHub release. That happens after a publish, and also
//   when an earlier run published the version but failed before tagging (retry), or when the
//   version was published by hand from exactly this commit (the one-time 0.0.1).
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const PACKAGE = 'dungeonmaker-js';

/**
 * @param {{
 *   version: string,
 *   published: readonly string[],
 *   tagExists: boolean,
 *   publishedGitHead: string | undefined,
 *   headSha: string,
 * }} input
 * @returns {{ publish: boolean, tag: boolean, distTag: 'latest' | 'next' }}
 */
export function decideRelease({ version, published, tagExists, publishedGitHead, headSha }) {
  if (!semver.valid(version)) throw new Error(`"${version}" is not a valid semver version`);
  const distTag = semver.prerelease(version) ? 'next' : 'latest';

  if (published.includes(version)) {
    // Only tag a commit that provably is the published source (corresponding source, §9.3).
    const tag = !tagExists && publishedGitHead !== undefined && publishedGitHead === headSha;
    return { publish: false, tag, distTag };
  }
  if (tagExists) {
    throw new Error(`tag v${version} already exists, but ${version} is not on npm`);
  }
  const highest = semver.maxSatisfying([...published], '*', { includePrerelease: true });
  if (highest && semver.lte(version, highest)) {
    throw new Error(`refusing downgrade: ${version} <= already published ${highest}`);
  }
  return { publish: true, tag: true, distTag };
}

function npmView(args) {
  try {
    const out = execFileSync('npm', ['view', ...args, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out ? JSON.parse(out) : undefined;
  } catch (e) {
    if (`${e.stdout ?? ''}${e.stderr ?? ''}`.includes('E404')) return undefined;
    throw e;
  }
}

function main() {
  const { version } = JSON.parse(
    readFileSync(new URL('../packages/dungeonmaker-js/package.json', import.meta.url), 'utf8'),
  );
  const versions = npmView([PACKAGE, 'versions']);
  const published = versions === undefined ? [] : [versions].flat();
  const publishedGitHead = published.includes(version)
    ? npmView([`${PACKAGE}@${version}`, 'gitHead'])
    : undefined;
  const tagExists =
    execFileSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/v${version}`], {
      encoding: 'utf8',
    }).trim() !== '';
  const headSha =
    process.env.GITHUB_SHA ??
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  const { publish, tag, distTag } = decideRelease({
    version,
    published,
    tagExists,
    publishedGitHead,
    headSha,
  });
  if (published.includes(version) && !tagExists && !tag) {
    console.warn(
      `warning: ${version} is on npm without tag v${version}, but its gitHead ` +
        `(${publishedGitHead ?? 'missing'}) is not this commit; tag it by hand (RELEASING.md).`,
    );
  }
  const lines = `publish=${publish}\ntag=${tag}\nversion=${version}\ndist-tag=${distTag}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
  else process.stdout.write(lines);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
