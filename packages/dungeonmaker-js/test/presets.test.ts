// SPDX-License-Identifier: GPL-3.0-or-later
import { toDesignText } from '../src/config/serialize.js';
import { loadCore } from '../src/core.js';
import * as presetModule from '../src/presets.js';
import type { DesignConfig } from '../src/schema/model.js';
import { validateDesign } from '../src/schema/validate.js';
import { DESIGNS, fnv1a32, golden, vendorConfig } from './helpers.js';

const presets: Record<string, DesignConfig> = { ...presetModule };

test('one preset per vendor design', () => {
  expect(Object.keys(presets).sort()).toEqual([...DESIGNS].sort());
});

test.each(DESIGNS)('%s matches its vendor file', (name) => {
  expect(presets[name]).toEqual(vendorConfig(name));
});

test.each(DESIGNS)('%s is schema-valid', (name) => {
  expect(validateDesign(presets[name])).toEqual([]);
});

test('design3A generates the golden dungeon', async () => {
  const core = await loadCore();
  expect(fnv1a32(core.generate(toDesignText(presetModule.design3A), 42).cells)).toBe(
    golden['design3A:42'],
  );
});
