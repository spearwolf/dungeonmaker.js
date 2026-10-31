// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Entry point `dungeonmaker-js/presets`: the eleven sample designs of DungeonMaker 2.05
 * as `DesignConfig` objects.
 *
 * The presets are plain objects shared by every importer and they are not frozen: a
 * change to one would silently change it for all other users in the same program.
 * Never mutate them; derive a variant with `extendDesign(preset, patch)`, which returns
 * a fresh copy.
 *
 * @module
 */
export { design } from './presets/design.js';
export { design2 } from './presets/design2.js';
export { design3A } from './presets/design3A.js';
export { design3WithTunnelers } from './presets/design3WithTunnelers.js';
export { design4A } from './presets/design4A.js';
export { design5 } from './presets/design5.js';
export { design6 } from './presets/design6.js';
export { design7 } from './presets/design7.js';
export { designEmpty } from './presets/designEmpty.js';
export { designEmpty2 } from './presets/designEmpty2.js';
export { designOld1 } from './presets/designOld1.js';
