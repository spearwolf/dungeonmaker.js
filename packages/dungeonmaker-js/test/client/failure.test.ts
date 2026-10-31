// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createDungeonMaker } from '../../src/client/client.js';
import { GenerationError, TimeoutError, WorkerError } from '../../src/errors.js';
import { autoWorker, type FakeWorker, fakeFactory, resultFor } from './fake-worker.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Tracks whether a promise has settled, without leaving its rejection unhandled. */
function track<T>(promise: Promise<T>): { settled: boolean } {
  const state = { settled: false };
  promise.then(
    () => {
      state.settled = true;
    },
    () => {
      state.settled = true;
    },
  );
  return state;
}

const createFor = (w: FakeWorker | undefined, seed: number) =>
  w?.posted.find((m) => m.type === 'create' && m.seed === seed);

test('a running request times out: TimeoutError, worker terminated, next request on a new worker', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const p = dm.create({ design: 'D', seed: 1 });
  const q = dm.create({ design: 'D', seed: 2 });
  // Attach the rejection handler before the timer fires, so the rejection is never unhandled.
  const timedOut = expect(p).rejects.toBeInstanceOf(TimeoutError);
  await vi.advanceTimersByTimeAsync(1000);
  await timedOut;
  expect(workers[0]?.terminated).toBe(true);
  expect(workers[1]?.posted.find((m) => m.type === 'create')).toMatchObject({ seed: 2 });
  workers[1]?.reply(resultFor(workers[1], 2));
  await expect(q).resolves.toMatchObject({ seed: 2 });
});

test('the timeout counts from dispatch, not from enqueueing', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const p = dm.create({ design: 'D', seed: 1 });
  const q = dm.create({ design: 'D', seed: 2 });
  const qState = track(q);
  const w = workers[0] as FakeWorker;
  await vi.advanceTimersByTimeAsync(900);
  w.reply(resultFor(w, 1));
  await expect(p).resolves.toMatchObject({ seed: 1 });
  expect(createFor(w, 2)).toBeDefined();
  await vi.advanceTimersByTimeAsync(999);
  expect(qState.settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await expect(q).rejects.toBeInstanceOf(TimeoutError);
  expect(w.terminated).toBe(true);
});

test('a per-call timeout overrides the instance default', async () => {
  const { factory } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const p = dm.create({ design: 'D', seed: 1 }, { timeout: 5000 });
  const pState = track(p);
  await vi.advanceTimersByTimeAsync(4999);
  expect(pState.settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(TimeoutError);
  expect((e as TimeoutError).timeout).toBe(5000);
});

test('timeout Infinity sets no timer', async () => {
  const dm = createDungeonMaker({
    worker: fakeFactory().factory,
    timeout: Number.POSITIVE_INFINITY,
  });
  void dm.create({ design: 'D', seed: 1 });
  expect(vi.getTimerCount()).toBe(0);
});

test.each([0, -5, Number.NaN, 2 ** 31])('timeout %d is a RangeError', async (timeout) => {
  expect(() => createDungeonMaker({ timeout })).toThrow(RangeError);
  await expect(
    createDungeonMaker({ worker: fakeFactory().factory }).create(
      { design: 'D', seed: 1 },
      { timeout },
    ),
  ).rejects.toThrow(RangeError);
});

test('aborting a queued request removes it and leaves the running worker alone', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const p = dm.create({ design: 'D', seed: 1 });
  const controller = new AbortController();
  const reason = new Error('changed my mind');
  const q = dm.create({ design: 'D', seed: 2 }, { signal: controller.signal });
  controller.abort(reason);
  await expect(q).rejects.toBe(reason);
  const w = workers[0] as FakeWorker;
  expect(w.terminated).toBe(false);
  w.reply(resultFor(w, 1));
  await expect(p).resolves.toMatchObject({ seed: 1 });
  expect(createFor(w, 2)).toBeUndefined();
  expect(workers).toHaveLength(1);
});

test('aborting the running request terminates the worker; the next request respawns', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const controller = new AbortController();
  const reason = new Error('stop');
  const p = dm.create({ design: 'D', seed: 1 }, { signal: controller.signal });
  const q = dm.create({ design: 'D', seed: 2 });
  controller.abort(reason);
  await expect(p).rejects.toBe(reason);
  expect(workers[0]?.terminated).toBe(true);
  expect(createFor(workers[1], 2)).toBeDefined();
  workers[1]?.reply(resultFor(workers[1], 2));
  await expect(q).resolves.toMatchObject({ seed: 2 });
});

test('an already aborted signal rejects with its reason and spawns nothing', async () => {
  const { factory, workers } = fakeFactory();
  const reason = new Error('mine');
  await expect(
    createDungeonMaker({ worker: factory }).create(
      { design: 'D', seed: 1 },
      { signal: AbortSignal.abort(reason) },
    ),
  ).rejects.toBe(reason);
  expect(workers).toHaveLength(0);
});

test('abort() without a reason rejects with a DOMException AbortError', async () => {
  const { factory } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const controller = new AbortController();
  const p = dm.create({ design: 'D', seed: 1 }, { signal: controller.signal });
  controller.abort();
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(DOMException);
  expect((e as DOMException).name).toBe('AbortError');
});

test('a reused signal is released after settling: a later abort changes nothing', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const controller = new AbortController();
  const dm = createDungeonMaker({ worker: factory });
  await dm.create({ design: 'D', seed: 1 }, { signal: controller.signal });
  controller.abort();
  await expect(dm.create({ design: 'D', seed: 2 })).resolves.toMatchObject({ seed: 2 });
  expect(workers).toHaveLength(1);
  expect(workers[0]?.terminated).toBe(false);
});

test('messages from a terminated worker are ignored', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const p = dm.create({ design: 'D', seed: 1 });
  const q = dm.create({ design: 'D', seed: 2 });
  const qState = track(q);
  const timedOut = expect(p).rejects.toBeInstanceOf(TimeoutError);
  await vi.advanceTimersByTimeAsync(1000);
  await timedOut;
  const old = workers[0] as FakeWorker;
  const fresh = workers[1] as FakeWorker;
  expect(() => {
    old.reply(resultFor(old, 1));
    // Even a result carrying q's id must not settle q when it comes from the old worker.
    old.reply(resultFor(fresh, 2));
    old.reply({ type: 'ready', v: 2 });
    old.crash('late crash');
    old.messageError();
  }).not.toThrow();
  await vi.advanceTimersByTimeAsync(0);
  expect(qState.settled).toBe(false);
  expect(fresh.terminated).toBe(false);
  fresh.reply(resultFor(fresh, 2));
  await expect(q).resolves.toMatchObject({ seed: 2 });
});

test('a worker error event rejects running and queued requests with WorkerError, no respawn storm', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const all = Array.from({ length: 5 }, (_, i) => dm.create({ design: 'D', seed: i + 1 }));
  workers[0]?.crash('Failed to fetch dungeonmaker.wasm');
  for (const p of all) await expect(p).rejects.toBeInstanceOf(WorkerError);
  expect(workers).toHaveLength(1);
  void dm.create({ design: 'D', seed: 9 });
  expect(workers).toHaveLength(2);
});

test('a worker error event carries the event message and terminates the worker', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const p = dm.create({ design: 'D', seed: 1 });
  workers[0]?.crash('Failed to fetch dungeonmaker.wasm');
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(WorkerError);
  expect((e as WorkerError).message).toMatch(/Failed to fetch dungeonmaker\.wasm/);
  expect((e as WorkerError).cause).toBe('Failed to fetch dungeonmaker.wasm');
  expect(workers[0]?.terminated).toBe(true);
});

test('init failure (error with id null) behaves like a worker error', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const ready = dm.ready();
  const p = dm.create({ design: 'D', seed: 1 });
  const q = dm.create({ design: 'D', seed: 2 });
  workers[0]?.reply({
    type: 'error',
    v: 1,
    id: null,
    error: { name: 'Error', message: 'HTTP 404' },
  });
  for (const x of [ready, p, q]) {
    const e = await x.catch((y: unknown) => y);
    expect(e).toBeInstanceOf(WorkerError);
    expect((e as WorkerError).message).toMatch(/HTTP 404/);
    expect((e as WorkerError).cause).toBeInstanceOf(Error);
    expect(((e as WorkerError).cause as Error).message).toBe('HTTP 404');
  }
  expect(workers[0]?.terminated).toBe(true);
  expect(workers).toHaveLength(1);
  void dm.create({ design: 'D', seed: 3 });
  expect(workers).toHaveLength(2);
  expect(createFor(workers[1], 3)).toBeDefined();
});

test('messageerror rejects with WorkerError', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const p = dm.create({ design: 'D', seed: 1 });
  const q = dm.create({ design: 'D', seed: 2 });
  workers[0]?.messageError();
  await expect(p).rejects.toBeInstanceOf(WorkerError);
  await expect(q).rejects.toBeInstanceOf(WorkerError);
  expect(workers[0]?.terminated).toBe(true);
  expect(workers).toHaveLength(1);
});

test('a protocol mismatch from the worker is a WorkerError', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const ready = dm.ready();
  const p = dm.create({ design: 'D', seed: 1 });
  workers[0]?.reply({ type: 'ready', v: 2 });
  await expect(ready).rejects.toBeInstanceOf(WorkerError);
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(WorkerError);
  expect((e as WorkerError).message).toMatch(/protocol version 2/);
  expect(workers[0]?.terminated).toBe(true);
});

test('a throwing worker factory rejects with WorkerError carrying the cause', async () => {
  const cause = new Error('Worker is not defined');
  let calls = 0;
  const dm = createDungeonMaker({
    worker: () => {
      calls++;
      throw cause;
    },
  });
  const e = await dm.create({ design: 'D', seed: 1 }).catch((x: unknown) => x);
  expect(e).toBeInstanceOf(WorkerError);
  expect((e as WorkerError).cause).toBe(cause);
  await expect(dm.ready()).rejects.toBeInstanceOf(WorkerError);
  expect(calls).toBe(2);
});

test('no timers or listeners are left after settling', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const controller = new AbortController();
  const removed = vi.spyOn(controller.signal, 'removeEventListener');

  const ok = dm.create({ design: 'D', seed: 1 }, { signal: controller.signal });
  expect(vi.getTimerCount()).toBe(1);
  const w = workers[0] as FakeWorker;
  w.reply(resultFor(w, 1));
  await ok;
  expect(vi.getTimerCount()).toBe(0);
  expect(removed).toHaveBeenCalledTimes(1);

  const failed = dm.create({ design: 'D', seed: 2 }, { signal: controller.signal });
  expect(vi.getTimerCount()).toBe(1);
  w.reply({ type: 'error', v: 1, id: 2, error: { name: 'GenerationError', message: 'boom' } });
  await expect(failed).rejects.toBeInstanceOf(GenerationError);
  expect(vi.getTimerCount()).toBe(0);
  expect(removed).toHaveBeenCalledTimes(2);
});

test('one shared controller aborting several jobs spawns one worker and terminates it once', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const controller = new AbortController();
  const reason = new Error('component unmounted');
  const all = Array.from({ length: 4 }, (_, i) =>
    dm.create({ design: 'D', seed: i + 1 }, { signal: controller.signal }),
  );
  const w = workers[0] as FakeWorker;
  const terminate = vi.spyOn(w, 'terminate');
  controller.abort(reason);
  for (const p of all) await expect(p).rejects.toBe(reason);
  expect(workers).toHaveLength(1);
  expect(terminate).toHaveBeenCalledTimes(1);
  expect(w.posted.filter((m) => m.type === 'create')).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('ready() rejects with TimeoutError when init gets no answer, and keeps the worker', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const ready = dm.ready();
  const readyState = track(ready);
  const timedOut = expect(ready).rejects.toBeInstanceOf(TimeoutError);
  await vi.advanceTimersByTimeAsync(999);
  expect(readyState.settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await timedOut;
  expect(vi.getTimerCount()).toBe(0);
  expect(workers[0]?.terminated).toBe(false);
});

test('ready() resolving clears its timer', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const ready = dm.ready();
  expect(vi.getTimerCount()).toBe(1);
  workers[0]?.reply({ type: 'ready', v: 1 });
  await ready;
  expect(vi.getTimerCount()).toBe(0);
});

test('a pending ready() rejects with WorkerError when another request times out the worker', async () => {
  const { factory } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const p = dm.create({ design: 'D', seed: 1 }, { timeout: 500 });
  const ready = dm.ready();
  const pResult = p.catch((x: unknown) => x);
  const readyResult = ready.catch((x: unknown) => x);
  await vi.advanceTimersByTimeAsync(500);
  const pe = await pResult;
  expect(pe).toBeInstanceOf(TimeoutError);
  const re = await readyResult;
  expect(re).toBeInstanceOf(WorkerError);
  expect((re as WorkerError).cause).toBe(pe);
  expect(vi.getTimerCount()).toBe(0);
});

test('a pending ready() rejects with WorkerError when a running request is aborted', async () => {
  const { factory } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: Number.POSITIVE_INFINITY });
  const controller = new AbortController();
  const reason = new Error('stop');
  const p = dm.create({ design: 'D', seed: 1 }, { signal: controller.signal });
  const ready = dm.ready();
  controller.abort(reason);
  await expect(p).rejects.toBe(reason);
  const e = await ready.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(WorkerError);
  expect((e as WorkerError).cause).toBe(reason);
});
