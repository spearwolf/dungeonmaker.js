// SPDX-License-Identifier: GPL-3.0-or-later
import { toDesignText } from 'dungeonmaker-js';
import { loadCore } from 'dungeonmaker-js/core';
import * as presets from 'dungeonmaker-js/presets';
import { beforeAll } from 'vitest';
import { fnv1a32 } from '../src/fnv';
import { createStepPlayer } from '../src/player';

let d: Awaited<ReturnType<typeof make>>;

async function make() {
  const core = await loadCore();
  return core.generate(toDesignText(presets.design3A), 42, { steps: true });
}

beforeAll(async () => {
  d = await make();
});

function player() {
  if (!d.steps) throw new Error('steps missing');
  return { p: createStepPlayer(d.steps, d.width * d.height), steps: d.steps };
}

test('seeking to the last frame yields the final cells', () => {
  const { p, steps } = player();
  expect(p.frames).toBe(steps.offsets.length - 1);
  expect(fnv1a32(p.seek(p.frames - 1))).toBe(fnv1a32(d.cells));
});

test('seeking backwards replays from the start map', () => {
  const { p } = player();
  const mid = p.seek(Math.floor(p.frames / 2)).slice();
  p.seek(p.frames - 1);
  expect(p.seek(Math.floor(p.frames / 2))).toEqual(mid);
});

test('out-of-range frames are clamped', () => {
  const { p } = player();
  const first = p.seek(0).slice();
  expect(p.seek(-1)).toEqual(first);
  const last = p.seek(p.frames - 1).slice();
  expect(p.seek(p.frames + 5)).toEqual(last);
});

test('fnv1a32 matches the golden hash of design3A seed 42', async () => {
  const core = await loadCore();
  const plain = core.generate(toDesignText(presets.design3A), 42);
  expect(fnv1a32(plain.cells)).toBe('99cc67de');
});
