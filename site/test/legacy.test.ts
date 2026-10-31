// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import * as presets from 'dungeonmaker-js/presets';
import { DESIGN_SCHEMA_ID } from 'dungeonmaker-js/schema';
import { importLegacy } from '../src/legacy';

const text = readFileSync(
  new URL('../../native/vendor/dungeonmaker-2.05/design3A', import.meta.url),
  'utf8',
);

test('legacy text becomes the design JSON of the preset', () => {
  const r = importLegacy(text);
  expect('json' in r && JSON.parse(r.json)).toEqual({
    $schema: DESIGN_SCHEMA_ID,
    ...presets.design3A,
  });
});

test('BOM and CRLF give the same JSON as LF', () => {
  expect(importLegacy(`﻿${text.replace(/\n/g, '\r\n')}`)).toEqual(importLegacy(text));
});

test('text the parser rejects returns an error message', () => {
  expect(importLegacy('not a design')).toEqual({ error: expect.any(String) });
});
