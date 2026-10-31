// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { DESIGN_SCHEMA_ID, DesignConfigSchema, validateDesign } from '../src/schema.js';
import { BROKEN_DESIGNS } from './fixtures/broken-designs.js';
import { DESIGNS, vendorConfig } from './helpers.js';

test.each(DESIGNS)('%s is valid', (name) => expect(validateDesign(vendorConfig(name))).toEqual([]));

test('$schema is allowed at the root', () => {
  expect(validateDesign({ ...vendorConfig('design'), $schema: DESIGN_SCHEMA_ID })).toEqual([]);
});

test.each(BROKEN_DESIGNS)('$name is rejected', (broken) => {
  const d = structuredClone(vendorConfig('design5'));
  broken.mutate(d);
  const issues = validateDesign(d);
  expect(issues.length).toBeGreaterThan(0);
  if (broken.path !== undefined) expect(issues.map((i) => i.path)).toContain(broken.path);
});

test('missing object and non-objects', () => {
  const { rooms: _, ...noRooms } = vendorConfig('design');
  expect(validateDesign(noRooms)).toEqual([
    { path: '/rooms', message: 'missing required property' },
  ]);
  expect(validateDesign('design')[0]?.path).toBe('');
});

test('unknown property is reported at its own path', () => {
  const d = structuredClone(vendorConfig('design')) as unknown as { map: Record<string, unknown> };
  d.map.widht = 5;
  expect(validateDesign(d)).toEqual([{ path: '/map/widht', message: 'unknown property' }]);
});

test('one issue per path', () => {
  const d = structuredClone(vendorConfig('design')) as unknown as { map: { background: string } };
  d.map.background = 'lava';
  expect(validateDesign(d).filter((i) => i.path === '/map/background')).toHaveLength(1);
});

test('design.schema.json is generated from the model', () => {
  const file = JSON.parse(readFileSync(new URL('../design.schema.json', import.meta.url), 'utf8'));
  expect(file).toEqual(JSON.parse(JSON.stringify(DesignConfigSchema)));
});
