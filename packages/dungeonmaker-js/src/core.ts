// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Entry point `dungeonmaker-js/core`: the WebAssembly generator in the current thread.
 *
 * @module dungeonmaker-js/core
 */
export { Cell } from './cell.js';
export {
  type CompiledWasm,
  type CoreResult,
  type DungeonMakerCore,
  type LoadCoreOptions,
  loadCore,
} from './core/core.js';
export { type DesignIssue, DesignValidationError, GenerationError } from './errors.js';
export type {
  Entity,
  EntityLayer,
  OutputOptions,
  Room,
  RoomLayer,
  StepLayer,
} from './layers.js';
