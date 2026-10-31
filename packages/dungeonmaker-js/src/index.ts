// SPDX-License-Identifier: GPL-3.0-or-later
// Main entry `dungeonmaker-js`: design config API (no TypeBox runtime, no Wasm).
export { Cell } from './cell.js';
export { type DesignPatch, extendDesign } from './config/extend.js';
export { parseDesignText } from './config/parse.js';
export { toDesignText } from './config/serialize.js';
export type { CardinalDirection, CellName, Direction } from './config/tokens.js';
export { type DesignIssue, DesignValidationError, GenerationError } from './errors.js';
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
