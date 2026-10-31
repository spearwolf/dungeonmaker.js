// SPDX-License-Identifier: GPL-3.0-or-later
import type { Dungeon } from '../dungeon.js';
import {
  type CallOptions,
  createDungeonMaker,
  type DungeonMaker,
  type DungeonRequest,
} from './client.js';

let shared: DungeonMaker | undefined;

/** Generates a dungeon on a lazily created, shared default client (one worker for the page). */
export function createDungeon(request: DungeonRequest, opts?: CallOptions): Promise<Dungeon> {
  shared ??= createDungeonMaker();
  return shared.create(request, opts);
}
