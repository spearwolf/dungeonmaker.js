// SPDX-License-Identifier: GPL-3.0-or-later
import { extendDesign } from 'dungeonmaker-js';
import * as presets from 'dungeonmaker-js/presets';
import { DESIGN_SCHEMA_ID as SCHEMA_ENTRY_ID } from 'dungeonmaker-js/schema';
import {
  DESIGN_FILE,
  DESIGN_SCHEMA_ID,
  designFileText,
  PRESET_NAMES,
  resolveSource,
} from '../src/source';

test('the local schema id equals the one of the schema entry', () => {
  expect(DESIGN_SCHEMA_ID).toBe(SCHEMA_ENTRY_ID);
});

test('a preset resolves like `generate --preset`', async () => {
  const r = await resolveSource({ kind: 'preset', preset: 'design3A' });
  expect(r).toMatchObject({
    name: 'design3A',
    source: { preset: 'design3A' },
    cliArgs: ['--preset', 'design3A'],
  });
});

test('an editor design equal to a preset keeps the file name but names the preset', async () => {
  const r = await resolveSource({ kind: 'design', design: structuredClone(presets.design5) });
  expect(r).toMatchObject({
    name: 'design',
    source: { preset: 'design5' },
    cliArgs: ['--design', './design.json'],
  });
});

test('any other design is referenced by hash only, never embedded', async () => {
  const design = extendDesign(presets.designEmpty, { map: { width: 60, height: 40 } });
  const r = await resolveSource({ kind: 'design', design });
  expect(r.source).toEqual({ designHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) });
  expect(r.name).toBe('design');
  expect(r.design).toBe(design);
});

test('the design file carries $schema and ends with a newline', () => {
  const text = designFileText(presets.designEmpty);
  expect(JSON.parse(text)).toEqual({ $schema: DESIGN_SCHEMA_ID, ...presets.designEmpty });
  expect(text.endsWith('}\n')).toBe(true);
  expect(DESIGN_FILE).toBe('design.json');
});

test('PRESET_NAMES lists every preset', () => {
  expect([...PRESET_NAMES].sort()).toEqual(Object.keys(presets).sort());
  expect(PRESET_NAMES).toHaveLength(11);
});
