// SPDX-License-Identifier: GPL-3.0-or-later
import {
  createDungeon,
  createDungeonMaker,
  GenerationError,
  TimeoutError,
  toDesignText,
  WorkerError,
} from 'dungeonmaker-js';
import { design, design3A } from 'dungeonmaker-js/presets';
import { fnv1a32 } from '../fnv.js';
import golden from '../golden/native-fnv.json' with { type: 'json' };

const silentWorker = () =>
  new Worker(new URL('./silent-worker.js', import.meta.url), { type: 'module' });

test('createDungeon generates the golden dungeon and transfers exactly the cells', async () => {
  const d = await createDungeon({ design: design3A, seed: 42 });
  expect(fnv1a32(d.cells)).toBe(golden['design3A:42']);
  expect(d.cells.buffer.byteLength).toBe(d.width * d.height);
});

test('parallel calls each resolve with their golden hash', async () => {
  const seeds = [1, 2, 3, 42, 4294967295] as const;
  const all = await Promise.all(seeds.map((seed) => createDungeon({ design: design3A, seed })));
  expect(all.map((d) => fnv1a32(d.cells))).toEqual(seeds.map((s) => golden[`design3A:${s}`]));
});

test('crash recovery: an assert abort, then the next request works', async () => {
  const dm = createDungeonMaker();
  // same assert case as in core-errors.test.ts, appended to the vendor text of `design`
  const broken = `${toDesignText(design)}\nWS 500 500 WE SW 0 15 2 4 1 7 0 20 0 60 10\n`;
  await expect(dm.create({ design: broken, seed: 1 })).rejects.toBeInstanceOf(GenerationError);
  expect(fnv1a32((await dm.create({ design: design3A, seed: 42 })).cells)).toBe(
    golden['design3A:42'],
  );
  dm.dispose();
});

test('timeout against a worker that never answers', async () => {
  const dm = createDungeonMaker({ worker: silentWorker, timeout: 200 });
  await expect(dm.create({ design: design3A, seed: 1 })).rejects.toBeInstanceOf(TimeoutError);
  dm.dispose();
});

test('abort while running', async () => {
  const dm = createDungeonMaker({ worker: silentWorker });
  const controller = new AbortController();
  const pending = dm.create({ design: design3A, seed: 1 }, { signal: controller.signal });
  setTimeout(() => controller.abort(), 50);
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  dm.dispose();
});

test('a wrong wasmUrl is a WorkerError, a fresh client works afterwards', async () => {
  const dm = createDungeonMaker({ wasmUrl: '/does-not-exist.wasm' });
  await expect(dm.create({ design: design3A, seed: 1 })).rejects.toBeInstanceOf(WorkerError);
  dm.dispose();
  const fresh = createDungeonMaker();
  await expect(fresh.create({ design: design3A, seed: 1 })).resolves.toBeTruthy();
  fresh.dispose();
});

test('dispose rejects a pending request with AbortError', async () => {
  const dm = createDungeonMaker({ worker: silentWorker });
  const pending = dm.create({ design: design3A, seed: 1 });
  dm.dispose();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
