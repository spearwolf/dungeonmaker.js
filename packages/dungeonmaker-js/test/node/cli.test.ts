// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toDesignText } from '../../src/config/serialize.js';
import { main } from '../../src/node/commands.js';
import * as presets from '../../src/presets.js';
import { checkGolden, sha256Hex } from '../golden-export.js';
import { readDesign } from '../helpers.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dm-cli-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

async function run(...argv: string[]) {
  let stdout = '';
  let stderr = '';
  const code = await main(argv, {
    stdout: (t) => {
      stdout += t;
    },
    stderr: (t) => {
      stderr += t;
    },
    cwd: dir,
    generator: 'dungeonmaker-js@test',
  });
  return { code, stdout, stderr };
}

const hash = async (file: string) => sha256Hex(new Uint8Array(await readFile(join(dir, file))));
const pkgFile = (name: string) => readFile(new URL(`../../${name}`, import.meta.url), 'utf8');

test('generate writes json, png and tmj with the tileset and matches the goldens', async () => {
  const r = await run(
    'generate',
    '--preset',
    'design3A',
    '--seed',
    '42',
    '--format',
    'json,png,tmj',
  );
  expect(r.code).toBe(0);
  expect(r.stdout.trim().split('\n')).toEqual([
    'design3A-42.dungeon.json',
    'design3A-42.png',
    'design3A-42.tmj',
    'dungeonmaker-tiles.png',
  ]);
  expect((await readdir(dir)).sort()).toEqual([
    'design3A-42.dungeon.json',
    'design3A-42.png',
    'design3A-42.tmj',
    'dungeonmaker-tiles.png',
  ]);
  for (const [key, file] of [
    ['png', 'design3A-42.png'],
    ['tileset', 'dungeonmaker-tiles.png'],
    ['tmj-plain', 'design3A-42.tmj'],
  ] as const) {
    const h = await hash(file);
    expect(h).toBe(checkGolden(key, h));
  }
});

test('generate with layers matches the layered json golden', async () => {
  const r = await run(
    'generate',
    '--preset',
    'design3A',
    '--seed',
    '42',
    '--rooms',
    '--entities',
    'list',
    '--steps',
  );
  expect(r.code).toBe(0);
  const h = await hash('design3A-42.dungeon.json');
  expect(h).toBe(checkGolden('json', h));
});

test('a name template without {seed} for several seeds is a usage error and writes nothing', async () => {
  const r = await run('generate', '--preset', 'design3A', '--seeds', '1..3', '--name', 'fixed');
  expect(r.code).toBe(2);
  expect(r.stderr).toContain('{seed}');
  expect(await readdir(dir)).toEqual([]);
});

test('invalid seed specs are usage errors naming the input', async () => {
  for (const spec of ['0..3', '5..1', '1..20000', 'abc', '4294967296']) {
    const r = await run('generate', '--preset', 'design3A', '--seeds', spec);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(spec);
  }
  expect(await readdir(dir)).toEqual([]);
});

test.each([
  ['unknown preset', ['generate', '--preset', 'nope']],
  ['preset and design', ['generate', '--preset', 'design3A', '--design', 'x.json']],
  ['neither preset nor design', ['generate']],
  ['unknown format', ['generate', '--preset', 'design3A', '--format', 'gif']],
  ['unknown entities mode', ['generate', '--preset', 'design3A', '--entities', 'all']],
  ['seed and seeds', ['generate', '--preset', 'design3A', '--seed', '1', '--seeds', '2']],
  ['seed and count', ['generate', '--preset', 'design3A', '--seed', '1', '--count', '2']],
  ['bad scale', ['generate', '--preset', 'design3A', '--scale', '0']],
  ['unknown option', ['generate', '--preset', 'design3A', '--bogus']],
  ['unknown command', ['frobnicate']],
])('usage error: %s', async (_, argv) => {
  const r = await run(...argv);
  expect(r.code).toBe(2);
  expect(r.stderr).not.toBe('');
  expect(await readdir(dir)).toEqual([]);
});

test('--count draws random seeds, one file each', async () => {
  const r = await run('generate', '--preset', 'designEmpty', '--count', '3');
  expect(r.code).toBe(0);
  expect(r.stdout.trim().split('\n')).toHaveLength(3);
  expect(await readdir(dir)).toHaveLength(3);
});

test('--out is relative to cwd and is created; --manifest writes manifest.json', async () => {
  const r = await run(
    'generate',
    '--preset',
    'designEmpty',
    '--seed',
    '7',
    '--out',
    'out/x',
    '--manifest',
  );
  expect(r.code).toBe(0);
  expect(r.stdout.trim().split('\n')).toEqual([
    join('out', 'x', 'designEmpty-7.dungeon.json'),
    join('out', 'x', 'manifest.json'),
  ]);
});

test('validate: invalid json gives paths on stderr and exit 1, a preset as json is valid', async () => {
  await writeFile(join(dir, 'bad.json'), JSON.stringify({ map: { width: 'x' } }));
  const bad = await run('validate', 'bad.json');
  expect(bad.code).toBe(1);
  expect(bad.stderr).toMatch(/\/map\/width: /);

  await writeFile(join(dir, 'ok.json'), JSON.stringify(presets.design3A));
  const ok = await run('validate', 'ok.json');
  expect(ok.code).toBe(0);
  expect(ok.stdout.trim()).toBe('valid');
});

test('validate: legacy text, broken text, missing file and missing argument', async () => {
  await writeFile(join(dir, 'design3A'), readDesign('design3A'));
  expect((await run('validate', 'design3A')).code).toBe(0);
  await writeFile(join(dir, 'broken'), 'D 3 3\n');
  expect((await run('validate', 'broken')).code).toBe(1);
  expect((await run('validate', 'missing.json')).code).toBe(1);
  expect((await run('validate')).code).toBe(2);
});

test('convert turns legacy text into json with $schema first', async () => {
  await writeFile(join(dir, 'design3A'), readDesign('design3A'));
  const r = await run('convert', 'design3A');
  expect(r.code).toBe(0);
  expect(r.stdout.endsWith('}\n')).toBe(true);
  const parsed = JSON.parse(r.stdout);
  expect(Object.keys(parsed)[0]).toBe('$schema');
  expect(toDesignText(parsed)).toBe(toDesignText(presets.design3A));

  const out = await run('convert', 'design3A', '--out', 'x.json');
  expect(out.code).toBe(0);
  expect(out.stdout).toBe('');
  expect(await readFile(join(dir, 'x.json'), 'utf8')).toBe(r.stdout);
});

test('convert normalises BOM and CRLF like generate does', async () => {
  const lf = readDesign('design3A');
  await writeFile(join(dir, 'crlf'), `﻿${lf.replace(/\n/g, '\r\n')}`);
  await writeFile(join(dir, 'lf'), lf);
  expect((await run('convert', 'crlf')).stdout).toBe((await run('convert', 'lf')).stdout);
});

test('schema prints the packaged schema files', async () => {
  expect((await run('schema')).stdout).toBe(await pkgFile('design.schema.json'));
  expect((await run('schema', 'design')).stdout).toBe(await pkgFile('design.schema.json'));
  expect((await run('schema', 'dungeon')).stdout).toBe(await pkgFile('dungeon.schema.json'));
  expect((await run('schema', 'other')).code).toBe(2);
});

test('presets lists the eleven presets with their size', async () => {
  const r = await run('presets');
  expect(r.code).toBe(0);
  const lines = r.stdout.trim().split('\n');
  expect(lines).toHaveLength(11);
  expect(lines[0]).toMatch(/^design {2}\d+x\d+$/);
  expect(lines).toContain('design3A  160x81');
});

test('help carries the licence sentence; no arguments is a usage error; version', async () => {
  for (const flag of ['--help', '-h', 'help']) {
    const r = await run(flag);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(
      'Generated files are program output and are not covered by the GPL; this CLI is GPL-3.0-or-later.',
    );
  }
  const none = await run();
  expect(none.code).toBe(2);
  expect(none.stderr).toContain('Usage');
  const v = await run('--version');
  expect(v.code).toBe(0);
  expect(v.stdout).toMatch(/^\d+\.\d+\.\d+/);
});

test('generate --design with count, rooms and entities writes json with entities and designHash', async () => {
  // not byte-equal to any preset, so the file records a hash instead of a preset name
  await mkdir(join(dir, 'in'));
  await writeFile(
    join(dir, 'in', 'cave.txt'),
    readDesign('design3A').replace('D   81     160', 'D   81     161'),
  );
  const r = await run(
    'generate',
    '--design',
    'in/cave.txt',
    '--count',
    '2',
    '--rooms',
    '--entities',
    'list',
    '--out',
    'out',
  );
  expect(r.code).toBe(0);
  const files = r.stdout.trim().split('\n');
  expect(files).toHaveLength(2);
  for (const f of files) {
    const json = JSON.parse(await readFile(join(dir, f), 'utf8'));
    expect(json.entities).toBeDefined();
    expect(json.source.designHash).toMatch(/\w+/);
  }
});

test('generate --design with a broken design is exit 1', async () => {
  await writeFile(join(dir, 'broken'), 'D 3 3\n');
  expect((await run('generate', '--design', 'broken')).code).toBe(1);
  expect((await run('generate', '--design', 'missing.txt')).code).toBe(1);
});
