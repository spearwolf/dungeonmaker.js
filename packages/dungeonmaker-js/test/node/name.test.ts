// SPDX-License-Identifier: GPL-3.0-or-later
import { renderName } from '../../src/node/name.js';

test('fills {name} and {seed}', () => {
  expect(renderName('{name}-{seed}', { name: 'cave', seed: 7 })).toBe('cave-7');
  expect(renderName('plain', { name: 'cave', seed: 7 })).toBe('plain');
});

test.each(['../x-{seed}', 'a/b-{seed}', 'a\\b', '{nope}', '', '{name}..{seed}'])(
  'rejects %j',
  (template) => {
    expect(() => renderName(template, { name: 'cave', seed: 7 })).toThrow(RangeError);
  },
);
