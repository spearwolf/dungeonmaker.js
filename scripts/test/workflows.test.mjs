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

test('pages.yml builds the site and uploads the VitePress output', () => {
  const { jobs } = load('pages.yml');
  expect(jobs.build.steps.some((s) => s.run === 'pnpm site:build')).toBe(true);
  const upload = jobs.build.steps.find((s) => s.uses?.startsWith('actions/upload-pages-artifact@'));
  expect(upload?.with?.path).toBe('site/.vitepress/dist');
});

test('pages.yml deploys only from master with minimal permissions', () => {
  const wf = load('pages.yml');
  expect(wf.on.push.branches).toEqual(['master']);
  expect(wf.on).toHaveProperty('workflow_dispatch');
  expect(wf.permissions).toEqual({ contents: 'read' });
  expect(wf.concurrency).toEqual({ group: 'pages', 'cancel-in-progress': false });
  expect(wf.jobs.build.permissions).toEqual({ contents: 'read', pages: 'read' });
  const { deploy } = wf.jobs;
  expect(deploy.needs).toBe('build');
  expect(deploy.if).toBe("github.ref == 'refs/heads/master'");
  expect(deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  expect(deploy.environment.name).toBe('github-pages');
  expect(deploy.steps.some((s) => s.uses?.startsWith('actions/deploy-pages@'))).toBe(true);
});
