// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { Value } from 'typebox/value';
import { toDesignText } from '../src/config/serialize.js';
import { CELL_NAMES } from '../src/config/tokens.js';
import { loadCore } from '../src/core.js';
import {
  type DungeonFileOptions,
  type ExportableDungeon,
  ROWS_ALPHABET,
  toDungeonFile,
  toDungeonJson,
} from '../src/export/dungeon-json.js';
import { designSource } from '../src/export/source.js';
import { toAsciiText, toRaw } from '../src/export/text.js';
import { design3A } from '../src/presets.js';
import { DungeonFileSchema } from '../src/schema/dungeon-file.js';
import { checkGolden, sha256Hex } from './golden-export.js';

const FULL = { rooms: true, entities: 'list', steps: true } as const;
const OPTS: DungeonFileOptions = {
  generator: 'dungeonmaker-js@test',
  source: { preset: 'design3A' },
};

let dungeon: ExportableDungeon;
beforeAll(async () => {
  const core = await loadCore();
  dungeon = core.generate(toDesignText(design3A), 42, FULL);
});

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const u16 = (s: string) => new Uint16Array(b64(s).buffer);
const u32 = (s: string) => new Uint32Array(b64(s).buffer);

function decodeCells(file: ReturnType<typeof toDungeonFile>): Uint8Array {
  const c = file.cells;
  if (c.encoding === 'base64') return b64(c.data);
  if (c.encoding === 'array') return Uint8Array.from(c.data);
  return Uint8Array.from(c.data.join(''), (ch) => c.alphabet.indexOf(ch));
}

test('a $schema key is allowed so editors can find the schema, but never emitted', () => {
  const file = toDungeonFile(dungeon, OPTS);
  expect('$schema' in file).toBe(false);
  expect(Value.Check(DungeonFileSchema, { $schema: 'https://example.test/s.json', ...file })).toBe(
    true,
  );
});

test('file validates, has the documented key order and legend', () => {
  const file = toDungeonFile(dungeon, OPTS);
  expect(Value.Check(DungeonFileSchema, file)).toBe(true);
  expect(Object.keys(file)).toEqual([
    'format',
    'formatVersion',
    'generator',
    'width',
    'height',
    'seed',
    'source',
    'legend',
    'cells',
    'rooms',
    'entities',
    'steps',
  ]);
  expect(file.legend['19']).toBe('column');
  expect(file.legend['8']).toBe('insideRoomOpen');
  expect(Object.values(file.legend)).toEqual([...CELL_NAMES]);
  expect(ROWS_ALPHABET).toHaveLength(20);
});

test.each(['base64', 'rows', 'array'] as const)(
  'round trip: cells as %s, rooms, steps, entities',
  (cells) => {
    const file = toDungeonFile(dungeon, { ...OPTS, cells });
    expect(Value.Check(DungeonFileSchema, file)).toBe(true);
    expect(file.cells.encoding).toBe(cells);
    expect(decodeCells(file)).toEqual(dungeon.cells);
    expect(u16(file.rooms?.roomIds.data ?? '')).toEqual(dungeon.rooms?.roomIds);
    expect(file.rooms?.rooms).toEqual(dungeon.rooms?.rooms);
    expect(u32(file.steps?.offsets ?? '')).toEqual(dungeon.steps?.offsets);
    expect(u32(file.steps?.index ?? '')).toEqual(dungeon.steps?.index);
    expect(b64(file.steps?.cell ?? '')).toEqual(dungeon.steps?.cell);
    expect(file.entities).toEqual(dungeon.entities);
  },
);

test('layers appear only when present', () => {
  const { rooms, entities, steps, ...plain } = dungeon;
  const file = toDungeonFile(plain, OPTS);
  for (const k of ['rooms', 'entities', 'steps']) expect(k in file).toBe(false);
  const baked = toDungeonFile({ ...plain, rooms }, OPTS);
  expect('entities' in baked).toBe(false);
  expect('rooms' in baked).toBe(true);
});

describe('design source (no design text in export files)', () => {
  test('preset reference carries no design anywhere', () => {
    expect(JSON.stringify(toDungeonFile(dungeon, OPTS))).not.toContain('"design"');
  });

  test('designSource hashes and embeds on request', async () => {
    const s = await designSource(design3A);
    expect(s).toEqual({ designHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) });
    expect('design' in s).toBe(false);
    const e = await designSource(design3A, { embed: true });
    expect('design' in e && e.design).toEqual(design3A);
    const text = await designSource(toDesignText(design3A));
    expect(text).toEqual(s);
  });

  test('only plain JSON values, and the schema rejects extra keys', () => {
    const parsed = JSON.parse(toDungeonJson(dungeon, OPTS));
    const plain = (v: unknown): boolean =>
      v === null
        ? false
        : Array.isArray(v)
          ? v.every(plain)
          : typeof v === 'object'
            ? Object.values(v as object).every(plain)
            : ['string', 'number', 'boolean'].includes(typeof v);
    expect(plain(parsed)).toBe(true);
    expect(Value.Check(DungeonFileSchema, { ...parsed, extra: 1 })).toBe(false);
    expect(Value.Check(DungeonFileSchema, { ...parsed, source: { preset: 'x', design: {} } })).toBe(
      false,
    );
  });
});

test('toAsciiText and toRaw', () => {
  expect(toAsciiText(dungeon).endsWith('\n')).toBe(true);
  const raw = toRaw(dungeon);
  expect(raw).toHaveLength(8 + dungeon.width * dungeon.height);
  expect([...raw.slice(0, 8)]).toEqual([
    dungeon.width & 255,
    dungeon.width >> 8,
    0,
    0,
    dungeon.height & 255,
    dungeon.height >> 8,
    0,
    0,
  ]);
  expect(raw.slice(8)).toEqual(dungeon.cells);
});

test('toDungeonJson is 2-space JSON with trailing newline', () => {
  const json = toDungeonJson(dungeon, OPTS);
  expect(json.endsWith('}\n')).toBe(true);
  expect(json).toContain('\n  "format"');
});

test('golden sha256', async () => {
  const hashes = {
    json: await sha256Hex(toDungeonJson(dungeon, { ...OPTS, cells: 'base64' })),
    txt: await sha256Hex(toAsciiText(dungeon)),
    bin: await sha256Hex(toRaw(dungeon)),
  };
  for (const [k, v] of Object.entries(hashes)) expect(checkGolden(k, v), k).toBe(v);
});

test('dungeon.schema.json is generated from the model', () => {
  const file = JSON.parse(readFileSync(new URL('../dungeon.schema.json', import.meta.url), 'utf8'));
  expect(file).toEqual(JSON.parse(JSON.stringify(DungeonFileSchema)));
});
