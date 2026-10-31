// SPDX-License-Identifier: GPL-3.0-or-later
import { parseDesignText } from 'dungeonmaker-js';
import { designFileText } from './source';

/**
 * Turns a legacy design text into the editor's design file JSON. A leading byte order mark is
 * removed and CRLF becomes LF first, as `readDesignFile` does for the CLI, so a file saved on
 * Windows gives the same JSON as the same file with LF.
 */
export function importLegacy(text: string): { json: string } | { error: string } {
  try {
    const design = parseDesignText(text.replace(/^﻿/, '').replace(/\r\n/g, '\n'));
    return { json: designFileText(design) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
