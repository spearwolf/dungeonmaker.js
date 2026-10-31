// SPDX-License-Identifier: GPL-3.0-or-later
// Main entry `dungeonmaker-js`: design config API and worker client (no TypeBox runtime, no Wasm).
export { Cell } from './cell.js';
export type {
  AbortSignalLike,
  CallOptions,
  DungeonMaker,
  DungeonMakerOptions,
  DungeonRequest,
  WorkerEventType,
  WorkerLike,
} from './client/client.js';
export { createDungeonMaker } from './client/client.js';
export { createDungeon } from './client/default.js';
export { type DesignPatch, extendDesign } from './config/extend.js';
export { parseDesignText } from './config/parse.js';
export { toDesignText } from './config/serialize.js';
export type { CardinalDirection, CellName, Direction } from './config/tokens.js';
export type { Dungeon } from './dungeon.js';
export {
  type DesignIssue,
  DesignValidationError,
  GenerationError,
  TimeoutError,
  WorkerError,
} from './errors.js';
export type {
  Entity,
  EntityLayer,
  OutputOptions,
  Room,
  RoomLayer,
  StepLayer,
} from './layers.js';
export type {
  CrawlerPairMember,
  CrawlerSeed,
  DesignConfig,
  Genes,
  Point,
  Population,
  Rectangle,
  RoomSizeProbability,
  TunnelerGenes,
  TunnelerSeed,
} from './schema/model.js';
