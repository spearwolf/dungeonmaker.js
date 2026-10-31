// SPDX-License-Identifier: GPL-3.0-or-later
import { extendDesign } from 'dungeonmaker-js';
import * as presets from 'dungeonmaker-js/presets';
import { lintDesign } from '../src/design-lint';
import { designFileText } from '../src/source';

test('a preset lints clean and yields the design', () => {
  const r = lintDesign(designFileText(presets.design3A));
  expect(r.issues).toEqual([]);
  expect(r.design?.map.width).toBe(160);
});

test('the yielded design is the preset without the $schema key', () => {
  expect(lintDesign(designFileText(presets.design3A)).design).toEqual(presets.design3A);
});

test('schema errors point at the offending value', () => {
  const text = designFileText(presets.designEmpty).replace('"width": 80', '"width": "x"');
  const [issue] = lintDesign(text).issues;
  expect(issue?.path).toBe('/map/width');
  expect(text.slice(issue?.from, issue?.to)).toBe('"x"');
});

test('a missing property is reported at its parent object', () => {
  const text = designFileText(presets.designEmpty).replace('"width": 80,', '');
  const [issue] = lintDesign(text).issues;
  expect(issue?.path).toBe('/map/width');
  expect(text.slice(issue?.from, issue?.to)).toMatch(/^\{[\s\S]*"height": 80[\s\S]*\}$/);
});

test('semantic errors from toDesignText are reported too', () => {
  const design = extendDesign(presets.design3A, { map: { width: 10, height: 10 } });
  const r = lintDesign(designFileText(design));
  expect(r.design).toBeUndefined();
  expect(r.issues.length).toBeGreaterThan(0);
});

test('broken JSON is one issue over the whole text', () => {
  expect(lintDesign('{"map": ').issues).toEqual([
    expect.objectContaining({ path: '', from: 0, to: 8 }),
  ]);
});

test('JSON that is no object is reported, not thrown', () => {
  const r = lintDesign('[1, 2]');
  expect(r.design).toBeUndefined();
  expect(r.issues.length).toBeGreaterThan(0);
});
