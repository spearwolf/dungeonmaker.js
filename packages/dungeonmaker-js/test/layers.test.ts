// SPDX-License-Identifier: GPL-3.0-or-later
import { outputFlags, parseOutput } from '../src/layers.js';

test('outputFlags maps the options to the native flag bits', () => {
  expect(outputFlags(undefined)).toBe(0);
  expect(outputFlags({})).toBe(0);
  expect(outputFlags({ rooms: true, entities: 'list', steps: true })).toBe(1 | 2 | 8);
  expect(outputFlags({ entities: 'baked' })).toBe(4);
  expect(outputFlags({ rooms: false, entities: false, steps: false })).toBe(0);
});

test('parseOutput accepts valid options and undefined', () => {
  expect(parseOutput(undefined)).toBeUndefined();
  expect(parseOutput({ entities: false })).toEqual({ entities: false });
  expect(parseOutput({ rooms: true, entities: 'baked', steps: false })).toEqual({
    rooms: true,
    entities: 'baked',
    steps: false,
  });
});

test('parseOutput rejects unknown keys and wrong values, naming the key', () => {
  expect(() => parseOutput({ room: true })).toThrow(TypeError);
  expect(() => parseOutput({ room: true })).toThrow(/room/);
  expect(() => parseOutput({ entities: 'yes' })).toThrow(/entities/);
  expect(() => parseOutput({ rooms: 1 })).toThrow(/rooms/);
  expect(() => parseOutput({ steps: 'true' })).toThrow(/steps/);
  expect(() => parseOutput('rooms')).toThrow(TypeError);
  expect(() => parseOutput(null)).toThrow(TypeError);
  expect(() => parseOutput([])).toThrow(TypeError);
});
