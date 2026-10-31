// SPDX-License-Identifier: GPL-3.0-or-later

/** The default worker. Keep the `new Worker(new URL(…))` pattern verbatim: bundlers detect exactly this. */
export function spawnDefaultWorker(): Worker {
  return new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
}
