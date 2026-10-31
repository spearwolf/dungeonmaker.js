// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from 'vitest';
import { createDungeonMaker } from '../../src/client/client.js';
import { DesignValidationError, GenerationError, WorkerError } from '../../src/errors.js';
import type { DesignConfig } from '../../src/schema/model.js';
import { autoWorker, type FakeWorker, fakeFactory, resultFor } from './fake-worker.js';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const createCount = (w: FakeWorker | undefined) =>
  w?.posted.filter((m) => m.type === 'create').length;

test('spawns lazily: nothing before the first call, then init followed by create', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory });
  expect(workers).toHaveLength(0);
  await dm.create({ design: 'D', seed: 9 });
  expect(workers[0]?.posted.map((m) => m.type)).toEqual(['init', 'create']);
  expect(workers[0]?.posted[1]).toMatchObject({ v: 1, id: 1, design: 'D', seed: 9 });
});

test('passes wasmUrl to init', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory, wasmUrl: new URL('https://x.test/a.wasm') });
  await dm.ready();
  expect(workers[0]?.posted[0]).toEqual({ type: 'init', v: 1, wasmUrl: 'https://x.test/a.wasm' });
});

test('resolves a frozen Dungeon from the result', async () => {
  const { factory } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory });
  const dungeon = await dm.create({ design: 'D', seed: 5 });
  expect(dungeon).toMatchObject({ width: 4, height: 3, seed: 5, diagnostics: [] });
  expect(dungeon.cells).toHaveLength(12);
  expect(Object.isFrozen(dungeon)).toBe(true);
  expect(dungeon.get(3, 2)).toBe(0);
  expect(() => dungeon.get(4, 0)).toThrow(RangeError);
});

test('runs one request at a time, in FIFO order', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const order: number[] = [];
  const p1 = dm.create({ design: 'A', seed: 1 }).then(() => order.push(1));
  const p2 = dm.create({ design: 'B', seed: 2 }).then(() => order.push(2));
  const p3 = dm.create({ design: 'C', seed: 3 }).then(() => order.push(3));
  const w = workers[0] as FakeWorker;
  expect(createCount(w)).toBe(1);
  expect(w.posted[1]).toMatchObject({ id: 1 });
  w.reply(resultFor(w, 1));
  await flush();
  expect(createCount(w)).toBe(2);
  expect(w.posted[2]).toMatchObject({ id: 2 });
  w.reply(resultFor(w, 2));
  await flush();
  expect(createCount(w)).toBe(3);
  w.reply(resultFor(w, 3));
  await Promise.all([p1, p2, p3]);
  expect(order).toEqual([1, 2, 3]);
});

test('a missing seed is drawn by the client and returned in the result', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory });
  const dungeon = await dm.create({ design: 'D' });
  const sent = workers[0]?.posted[1];
  expect(sent?.type === 'create' && sent.seed).toBeGreaterThanOrEqual(1);
  expect(dungeon.seed).toBe(sent?.type === 'create' ? sent.seed : -1);
});

test.each([0, 1.5, 2 ** 32])(
  'seed %d rejects with RangeError before anything is spawned',
  async (seed) => {
    const { factory, workers } = fakeFactory(autoWorker);
    await expect(
      createDungeonMaker({ worker: factory }).create({ design: 'D', seed }),
    ).rejects.toThrow(RangeError);
    expect(workers).toHaveLength(0);
  },
);

test('worker errors arrive as typed errors', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const p1 = dm.create({ design: 'D', seed: 1 });
  const w = workers[0] as FakeWorker;
  w.reply({
    type: 'error',
    v: 1,
    id: 1,
    error: {
      name: 'DesignValidationError',
      message: 'm',
      issues: [{ path: '/a', message: 'm' }],
    },
  });
  const e1 = await p1.catch((e: unknown) => e);
  expect(e1).toBeInstanceOf(DesignValidationError);
  expect((e1 as DesignValidationError).issues).toEqual([{ path: '/a', message: 'm' }]);

  const p2 = dm.create({ design: 'D', seed: 2 });
  w.reply({
    type: 'error',
    v: 1,
    id: 2,
    error: { name: 'GenerationError', message: 'boom', diagnostics: ['d'] },
  });
  const e2 = await p2.catch((e: unknown) => e);
  expect(e2).toBeInstanceOf(GenerationError);
  expect((e2 as GenerationError).diagnostics).toEqual(['d']);
});

test('a malformed worker message rejects the running job instead of hanging', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const p = dm.create({ design: 'D', seed: 1 });
  (workers[0] as FakeWorker).reply({
    type: 'error',
    v: 1,
    id: 1,
    error: { name: 'DesignValidationError', message: 'm', issues: 'nope' },
  });
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(WorkerError);
  expect((e as WorkerError).cause).toBeDefined();
});

test('a design that cannot be cloned rejects and the queue continues', async () => {
  const { factory } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory });
  const bad = dm.create({ design: { map: () => 1 } as unknown as DesignConfig, seed: 1 });
  const good = dm.create({ design: 'D', seed: 2 });
  await expect(bad).rejects.toMatchObject({ name: 'DataCloneError' });
  await expect(good).resolves.toMatchObject({ seed: 2 });
});

test('ready() resolves once the worker reported ready and spawns only once', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory });
  await dm.ready();
  await dm.ready();
  await dm.create({ design: 'D', seed: 1 });
  expect(workers).toHaveLength(1);
  expect(workers[0]?.posted.filter((m) => m.type === 'init')).toHaveLength(1);
});

test('ready() rejects with WorkerError when init fails', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const ready = dm.ready();
  workers[0]?.reply({
    type: 'error',
    v: 1,
    id: null,
    error: { name: 'Error', message: 'HTTP 404' },
  });
  await expect(ready).rejects.toBeInstanceOf(WorkerError);
  await expect(ready).rejects.toThrow(/HTTP 404/);
});

test('without a worker factory, create() and ready() reject with WorkerError', async () => {
  const dm = createDungeonMaker();
  await expect(dm.create({ design: 'D', seed: 1 })).rejects.toThrow(WorkerError);
  await expect(dm.ready()).rejects.toThrow(WorkerError);
});

test('dispose() rejects running and queued requests with AbortError and terminates', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const running = dm.create({ design: 'A', seed: 1 });
  const queued = dm.create({ design: 'B', seed: 2 });
  dm.dispose();
  await expect(running).rejects.toMatchObject({ name: 'AbortError' });
  await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
  expect(workers[0]?.terminated).toBe(true);
});

test('create() after dispose() rejects, dispose() twice is harmless', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory });
  dm.dispose();
  dm.dispose();
  await expect(dm.create({ design: 'D', seed: 1 })).rejects.toMatchObject({ name: 'AbortError' });
  await expect(dm.ready()).rejects.toMatchObject({ name: 'AbortError' });
  expect(workers).toHaveLength(0);
});
