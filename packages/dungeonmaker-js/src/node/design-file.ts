// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { DesignConfig } from '../schema/model.js';

/**
 * Reads a design file. `.json` is parsed as a design object; anything else is legacy design
 * text, with a leading byte order mark removed and CRLF turned into LF (so a file saved on
 * Windows behaves like the same file with LF). `name` is the file name without extensions.
 */
export async function readDesignFile(
  path: string,
): Promise<{ design: DesignConfig | string; name: string }> {
  const raw = await readFile(path, 'utf8');
  const base = basename(path);
  const name = base.split('.')[0] || base;
  if (base.toLowerCase().endsWith('.json')) {
    return { design: JSON.parse(raw.replace(/^﻿/, '')) as DesignConfig, name };
  }
  return { design: raw.replace(/^﻿/, '').replace(/\r\n/g, '\n'), name };
}
