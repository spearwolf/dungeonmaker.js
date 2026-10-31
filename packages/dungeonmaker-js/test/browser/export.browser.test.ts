// SPDX-License-Identifier: GPL-3.0-or-later
import { createDungeon } from 'dungeonmaker-js';
import { toPng, toTilesetPng } from 'dungeonmaker-js/export';
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
