// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extendDesign, toDesignText } from 'dungeonmaker-js';
import { loadCore } from 'dungeonmaker-js/core';
import * as presets from 'dungeonmaker-js/presets';
import { main } from '../../packages/dungeonmaker-js/src/node/commands.js';
import { buildDownload, type DownloadKind, downloadKinds } from '../src/downloads';
import { cliCommand } from '../src/runners';
import { DESIGN_FILE, designFileText, resolveSource, type SiteSource } from '../src/source';

const output = { rooms: true, entities: 'list', steps: true } as const;

async function dungeonFor(input: SiteSource, seed: number) {
  const resolved = await resolveSource(input);
  const core = await loadCore();
  const dungeon = { ...core.generate(toDesignText(resolved.design), seed, output), seed };
  return { resolved, dungeon };
}

const inputs: [string, SiteSource][] = [
  ['preset', { kind: 'preset', preset: 'design3A' }],
  [
    'custom design',
    {
      kind: 'design',
      design: extendDesign(presets.designEmpty, { map: { width: 60, height: 40 } }),
    },
  ],
  ['design equal to a preset', { kind: 'design', design: structuredClone(presets.design5) }],
];

test.each(inputs)(
  'every download equals the file the copied command writes (%s)',
  async (_label, input) => {
    const { resolved, dungeon } = await dungeonFor(input, 42);
    const dir = mkdtempSync(join(tmpdir(), 'dm-site-'));
    if (input.kind === 'design')
      writeFileSync(join(dir, DESIGN_FILE), designFileText(input.design));
    const argv = cliCommand('pnpm', { cliArgs: resolved.cliArgs, seed: 42, output, scale: 2 })
      .split(' ')
      .slice(3);
    expect(await main(argv, { stdout() {}, stderr() {}, cwd: dir })).toBe(0);
    for (const kind of downloadKinds(resolved).filter((k) => k !== 'design')) {
      const file = await buildDownload(kind, { dungeon, resolved, scale: 2 });
      const bytes = typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data;
      expect(Buffer.from(bytes).equals(readFileSync(join(dir, file.fileName))), file.fileName).toBe(
        true,
      );
    }
  },
);

test('file names follow the CLI default {name}-{seed}', async () => {
  const { resolved, dungeon } = await dungeonFor({ kind: 'preset', preset: 'design3A' }, 42);
  const names = async (kinds: DownloadKind[]) =>
    Promise.all(kinds.map(async (k) => (await buildDownload(k, { dungeon, resolved })).fileName));
  expect(await names(['json', 'png', 'tmj', 'tileset', 'txt', 'bin'])).toEqual([
    'design3A-42.dungeon.json',
    'design3A-42.png',
    'design3A-42.tmj',
    'dungeonmaker-tiles.png',
    'design3A-42.txt',
    'design3A-42.bin',
  ]);
  const custom = await dungeonFor({ kind: 'design', design: presets.designEmpty }, 7);
  const design = await buildDownload('design', custom);
  expect(design.fileName).toBe('design.json');
  expect(design.mime).toBe('application/json');
  expect(design.data).toBe(designFileText(presets.designEmpty));
  expect((await buildDownload('json', custom)).fileName).toBe('design-7.dungeon.json');
});

test('MIME types per kind', async () => {
  const ctx = await dungeonFor({ kind: 'preset', preset: 'design3A' }, 42);
  const mime = async (k: DownloadKind) => (await buildDownload(k, ctx)).mime;
  expect(await mime('json')).toBe('application/json');
  expect(await mime('tmj')).toBe('application/json');
  expect(await mime('png')).toBe('image/png');
  expect(await mime('tileset')).toBe('image/png');
  expect(await mime('txt')).toBe('text/plain;charset=utf-8');
  expect(await mime('bin')).toBe('application/octet-stream');
});

test('downloadKinds offers design.json only for editor designs', async () => {
  const preset = await resolveSource({ kind: 'preset', preset: 'design3A' });
  const editor = await resolveSource({ kind: 'design', design: presets.designEmpty });
  expect(downloadKinds(preset)).toEqual(['json', 'png', 'tmj', 'tileset', 'txt', 'bin']);
  expect(downloadKinds(editor)).toEqual(['json', 'png', 'tmj', 'tileset', 'txt', 'bin', 'design']);
});
