// SPDX-License-Identifier: GPL-3.0-or-later
import { DesignValidationError, type DungeonMakerCore, loadCore } from '../src/core.js';
import { dropRecord, fnv1a32, golden, readDesign } from './helpers.js';

let core: DungeonMakerCore;
beforeAll(async () => {
  core = await loadCore();
});

// Every Config field must have a defined value, otherwise the result depends on whatever
// the previous call left in linear memory.
test.each(['T', 'M', 'N', 'PR', 'PT', 'PU', 'U', 'K', 'F', 'GS', 'GB'])(
  'design2 without its %s record matches native and stays stable across calls',
  (tag) => {
    const text = dropRecord(readDesign('design2'), tag);
    const first = fnv1a32(core.generate(text, 42).cells);
    core.generate(readDesign('design5'), 7);
    const second = fnv1a32(core.generate(text, 42).cells);
    expect(first).toBe(golden[`design2[-${tag}]:42`]);
    expect(second).toBe(first);
  },
);

const design = readDesign('design');
test.each([
  ['non-numeric value', `${design}\nT  abc 25 70 250 0 0 0 40 20 2\n`],
  ['non-numeric dimension', `XX x\nD abc 50 CLOSED 12 18 NO\nXX\n${design}`],
  ['overflowing dimension', `XX x\nD 99999999999 50 CLOSED 12 18 NO\nXX\n${design}`],
  ['non-numeric rectangle', `${design}\nR 1 1 5 x CLOSED\n`],
  ['unterminated S list', `${design}\nS 5 3`],
  ['unterminated J list', `${design}\nJ 5 3`],
  ['unterminated GS list', `${design}\nGS 50 50 0`],
  ['unknown cell type', `${design}\nR 2 2 6 6 FOO\n`],
  ['unknown direction', `XX x\nD 50 50 CLOSED 12 18 WEE\nXX\n${design}`],
  ['D record in the middle of a line', 'S 3 0 D 50 50 CLOSED 12 18 NO'],
  ['comments only', 'XX nothing\nXX but comments\n'],
])('rejects %s without hanging', { timeout: 5_000 }, (_name, text) => {
  expect(() => core.generate(text, 1)).toThrow(DesignValidationError);
  expect(core.aborted).toBe(false);
});
