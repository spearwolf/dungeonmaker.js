// SPDX-License-Identifier: GPL-3.0-or-later
import { createDungeon } from 'dungeonmaker-js';
import { toDungeonJson, toPng, toTiledMap, toTilesetPng } from 'dungeonmaker-js/export';
import { design3A } from 'dungeonmaker-js/presets';
import golden from '../golden/export-sha256.json' with { type: 'json' };

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

test('toPng and toTilesetPng are byte-identical to the Node golden hashes', async () => {
  const dungeon = await createDungeon({ design: design3A, seed: 42 });
  const png = await toPng(dungeon, { generator: 'dungeonmaker-js@test' });
  expect(await sha256Hex(png)).toBe(golden.png);
  expect(await sha256Hex(await toTilesetPng())).toBe(golden.tileset);
}, 30_000);

test('toTiledMap of a plain dungeon is byte-identical to the Node golden hash', async () => {
  const dungeon = await createDungeon({ design: design3A, seed: 42 });
  const tmj = toTiledMap(dungeon, { generator: 'dungeonmaker-js@test' });
  expect(await sha256Hex(new TextEncoder().encode(tmj))).toBe(golden['tmj-plain']);
}, 30_000);

test('toDungeonJson of a layered dungeon is byte-identical to the Node golden hash', async () => {
  const dungeon = await createDungeon({
    design: design3A,
    seed: 42,
    output: { rooms: true, entities: 'list', steps: true },
  });
  const json = toDungeonJson(dungeon, {
    source: { preset: 'design3A' },
    generator: 'dungeonmaker-js@test',
  });
  expect(await sha256Hex(new TextEncoder().encode(json))).toBe(golden.json);
}, 30_000);
