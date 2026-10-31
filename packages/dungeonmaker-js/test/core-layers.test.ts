// SPDX-License-Identifier: GPL-3.0-or-later

import { extendDesign } from '../src/config/extend.js';
import { toDesignText } from '../src/config/serialize.js';
import { Cell, DesignValidationError, type DungeonMakerCore, loadCore } from '../src/core.js';
import { design3A } from '../src/presets.js';
import {
  caught,
  DESIGNS,
  fnv1a32,
  golden,
  readDesign,
  replaySteps,
  withDimensions,
} from './helpers.js';

let core: DungeonMakerCore;
beforeAll(async () => {
  core = await loadCore();
});

const asBytes = (a: Int32Array) => new Uint8Array(a.buffer);

function gen(d: string, output: Parameters<DungeonMakerCore['generate']>[2], seed = 42) {
  return core.generate(readDesign(d), seed, output);
}

describe.each(DESIGNS)('golden layer hashes: %s', (d) => {
  test('rooms', () => {
    const { rooms } = gen(d, { rooms: true });
    const table = new Int32Array(
      (rooms?.rooms ?? []).flatMap((r) => [
        r.area === 'dungeon' ? 1 : 0,
        r.size,
        r.bounds.x,
        r.bounds.y,
        r.bounds.x + r.bounds.width - 1,
        r.bounds.y + r.bounds.height - 1,
      ]),
    );
    const bytes = new Uint8Array([
      ...new Uint8Array(rooms?.roomIds.buffer as ArrayBuffer),
      ...asBytes(table),
    ]);
    expect(fnv1a32(bytes)).toBe(golden[`${d}:42+rooms`]);
  });

  test('entities list', () => {
    const { entities } = gen(d, { entities: 'list' });
    const table = new Int32Array(
      (entities ?? []).flatMap((e) => [e.kind === 'treasure' ? 1 : 0, e.x, e.y, e.level]),
    );
    expect(fnv1a32(asBytes(table))).toBe(golden[`${d}:42+entities`]);
  });

  test('entities baked', () => {
    const r = gen(d, { entities: 'baked' });
    expect(r.entities).toBeUndefined();
    expect(fnv1a32(r.cells)).toBe(golden[`${d}:42+baked`]);
  });

  test('steps', () => {
    const { steps } = gen(d, { steps: true });
    const bytes = new Uint8Array([
      ...new Uint8Array(steps?.offsets.buffer as ArrayBuffer),
      ...new Uint8Array(steps?.index.buffer as ArrayBuffer),
      ...(steps?.cell ?? []),
    ]);
    expect(fnv1a32(bytes)).toBe(golden[`${d}:42+steps`]);
  });

  test('layers other than baked entities leave the cells alone', () => {
    const plain = golden[`${d}:42`];
    for (const output of [
      { rooms: true },
      { entities: 'list' as const },
      { steps: true },
      { rooms: true, entities: 'list' as const, steps: true },
    ]) {
      expect(fnv1a32(gen(d, output).cells)).toBe(plain);
    }
  });

  test('baked differs from list exactly at the entity positions', () => {
    const list = gen(d, { entities: 'list' });
    const baked = gen(d, { entities: 'baked' });
    const expected = list.cells.slice();
    for (const e of list.entities ?? []) {
      const base = e.kind === 'mob' ? Cell.Mob1 : Cell.Treasure1;
      expected[e.y * list.width + e.x] = base + (e.level < 2 ? 0 : e.level < 4 ? 1 : 2);
    }
    expect(baked.cells).toEqual(expected);
  });

  test('rooms are consistent', () => {
    const r = gen(d, { rooms: true });
    const { roomIds, rooms } = r.rooms ?? { roomIds: new Uint16Array(), rooms: [] };
    expect(roomIds.length).toBe(r.width * r.height);
    rooms.forEach((room, i) => {
      expect(room.id).toBe(i + 1);
    });
    const counts = new Map<number, number>();
    roomIds.forEach((id, i) => {
      if (id === 0) return;
      expect(id).toBeLessThanOrEqual(rooms.length);
      const b = rooms[id - 1]?.bounds;
      const x = i % r.width;
      const y = Math.floor(i / r.width);
      if (!b || x < b.x || x >= b.x + b.width || y < b.y || y >= b.y + b.height) {
        throw new Error(`cell ${x},${y} with id ${id} is outside its room bounds`);
      }
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    for (const [id, n] of counts) expect(n).toBeLessThanOrEqual(rooms[id - 1]?.size ?? 0);
  });

  test('steps replay to the cells', () => {
    for (const output of [{ steps: true }, { steps: true, entities: 'baked' as const }]) {
      const r = gen(d, output);
      const steps = r.steps;
      if (!steps) throw new Error('no steps');
      expect(steps.offsets[0]).toBe(0);
      expect(steps.offsets[1]).toBe(r.width * r.height);
      for (let k = 1; k < steps.offsets.length; k++) {
        expect(steps.offsets[k]).toBeGreaterThanOrEqual(steps.offsets[k - 1] ?? 0);
      }
      expect(steps.offsets.at(-1)).toBe(steps.index.length);
      expect(steps.index.length).toBe(steps.cell.length);
      expect(replaySteps(steps, r.width * r.height)).toEqual(r.cells);
    }
  });
});

test('entities sit on plausible cells and some preset has both kinds', () => {
  let found = false;
  for (const d of DESIGNS) {
    const plain = gen(d, undefined);
    const { entities = [] } = gen(d, { entities: 'list' });
    for (const e of entities) {
      const c = plain.cells[e.y * plain.width + e.x];
      if (e.kind === 'treasure') expect(c).toBe(Cell.InsideRoomOpen);
      else {
        expect([
          Cell.Open,
          Cell.InsideRoomOpen,
          Cell.InsideTunnelOpen,
          Cell.InsideAnteroomOpen,
        ]).toContain(c);
      }
    }
    if (entities.some((e) => e.kind === 'mob') && entities.some((e) => e.kind === 'treasure')) {
      found = true;
    }
  }
  expect(found).toBe(true);
});

describe('designs without a population', () => {
  function zeroByLevel(node: unknown): void {
    if (typeof node !== 'object' || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'byLevel' && Array.isArray(value)) value.fill(0);
      else zeroByLevel(value);
    }
  }

  test('population removed or all zeros: no entities, same cells', () => {
    const { population: _dropped, ...withoutPopulation } = design3A;
    const zeros = extendDesign(design3A, {});
    zeroByLevel(zeros.population);
    for (const design of [withoutPopulation, zeros]) {
      const text = toDesignText(design);
      const r = core.generate(text, 42, { entities: 'list' });
      expect(r.entities).toEqual([]);
      expect(r.cells).toEqual(core.generate(text, 42).cells);
    }
  });
});

test('steps on a 1024x1024 map: frame 0 is the whole map and replay gives the cells', () => {
  const r = core.generate(withDimensions(readDesign('design'), 1024, 1024), 42, { steps: true });
  expect([r.width, r.height]).toEqual([1024, 1024]);
  expect(r.steps?.offsets[1]).toBe(1024 * 1024);
  expect(replaySteps(r.steps as NonNullable<typeof r.steps>, 1024 * 1024)).toEqual(r.cells);
}, 60_000);

describe('errors', () => {
  test('an invalid output option is a TypeError', () => {
    expect(() => core.generate(readDesign('design'), 42, { entities: 'nope' } as never)).toThrow(
      TypeError,
    );
  });

  test('entities on a map below 4x4 are rejected', () => {
    const e = caught(() =>
      core.generate(withDimensions(readDesign('design'), 3, 50), 42, { entities: 'list' }),
    );
    expect(e).toBeInstanceOf(DesignValidationError);
    expect((e as Error).message).toMatch(/entities need a map of at least 4x4/);
  });

  test('steps without showMovie and storeMovie are rejected', () => {
    const text = readDesign('design').replace(/^N\s+.*$/m, 'N 0 0 0');
    const e = caught(() => core.generate(text, 42, { steps: true }));
    expect(e).toBeInstanceOf(DesignValidationError);
  });
});
