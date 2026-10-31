// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateToFiles } from '../../src/node/generate.js';
import * as presets from '../../src/presets.js';
import { checkGolden, sha256Hex } from '../golden-export.js';

const generator = 'dungeonmaker-js@test';
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dm-gen-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const hash = async (file: string) => sha256Hex(new Uint8Array(await readFile(join(dir, file))));

test('writes all formats and matches the export goldens', async () => {
  const r = await generateToFiles({
    preset: 'design3A',
    seeds: [42],
    formats: ['png', 'tmj', 'txt', 'bin'],
    outDir: dir,
    generator,
  });
  expect((await readdir(dir)).sort()).toEqual(
    [
      'design3A-42.bin',
      'design3A-42.png',
      'design3A-42.tmj',
      'design3A-42.txt',
      'dungeonmaker-tiles.png',
    ].sort(),
  );
  expect(r.files).toHaveLength(5);
  expect(r.files.every((f) => f.startsWith('/'))).toBe(true);
  expect(await hash('design3A-42.png')).toBe(checkGolden('png', await hash('design3A-42.png')));
  expect(await hash('design3A-42.txt')).toBe(checkGolden('txt', await hash('design3A-42.txt')));
  expect(await hash('design3A-42.bin')).toBe(checkGolden('bin', await hash('design3A-42.bin')));
  expect(await hash('dungeonmaker-tiles.png')).toBe(
    checkGolden('tileset', await hash('dungeonmaker-tiles.png')),
  );
  expect(await hash('design3A-42.tmj')).toBe(
    checkGolden('tmj-plain', await hash('design3A-42.tmj')),
  );
});

test('layered json and tmj match their goldens', async () => {
  await generateToFiles({
    preset: 'design3A',
    seeds: [42],
    formats: ['json'],
    outDir: dir,
    generator,
    output: { rooms: true, entities: 'list', steps: true },
  });
  const json = await hash('design3A-42.dungeon.json');
  expect(json).toBe(checkGolden('json', json));
  await generateToFiles({
    preset: 'design3A',
    seeds: [42],
    formats: ['tmj'],
    outDir: dir,
    generator,
    output: { rooms: true, entities: 'list' },
  });
  const tmj = await hash('design3A-42.tmj');
  expect(tmj).toBe(checkGolden('tmj', tmj));
});

test('a design equal to a preset is written as that preset, even when embedding', async () => {
  await generateToFiles({
    design: presets.design3A,
    embedDesign: true,
    seeds: [42],
    formats: ['json'],
    outDir: dir,
    generator,
  });
  const file = JSON.parse(await readFile(join(dir, 'dungeon-42.dungeon.json'), 'utf8'));
  expect(file.source).toEqual({ preset: 'design3A' });
  expect(file.design).toBeUndefined();
});

test('a custom design is written as hash, embedded on request', async () => {
  const custom = {
    ...presets.design3A,
    map: { ...presets.design3A.map, width: 170 },
  } as typeof presets.design3A;
  const run = (embedDesign: boolean) =>
    generateToFiles({
      design: custom,
      designName: 'mine',
      embedDesign,
      seeds: [3],
      formats: ['json'],
      outDir: dir,
      generator,
    });
  await run(false);
  const plain = JSON.parse(await readFile(join(dir, 'mine-3.dungeon.json'), 'utf8'));
  expect(plain.source).toEqual({ designHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) });
  await run(true);
  const embedded = JSON.parse(await readFile(join(dir, 'mine-3.dungeon.json'), 'utf8'));
  expect(embedded.source.design.map.width).toBe(170);
});

test('arguments are validated before anything is written', async () => {
  const base = { formats: ['txt'], outDir: join(dir, 'out') } as const;
  await expect(
    generateToFiles({ ...base, preset: 'design3A', seeds: [1, 2], name: 'fixed' }),
  ).rejects.toThrow(RangeError);
  await expect(generateToFiles({ ...base, preset: 'design3A', seeds: [0] })).rejects.toThrow(
    RangeError,
  );
  await expect(
    generateToFiles({ ...base, preset: 'design3A', design: presets.design3A, seeds: [1] }),
  ).rejects.toThrow(TypeError);
  await expect(generateToFiles({ ...base, seeds: [1] })).rejects.toThrow(TypeError);
  await expect(readdir(join(dir, 'out'))).rejects.toThrow();
});

test('manifest lists both seeds', async () => {
  const r = await generateToFiles({
    preset: 'design3A',
    seeds: [1, 2],
    formats: ['txt'],
    outDir: dir,
    manifest: true,
    generator,
  });
  expect(r.manifest).toBe(join(dir, 'manifest.json'));
  const m = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  expect(m.format).toBe('dungeonmaker-js/manifest');
  expect(m.source).toEqual({ preset: 'design3A' });
  expect(m.files).toEqual([
    { seed: 1, files: ['design3A-1.txt'] },
    { seed: 2, files: ['design3A-2.txt'] },
  ]);
});

test('all five formats in one call', async () => {
  const r = await generateToFiles({
    preset: 'design3A',
    seeds: [42],
    formats: ['json', 'png', 'tmj', 'txt', 'bin'],
    outDir: dir,
    generator,
  });
  expect((await readdir(dir)).sort()).toEqual(
    [
      'design3A-42.bin',
      'design3A-42.dungeon.json',
      'design3A-42.png',
      'design3A-42.tmj',
      'design3A-42.txt',
      'dungeonmaker-tiles.png',
    ].sort(),
  );
  expect(r.files).toHaveLength(6);
});

describe('rejects before any side effect', () => {
  const outDir = () => join(dir, 'out');
  const gone = () => expect(stat(outDir())).rejects.toThrow();

  test('unknown or empty formats', async () => {
    const base = { preset: 'design3A', seeds: [1] } as const;
    await expect(
      generateToFiles({ ...base, formats: ['svg'] as never, outDir: outDir() }),
    ).rejects.toThrow(/svg/);
    await expect(generateToFiles({ ...base, formats: [], outDir: outDir() })).rejects.toThrow(
      RangeError,
    );
    await gone();
  });

  test('bad scale', async () => {
    await expect(
      generateToFiles({
        preset: 'design3A',
        seeds: [1],
        formats: ['txt', 'png'],
        scale: 0,
        outDir: outDir(),
      }),
    ).rejects.toThrow(RangeError);
    await gone();
  });

  test('malformed design text and object', async () => {
    const base = { seeds: [1], formats: ['txt'], outDir: outDir() } as const;
    await expect(generateToFiles({ ...base, design: 'D 1 2 3\nbogus' })).rejects.toThrow();
    await expect(
      generateToFiles({
        ...base,
        design: { ...presets.design3A, map: { ...presets.design3A.map, width: 1 } },
      }),
    ).rejects.toThrow();
    await gone();
  });

  test('a name that makes a png collide with the tileset', async () => {
    await expect(
      generateToFiles({
        preset: 'design3A',
        seeds: [1],
        formats: ['png', 'tmj'],
        name: 'dungeonmaker-tiles',
        outDir: outDir(),
      }),
    ).rejects.toThrow(RangeError);
    await gone();
  });
});
