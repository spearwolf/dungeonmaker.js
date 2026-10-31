// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { createDungeonMaker } from '../../src/client/client.js';
import { createDungeon } from '../../src/client/default.js';
import { spawnDefaultWorker } from '../../src/client/spawn.js';
import { DesignValidationError, GenerationError } from '../../src/errors.js';
import * as entry from '../../src/index.js';
import { design3A } from '../../src/presets.js';
import { fnv1a32, golden, readDesign, SEEDS } from '../helpers.js';
import { autoWorker, fakeFactory } from './fake-worker.js';
import { inProcessWorker } from './in-process-worker.js';

vi.mock('../../src/client/spawn.js', () => ({
  spawnDefaultWorker: vi.fn(() => inProcessWorker()),
}));

afterEach(() => vi.unstubAllGlobals());

test('createDungeon generates the golden design3A dungeon on one shared worker', async () => {
  const a = await createDungeon({ design: design3A, seed: 42 });
  const b = await createDungeon({ design: design3A, seed: 1 });
  expect(fnv1a32(a.cells)).toBe(golden['design3A:42']);
  expect(fnv1a32(b.cells)).toBe(golden['design3A:1']);
  expect(a.cells.buffer.byteLength).toBe(a.width * a.height);
  expect(spawnDefaultWorker).toHaveBeenCalledTimes(1);
});

test('parallel calls all resolve with their own golden hashes', async () => {
  const dungeons = await Promise.all(
    SEEDS.map((seed) => createDungeon({ design: design3A, seed })),
  );
  dungeons.forEach((d, i) => {
    expect(fnv1a32(d.cells)).toBe(golden[`design3A:${SEEDS[i]}`]);
  });
});

test('a GenerationError is followed by a working request on the same client', async () => {
  const broken = `${readDesign('design')}\nWS   500    500    WE   SW     0     15      2    4   1    7   0     20    0     60    10\n`;
  const dm = createDungeonMaker({ worker: inProcessWorker });
  const error = await dm.create({ design: broken, seed: 1 }).catch((x) => x);
  expect(error).toBeInstanceOf(GenerationError);
  const ok = await dm.create({ design: design3A, seed: 42 });
  expect(fnv1a32(ok.cells)).toBe(golden['design3A:42']);
  dm.dispose();
});

test('validate: true rejects a broken config on the main thread without sending it', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory, validate: true });
  const e = await dm
    .create({ design: { ...design3A, map: { ...design3A.map, width: 'x' } } as never, seed: 1 })
    .catch((x) => x);
  expect(e).toBeInstanceOf(DesignValidationError);
  expect(e.issues[0].path).toBe('/map/width');
  expect(workers.flatMap((w) => w.posted).some((m) => m.type === 'create')).toBe(false);
});

test('validate: true lets a valid config through', async () => {
  const dm = createDungeonMaker({ worker: inProcessWorker, validate: true });
  const d = await dm.create({ design: design3A, seed: 42 });
  expect(fnv1a32(d.cells)).toBe(golden['design3A:42']);
  dm.dispose();
});

test('validate: true leaves legacy text alone', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory, validate: true });
  await dm.create({ design: 'not a valid design at all', seed: 1 });
  const create = workers.flatMap((w) => w.posted).find((m) => m.type === 'create');
  expect(create).toMatchObject({ design: 'not a valid design at all' });
});

test('a relative wasmUrl string is resolved against the page', async () => {
  vi.stubGlobal('location', { href: 'https://example.test/app/page.html' });
  const { factory, workers } = fakeFactory(autoWorker);
  await createDungeonMaker({ worker: factory, wasmUrl: 'assets/dm.wasm' }).ready();
  expect(workers[0]?.posted[0]).toMatchObject({
    type: 'init',
    wasmUrl: 'https://example.test/app/assets/dm.wasm',
  });
});

test('a URL object is sent as href, without location the string as is', async () => {
  vi.stubGlobal('location', { href: 'https://example.test/app/page.html' });
  const a = fakeFactory(autoWorker);
  await createDungeonMaker({
    worker: a.factory,
    wasmUrl: new URL('https://x.test/a.wasm'),
  }).ready();
  expect(a.workers[0]?.posted[0]).toMatchObject({ wasmUrl: 'https://x.test/a.wasm' });

  vi.stubGlobal('location', undefined);
  const b = fakeFactory(autoWorker);
  await createDungeonMaker({ worker: b.factory, wasmUrl: 'assets/dm.wasm' }).ready();
  expect(b.workers[0]?.posted[0]).toMatchObject({ wasmUrl: 'assets/dm.wasm' });
});

test('the main entry exports the client API', () => {
  expect(entry.createDungeon).toBe(createDungeon);
  expect(entry.createDungeonMaker).toBe(createDungeonMaker);
  expect(entry.TimeoutError).toBeTypeOf('function');
  expect(entry.WorkerError).toBeTypeOf('function');
});

test('package.json: ./worker export and worker as the only side effect', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    exports: Record<string, { default: string }>;
    sideEffects: string[];
  };
  expect(pkg.exports['./worker']?.default).toBe('./dist/worker.js');
  expect(pkg.sideEffects).toEqual(['./dist/worker.js']);
});
