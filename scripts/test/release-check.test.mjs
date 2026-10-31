// SPDX-License-Identifier: GPL-3.0-or-later
import { decideRelease } from '../release-check.mjs';

const base = { tagExists: false, publishedGitHead: undefined, headSha: 'abc123' };

test.each([
  [
    'first release',
    { version: '0.0.1', published: [] },
    { publish: true, tag: true, distTag: 'latest' },
  ],
  [
    'next patch',
    { version: '0.0.2', published: ['0.0.1'] },
    { publish: true, tag: true, distTag: 'latest' },
  ],
  [
    'prerelease',
    { version: '1.2.0-beta.1', published: ['1.1.0'] },
    { publish: true, tag: true, distTag: 'next' },
  ],
  [
    'published and tagged',
    { version: '0.0.1', published: ['0.0.1'], tagExists: true },
    { publish: false, tag: false, distTag: 'latest' },
  ],
  [
    'published from this commit, tag missing',
    { version: '0.0.1', published: ['0.0.1'], publishedGitHead: 'abc123' },
    { publish: false, tag: true, distTag: 'latest' },
  ],
  [
    'published from another commit, tag missing',
    { version: '0.0.1', published: ['0.0.1'], publishedGitHead: 'fff999' },
    { publish: false, tag: false, distTag: 'latest' },
  ],
  [
    'published without gitHead, tag missing',
    { version: '0.0.1', published: ['0.0.1'] },
    { publish: false, tag: false, distTag: 'latest' },
  ],
])('%s', (_name, input, expected) => {
  expect(decideRelease({ ...base, ...input })).toEqual(expected);
});

test('downgrade fails', () => {
  expect(() => decideRelease({ ...base, version: '0.0.1', published: ['0.0.2'] })).toThrow(
    /downgrade/,
  );
});

test('invalid version fails', () => {
  expect(() => decideRelease({ ...base, version: 'abc', published: [] })).toThrow(
    /not a valid semver/,
  );
});

test('a tag for an unpublished version is an inconsistency', () => {
  expect(() =>
    decideRelease({ ...base, version: '0.0.2', published: ['0.0.1'], tagExists: true }),
  ).toThrow(/tag v0\.0\.2 already exists/);
});
