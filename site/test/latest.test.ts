// SPDX-License-Identifier: GPL-3.0-or-later
import { takeLatest } from '../src/latest';

test('only the most recent call resolves as fresh', async () => {
  const resolvers: ((v: number) => void)[] = [];
  const run = takeLatest(
    (n: number) =>
      new Promise<number>((r) => {
        resolvers.push(() => r(n));
      }),
  );
  const first = run(1);
  const second = run(2);
  resolvers[1]?.(2);
  resolvers[0]?.(1);
  expect(await second).toEqual({ stale: false, value: 2 });
  expect(await first).toEqual({ stale: true });
});

test('a rejection of a superseded call is swallowed as stale; of the latest it propagates', async () => {
  const rejecters: ((e: Error) => void)[] = [];
  const run = takeLatest(
    () =>
      new Promise<number>((_, rej) => {
        rejecters.push(rej);
      }),
  );
  const first = run();
  const second = run();
  rejecters[0]?.(new Error('old'));
  rejecters[1]?.(new Error('new'));
  expect(await first).toEqual({ stale: true });
  await expect(second).rejects.toThrow('new');
});

test('a call that finishes before a newer one starts is fresh', async () => {
  const run = takeLatest(async (n: number) => n * 2);
  expect(await run(1)).toEqual({ stale: false, value: 2 });
  expect(await run(2)).toEqual({ stale: false, value: 4 });
});
