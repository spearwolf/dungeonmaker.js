// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const load = (name) =>
  parse(readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8'));

test('the aggregate ci job fails when a needed job failed, was cancelled or skipped', () => {
  const ci = load('ci.yml').jobs.ci;
  // Without always(), a failed dependency skips the job, and a skipped required check is green.
  expect(ci.if).toMatch(/always\(\)/);
  const gate = ci.steps.find((step) => step.run?.includes('exit 1'));
  for (const result of ['failure', 'cancelled', 'skipped']) {
    expect(gate?.if).toContain(`'${result}'`);
  }
});

test('ci.yml can be reused by the release workflow', () => {
  expect(load('ci.yml').on).toHaveProperty('workflow_call');
});

test('npm publish waits for the full ci workflow, including native and wasm drift', () => {
  const { jobs } = load('release.yml');
  const ciJob = Object.entries(jobs).find(([, job]) => job.uses === './.github/workflows/ci.yml');
  expect(ciJob).toBeDefined();
  expect(jobs.publish.needs).toContain(ciJob?.[0]);
});

test('tagging is a separate job that also runs when the version was published earlier', () => {
  const { jobs } = load('release.yml');
  expect(jobs.tag.needs).toEqual(expect.arrayContaining(['check', 'publish']));
  expect(jobs.tag.if).toMatch(/always\(\)/);
  expect(jobs.tag.if).toContain("needs.check.outputs.tag == 'true'");
  expect(jobs.publish.permissions).not.toHaveProperty('contents', 'write');
});

test('npm publish gets an explicit file path, not something npm reads as a GitHub shorthand', () => {
  // `npm publish out/x.tgz` is parsed as github:out/x.tgz; only ./ or / make it a local file.
  const step = load('release.yml').jobs.publish.steps.find((s) => s.run?.includes('npm publish'));
  expect(step?.run).toMatch(/npm publish "?(\.\/|\/|\$GITHUB_WORKSPACE\/)/);
});

test('the tag job waits long enough for a fresh version to appear on the registry', () => {
  // The 0.0.2 release showed about a minute between npm publish and the version being fetchable.
  const step = load('release.yml').jobs.tag.steps.find((s) => s.run?.includes('npm pack'));
  const tries = Number(step?.run.match(/for _ in \$\(seq 1 (\d+)\)/)?.[1] ?? 0);
  const sleep = Number(step?.run.match(/sleep (\d+)/)?.[1] ?? 0);
  expect(tries * sleep).toBeGreaterThanOrEqual(300);
});

test('browser tests are part of the required ci gate and run all three engines', () => {
  const { jobs } = load('ci.yml');
  expect(jobs.ci.needs).toContain('browser');
  const install = jobs.browser.steps.find((s) => s.run?.includes('playwright install'));
  expect(install?.run).toMatch(/chromium firefox webkit/);
  expect(JSON.stringify(jobs.browser)).not.toMatch(/DM_BROWSERS/);
});

test('the bundler smoke test is part of the required ci gate', () => {
  const { jobs } = load('ci.yml');
  expect(jobs.ci.needs).toContain('bundlers');
  expect(jobs.bundlers.steps.some((s) => s.run?.includes('pnpm bundler:smoke'))).toBe(true);
});

test('the site build and its browser checks are part of the required ci gate', () => {
  const { jobs } = load('ci.yml');
  expect(jobs.ci.needs).toContain('site');
  const runs = jobs.site.steps.map((s) => s.run ?? '');
  expect(runs).toEqual(expect.arrayContaining(['pnpm site:build', 'pnpm site:e2e']));
  expect(runs.some((r) => /playwright install --with-deps chromium/.test(r))).toBe(true);
});
