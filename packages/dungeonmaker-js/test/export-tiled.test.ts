// SPDX-License-Identifier: GPL-3.0-or-later
import { Cell } from '../src/cell.js';
import { toDesignText } from '../src/config/serialize.js';
import { loadCore } from '../src/core.js';
import { toTiledMap } from '../src/export/tiled.js';
import { design3A } from '../src/presets.js';
import { checkGolden, sha256Hex } from './golden-export.js';

const OPTS = { generator: 'dungeonmaker-js@test' };
const d = {
  width: 3,
  height: 2,
  seed: 42,
  cells: Uint8Array.of(
    Cell.Open,
    Cell.Closed,
    Cell.Column,
    Cell.HorizontalDoor,
    Cell.Mob1,
    Cell.Treasure3,
  ),
};
const layered = {
  ...d,
  rooms: {
    roomIds: Uint16Array.of(0, 0, 0, 1, 1, 0),
    rooms: [
      { id: 1, area: 'dungeon', size: 2, bounds: { x: 0, y: 1, width: 2, height: 1 } },
    ] as const,
  },
  entities: [
    { kind: 'mob', x: 1, y: 1, level: 2 },
    { kind: 'treasure', x: 0, y: 1, level: 0 },
  ] as const,
};

test('plain map has the required fields and the cells layer', () => {
  const map = JSON.parse(toTiledMap(d, OPTS));
  expect(map).toMatchObject({
    type: 'map',
    version: '1.10',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: 3,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    nextlayerid: 2,
    nextobjectid: 1,
  });
  expect(map.layers).toHaveLength(1);
  expect(map.layers[0]).toMatchObject({ type: 'tilelayer', name: 'cells' });
  expect(map.layers[0].data).toEqual([...d.cells].map((c) => c + 1));
  expect(map.tilesets[0]).toMatchObject({
    firstgid: 1,
    tilecount: 20,
    columns: 20,
    image: 'dungeonmaker-tiles.png',
    imagewidth: 320,
    imageheight: 16,
  });
  expect(map.tilesets[0].tiles[19].type).toBe('column');
  expect(map.properties).toEqual([
    { name: 'generator', type: 'string', value: 'dungeonmaker-js@test' },
    { name: 'seed', type: 'int', value: 42 },
  ]);
});

test('rooms and entities become object layers in pixels', () => {
  const text = toTiledMap(layered, { ...OPTS, tileWidth: 8, tileHeight: 10 });
  expect(text.endsWith('}\n')).toBe(true);
  const map = JSON.parse(text);
  expect(map.layers.map((l: { name: string }) => l.name)).toEqual(['cells', 'rooms', 'entities']);
  expect(map.nextlayerid).toBe(4);
  expect(map.nextobjectid).toBe(4);
  const [room] = map.layers[1].objects;
  expect(room).toMatchObject({ id: 1, x: 0, y: 10, width: 16, height: 10 });
  expect(room.properties).toEqual([
    { name: 'area', type: 'string', value: 'dungeon' },
    { name: 'size', type: 'int', value: 2 },
  ]);
  const [mob] = map.layers[2].objects;
  expect(mob).toMatchObject({ id: 2, point: true, x: 12, y: 15 });
  expect(mob.properties).toEqual([
    { name: 'kind', type: 'string', value: 'mob' },
    { name: 'level', type: 'int', value: 2 },
  ]);
});

test('golden hashes for design3A at seed 42', async () => {
  const core = await loadCore();
  const text = toDesignText(design3A);
  const full = core.generate(text, 42, { rooms: true, entities: 'list' });
  const plain = core.generate(text, 42);
  const tmj = await sha256Hex(toTiledMap(full, OPTS));
  const tmjPlain = await sha256Hex(toTiledMap(plain, OPTS));
  expect(tmj).toBe(checkGolden('tmj', tmj));
  expect(tmjPlain).toBe(checkGolden('tmj-plain', tmjPlain));
});
