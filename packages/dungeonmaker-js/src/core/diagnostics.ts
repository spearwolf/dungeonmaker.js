// SPDX-License-Identifier: GPL-3.0-or-later

export interface Diagnostics {
  push(line: string): void;
  /** Returns the collected lines and starts over. */
  take(): string[];
}

/**
 * Collects library output (the C++ code writes warnings to stdout). Lines beyond
 * `limit` are only counted, so a chatty design cannot fill the heap.
 */
export function createDiagnostics(limit = 200): Diagnostics {
  let lines: string[] = [];
  let suppressed = 0;
  return {
    push(line) {
      if (lines.length < limit) lines.push(line);
      else suppressed++;
    },
    take() {
      const out = suppressed > 0 ? [...lines, `… ${suppressed} more lines suppressed`] : lines;
      lines = [];
      suppressed = 0;
      return out;
    },
  };
}
