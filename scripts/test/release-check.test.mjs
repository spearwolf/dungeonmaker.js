// SPDX-License-Identifier: GPL-3.0-or-later
import { decideRelease } from '../release-check.mjs';

test.each([
  [
    { version: '0.0.1', published: [] },
    { publish: true, distTag: 'latest' },
  ],
  [
    { version: '0.0.1', published: ['0.0.1'] },
    { publish: false, distTag: 'latest' },
  ],
  [
    { version: '0.0.2', published: ['0.0.1'] },
    { publish: true, distTag: 'latest' },
  ],
  [
    { version: '1.2.0-beta.1', published: ['1.1.0'] },
    { publish: true, distTag: 'next' },
  ],
])('decideRelease(%o)', (input, expected) => {
  expect(decideRelease(input)).toEqual(expected);
});

test('downgrade fails', () => {
  expect(() => decideRelease({ version: '0.0.1', published: ['0.0.2'] })).toThrow(/downgrade/);
});

test('invalid version fails', () => {
  expect(() => decideRelease({ version: 'abc', published: [] })).toThrow(/not a valid semver/);
});
