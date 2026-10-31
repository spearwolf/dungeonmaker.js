// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDesignText } from '../../src/config/parse.js';
import { toDesignText } from '../../src/config/serialize.js';
import { readDesignFile } from '../../src/node/design-file.js';
import { design3A } from '../../src/presets.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dm-design-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

test('BOM and CRLF behave like the same file with LF', async () => {
  const lf = toDesignText(design3A);
  await writeFile(join(dir, 'a.design'), lf);
  await writeFile(join(dir, 'b.design'), `﻿${lf.replace(/\n/g, '\r\n')}`);
  const a = await readDesignFile(join(dir, 'a.design'));
  const b = await readDesignFile(join(dir, 'b.design'));
  expect(b.design).toEqual(a.design);
  expect(toDesignText(parseDesignText(b.design as string))).toBe(
    toDesignText(parseDesignText(a.design as string)),
  );
});

test('.json is parsed as an object; the name drops all extensions', async () => {
  await writeFile(join(dir, 'cave.design.json'), JSON.stringify(design3A));
  const r = await readDesignFile(join(dir, 'cave.design.json'));
  expect(r.name).toBe('cave');
  expect(r.design).toEqual(design3A);
});

test('a missing file rejects', async () => {
  await expect(readDesignFile(join(dir, 'nope.design'))).rejects.toThrow();
});

test('a JSON syntax error names the file', async () => {
  const file = join(dir, 'broken.json');
  await writeFile(file, '{ nope');
  await expect(readDesignFile(file)).rejects.toThrow(file);
});
