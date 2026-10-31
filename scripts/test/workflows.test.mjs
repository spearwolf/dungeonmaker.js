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
