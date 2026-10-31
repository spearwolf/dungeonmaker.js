// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Entry point `dungeonmaker-js/schema`: the TypeBox model of a design and `validateDesign`.
 *
 * @module dungeonmaker-js/schema
 */
export type { DesignConfig } from './schema/model.js';
export { DESIGN_SCHEMA_ID, DesignConfigSchema } from './schema/model.js';
export { validateDesign } from './schema/validate.js';
