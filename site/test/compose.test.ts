// SPDX-License-Identifier: GPL-3.0-or-later
import { Cell, toDesignText } from 'dungeonmaker-js';
import { loadCore } from 'dungeonmaker-js/core';
import * as presets from 'dungeonmaker-js/presets';
import { toRgba } from 'dungeonmaker-js/render';
import { beforeAll } from 'vitest';
import { composeRgba, MOB_RGB, roomColor, TREASURE_RGB } from '../src/compose';

let d: Awaited<ReturnType<typeof make>>;

async function make() {
  const core = await loadCore();
  return core.generate(toDesignText(presets.design3A), 42, { rooms: true, entities: 'list' });
}

beforeAll(async () => {
  d = await make();
});

const px = (data: Uint8ClampedArray, i: number) => [...data.slice(i * 4, i * 4 + 4)];

test('without layers the raster is exactly toRgba', () => {
  expect(composeRgba(d, { rooms: false, entities: false }).data).toEqual(toRgba(d).data);
});

test('rooms tint room cells and leave every other pixel alone', () => {
  const base = toRgba(d).data;
  const tinted = composeRgba(d, { rooms: true, entities: false }).data;
  const room = d.rooms?.roomIds.findIndex((id) => id > 0) ?? -1;
  const none = d.rooms?.roomIds.indexOf(0) ?? -1;
  expect(room).toBeGreaterThanOrEqual(0);
  expect(none).toBeGreaterThanOrEqual(0);
  expect(px(tinted, room)).not.toEqual(px(base, room));
  expect(px(tinted, none)).toEqual(px(base, none));
});

test('entities are painted in their kind colour', () => {
  const entities = d.entities ?? [];
  const mob = entities.find((e) => e.kind === 'mob');
  const treasure = entities.find((e) => e.kind === 'treasure');
  expect(mob).toBeDefined();
  expect(treasure).toBeDefined();
  const data = composeRgba(d, { rooms: false, entities: true }).data;
  if (mob) expect(px(data, mob.y * d.width + mob.x)).toEqual([...MOB_RGB, 255]);
  if (treasure) expect(px(data, treasure.y * d.width + treasure.x)).toEqual([...TREASURE_RGB, 255]);
});

test('entities are not painted when switched off', () => {
  const mob = (d.entities ?? []).find((e) => e.kind === 'mob');
  const data = composeRgba(d, { rooms: false, entities: false }).data;
  if (mob) expect(px(data, mob.y * d.width + mob.x)).not.toEqual([...MOB_RGB, 255]);
});

test('a frame override paints the given cells', () => {
  const cells = new Uint8Array(d.width * d.height).fill(Cell.Closed);
  const raster = composeRgba(d, { rooms: false, entities: false, cells });
  expect(raster.data).toEqual(toRgba({ width: d.width, height: d.height, cells }).data);
});

test('consecutive room ids get distinct colours', () => {
  expect(new Set([1, 2, 3, 4, 5].map((id) => roomColor(id).join())).size).toBe(5);
});
