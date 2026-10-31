// SPDX-License-Identifier: GPL-3.0-or-later
import { beforeEach, expect, test, vi } from 'vitest';
import { extendDesign } from '../src/config/extend.js';
import { loadCore } from '../src/core/core.js';
import { design3A } from '../src/presets.js';
import type { FromWorker } from '../src/protocol.js';
import { createWorkerHandler } from '../src/worker/handler.js';
import { fnv1a32, golden, readDesign } from './helpers.js';

type Result = Extract<FromWorker, { type: 'result' }>;
type ErrorMessage = Extract<FromWorker, { type: 'error' }>;

let messages: FromWorker[];
let transfers: Transferable[][];
const post = (message: FromWorker, transfer: Transferable[]) => {
  messages.push(message);
  transfers.push(transfer);
};
const loadSpy = vi.fn(loadCore);
let handle: (data: unknown) => Promise<void>;

beforeEach(() => {
  messages = [];
  transfers = [];
  loadSpy.mockClear();
  handle = createWorkerHandler({ post, loadCore: loadSpy });
});

test('init loads the core and answers ready', async () => {
  await handle({ type: 'init', v: 1 });
  expect(messages).toEqual([{ type: 'ready', v: 1 }]);
});

test('a second init answers ready without loading again', async () => {
  await handle({ type: 'init', v: 1 });
  await handle({ type: 'init', v: 1 });
  expect(messages).toEqual([
    { type: 'ready', v: 1 },
    { type: 'ready', v: 1 },
  ]);
  expect(loadSpy).toHaveBeenCalledTimes(1);
});

test('create with a preset generates the golden dungeon and transfers exactly the cells', async () => {
  await handle({ type: 'init', v: 1 });
  await handle({ type: 'create', v: 1, id: 1, design: design3A, seed: 42 });
  const r = messages.at(-1) as Result;
  expect(r).toMatchObject({ type: 'result', id: 1, seed: 42 });
  expect(fnv1a32(r.cells)).toBe(golden['design3A:42']);
  expect(r.cells.buffer.byteLength).toBe(r.width * r.height);
  expect(transfers.at(-1)).toEqual([r.cells.buffer]);
});

test('legacy design text is generated unchanged', async () => {
  await handle({ type: 'init', v: 1 });
  await handle({ type: 'create', v: 1, id: 1, design: readDesign('design'), seed: 42 });
  const r = messages.at(-1) as Result;
  expect(r.type).toBe('result');
  expect(fnv1a32(r.cells)).toBe(golden['design:42']);
});

test('an invalid config is a DesignValidationError with JSON pointers', async () => {
  await handle({ type: 'init', v: 1 });
  const design = extendDesign(design3A, { map: { width: 2 } });
  await handle({ type: 'create', v: 1, id: 1, design, seed: 42 });
  const e = messages.at(-1) as ErrorMessage;
  expect(e).toMatchObject({ type: 'error', id: 1 });
  expect(e.error.name).toBe('DesignValidationError');
  expect(e.error.issues?.[0]?.path.startsWith('/')).toBe(true);
});

test('an invalid seed is a RangeError', async () => {
  await handle({ type: 'init', v: 1 });
  await handle({ type: 'create', v: 1, id: 1, design: design3A, seed: 0 });
  const e = messages.at(-1) as ErrorMessage;
  expect(e.id).toBe(1);
  expect(e.error.name).toBe('RangeError');
});

test('an assert abort is a GenerationError and the next request runs on a fresh instance', async () => {
  const broken = `${readDesign('design')}\nWS   500    500    WE   SW     0     15      2    4   1    7   0     20    0     60    10\n`;
  await handle({ type: 'init', v: 1 });
  await handle({ type: 'create', v: 1, id: 1, design: broken, seed: 1 });
  const e = messages.at(-1) as ErrorMessage;
  expect(e.error.name).toBe('GenerationError');
  expect(loadSpy).toHaveBeenCalledTimes(2);
  expect(loadSpy.mock.calls[1]?.[0]).toHaveProperty('wasmModule');

  await handle({ type: 'create', v: 1, id: 2, design: readDesign('design'), seed: 42 });
  const r = messages.at(-1) as Result;
  expect(r).toMatchObject({ type: 'result', id: 2 });
  expect(fnv1a32(r.cells)).toBe(golden['design:42']);
});

test('a failed init is reported with id null', async () => {
  const failing = createWorkerHandler({
    post,
    loadCore: () => Promise.reject(new Error('HTTP 404')),
  });
  await failing({ type: 'init', v: 1 });
  expect(messages).toEqual([
    { type: 'error', v: 1, id: null, error: { name: 'Error', message: 'HTTP 404' } },
  ]);
});

test('a message with another protocol version is answered with an error naming it', async () => {
  await handle({ type: 'create', v: 2, id: 5, design: design3A, seed: 42 });
  const e = messages.at(-1) as ErrorMessage;
  expect(e).toMatchObject({ type: 'error', id: 5 });
  expect(e.error.message).toMatch(/protocol/);
});

test('an unparsable message without a usable id is answered with id null', async () => {
  await handle('nonsense');
  expect(messages.at(-1)).toMatchObject({ type: 'error', id: null });
});

test('create before init is an error, not a hang', async () => {
  await handle({ type: 'create', v: 1, id: 3, design: design3A, seed: 42 });
  const e = messages.at(-1) as ErrorMessage;
  expect(e).toMatchObject({ type: 'error', id: 3 });
  expect(e.error.message).toMatch(/init/);
});

test('messages are handled in arrival order', async () => {
  await handle({ type: 'init', v: 1 });
  const pending = [1, 2, 3].map((id) =>
    handle({ type: 'create', v: 1, id, design: design3A, seed: id }),
  );
  await Promise.all(pending);
  expect(messages.slice(1).map((m) => (m as Result).id)).toEqual([1, 2, 3]);
});

test('wasmUrl from init reaches loadCore', async () => {
  const spy = vi.fn(loadCore);
  const h = createWorkerHandler({ post, loadCore: spy });
  const wasmUrl = new URL('../wasm/dungeonmaker.wasm', import.meta.url).href;
  await h({ type: 'init', v: 1, wasmUrl });
  expect(spy).toHaveBeenCalledWith({ wasmUrl });
});
