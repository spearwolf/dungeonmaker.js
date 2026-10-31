// SPDX-License-Identifier: GPL-3.0-or-later

import Value from 'typebox/value';
import type { CellName } from '../src/config/tokens.js';
import {
  type CrawlerPairMember,
  type CrawlerSeed,
  DESIGN_SCHEMA_ID,
  type DesignConfig,
  DesignConfigSchema,
  PointSchema,
  type Rectangle,
  RoomSizeProbabilitySchema,
} from '../src/schema/model.js';

test('enum types stay literal unions', () => {
  expectTypeOf<DesignConfig['map']['background']>().toEqualTypeOf<'open' | 'closed'>();
  expectTypeOf<CrawlerSeed['direction']>().toEqualTypeOf<'N' | 'E' | 'S' | 'W'>();
  expectTypeOf<Rectangle['cell']>().toEqualTypeOf<CellName>();
});

test('open is required on crawler seeds and absent from pair members', () => {
  expectTypeOf<CrawlerSeed['open']>().toEqualTypeOf<boolean>();
  expectTypeOf<Required<CrawlerSeed>>().toEqualTypeOf<CrawlerSeed>();
  expectTypeOf<CrawlerPairMember>().not.toHaveProperty('open');
});

test('schema metadata', () => {
  expect(DesignConfigSchema.$id).toBe(DESIGN_SCHEMA_ID);
  expect(DesignConfigSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
});

test('objects reject unknown properties', () => {
  expect(Value.Check(PointSchema, { x: 1, y: 2 })).toBe(true);
  expect(Value.Check(PointSchema, { x: 1, y: 2, z: 3 })).toBe(false);
  expect(Value.Check(PointSchema, { x: -1, y: 0 })).toBe(false);
});

test('room size probabilities cap large below the GS/GB terminator', () => {
  expect(Value.Check(RoomSizeProbabilitySchema, { small: 0, medium: 1, large: 99 })).toBe(true);
  expect(Value.Check(RoomSizeProbabilitySchema, { small: 0, medium: 0, large: 100 })).toBe(false);
});

test('every property is documented', () => {
  const missing: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (typeof node !== 'object' || node === null) return;
    const s = node as Record<string, unknown>;
    const props = s.properties as Record<string, Record<string, unknown>> | undefined;
    if (props) {
      for (const [key, child] of Object.entries(props)) {
        const d = child.description;
        if (typeof d !== 'string' || d.trim() === '') missing.push(`${path}/${key}`);
        walk(child, `${path}/${key}`);
      }
    }
    walk(s.items, `${path}/*`);
    if (Array.isArray(s.anyOf)) for (const [i, alt] of s.anyOf.entries()) walk(alt, `${path}|${i}`);
  };
  walk(DesignConfigSchema, '');
  expect(missing).toEqual([]);
});
