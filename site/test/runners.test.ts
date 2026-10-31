// SPDX-License-Identifier: GPL-3.0-or-later
import { cliCommand, installCommand, RUNNERS } from '../src/runners';

test('the command reproduces a preset dungeon with a pinned version', () => {
  expect(cliCommand('pnpm', { cliArgs: ['--preset', 'design3A'], seed: 42 }, '1.0.0')).toBe(
    'pnpm dlx dungeonmaker-js@1.0.0 generate --preset design3A --seed 42 --format json,png,tmj,txt,bin',
  );
});

test('layers and scale appear in a fixed order; scale 1 and entities false are omitted', () => {
  const req = {
    cliArgs: ['--design', './design.json'],
    seed: 7,
    output: { rooms: true, entities: 'list', steps: true },
    scale: 4,
  } as const;
  expect(cliCommand('npm', req, '1.0.0')).toBe(
    'npx dungeonmaker-js@1.0.0 generate --design ./design.json --seed 7 --format json,png,tmj,txt,bin --rooms --entities list --steps --scale 4',
  );
  expect(cliCommand('yarn', { ...req, output: { entities: false }, scale: 1 }, '1.0.0')).toBe(
    'yarn dlx dungeonmaker-js@1.0.0 generate --design ./design.json --seed 7 --format json,png,tmj,txt,bin',
  );
  expect(cliCommand('bun', req, '1.0.0')).toMatch(/^bunx dungeonmaker-js@1\.0\.0 generate /);
});

test('baked entities and the default version', () => {
  const cmd = cliCommand('pnpm', {
    cliArgs: ['--preset', 'design5'],
    seed: 1,
    output: { entities: 'baked' },
  });
  expect(cmd).toMatch(/^pnpm dlx dungeonmaker-js@\d+\.\d+\.\d+\S* generate /);
  expect(cmd).toContain('--entities baked');
});

test('install commands per runner', () => {
  expect(RUNNERS).toEqual(['pnpm', 'npm', 'yarn', 'bun']);
  expect(RUNNERS.map(installCommand)).toEqual([
    'pnpm add dungeonmaker-js',
    'npm install dungeonmaker-js',
    'yarn add dungeonmaker-js',
    'bun add dungeonmaker-js',
  ]);
});
