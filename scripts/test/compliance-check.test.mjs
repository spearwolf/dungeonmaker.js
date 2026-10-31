// SPDX-License-Identifier: GPL-3.0-or-later
import { checkCompliance } from '../compliance-check.mjs';

const ok = () =>
  new Map(
    Object.entries({
      LICENSE: 'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007',
      NOTICE: 'Peter Henningsen ... GPL-3.0-or-later',
      'wasm/dungeonmaker.js':
        '// SPDX\n/*! dungeonmaker-js | GPL-3.0-or-later | includes DungeonMaker 2.05 (c) ... */\n',
      'package.json': JSON.stringify({
        version: '1.0.0',
        license: 'GPL-3.0-or-later',
        repository: {
          url: 'git+https://github.com/spearwolf/dungeonmaker.js.git',
          directory: 'packages/dungeonmaker-js',
        },
      }),
      'README.md':
        'Corresponding source ... `v<version>` ... https://github.com/spearwolf/dungeonmaker.js',
      'CHANGELOG.md': '## [1.0.0] - 2026-11-01',
      'dungeon.schema.json': '"SPDX-License-Identifier: CC0-1.0."',
    }),
  );

test('a compliant tarball passes', () => {
  expect(checkCompliance({ files: ok(), version: '1.0.0' })).toEqual([]);
});

test.each([
  ['LICENSE', (f) => f.delete('LICENSE')],
  ['NOTICE', (f) => f.set('NOTICE', 'nothing')],
  ['wasm/dungeonmaker.js', (f) => f.set('wasm/dungeonmaker.js', 'async function x(){}')],
  ['README.md', (f) => f.set('README.md', 'short')],
  ['CHANGELOG.md', (f) => f.set('CHANGELOG.md', '## [0.0.2]')],
  ['dungeon.schema.json', (f) => f.set('dungeon.schema.json', '{}')],
  ['src/index.ts', (f) => f.set('src/index.ts', '')],
  ['wasm/dungeonmaker.wasm.map', (f) => f.set('wasm/dungeonmaker.wasm.map', '{}')],
  [
    'package.json',
    (f) => f.set('package.json', JSON.stringify({ version: '1.0.0', license: 'MIT' })),
  ],
])('a violation in %s is reported by name', (name, breakIt) => {
  const files = ok();
  breakIt(files);
  expect(checkCompliance({ files, version: '1.0.0' }).join('\n')).toContain(name);
});

test('a version mismatch in package.json is reported', () => {
  expect(checkCompliance({ files: ok(), version: '2.0.0' }).join('\n')).toContain('package.json');
});
