// SPDX-License-Identifier: GPL-3.0-or-later

export type Latest<R> = { stale: false; value: R } | { stale: true };

/**
 * Wraps an async function so that only the most recent call counts: a call that has been
 * superseded by a newer one resolves as `{ stale: true }`, whether it fulfils or rejects.
 * The latest call passes its value or its rejection through.
 */
export function takeLatest<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<Latest<R>> {
  let latest = 0;
  return async (...args: A): Promise<Latest<R>> => {
    const mine = ++latest;
    try {
      const value = await fn(...args);
      return mine === latest ? { stale: false, value } : { stale: true };
    } catch (error) {
      if (mine !== latest) return { stale: true };
      throw error;
    }
  };
}
