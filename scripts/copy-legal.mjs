#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// prepack: the npm tarball must carry the full license text and the NOTICE (spec §9.3).
import { copyFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const pkg = new URL('packages/dungeonmaker-js/', root);
for (const name of ['LICENSE', 'NOTICE']) {
  copyFileSync(new URL(name, root), new URL(name, pkg));
}
