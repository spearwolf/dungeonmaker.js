// SPDX-License-Identifier: GPL-3.0-or-later
import { parseDesignText } from '../config/parse.js';
import { toDesignText } from '../config/serialize.js';
import type { DesignConfig } from '../schema/model.js';
import type { DungeonSource } from './dungeon-json.js';

/**
 * The source entry for a design that is not an upstream preset: `sha256:<hex>` over the
 * UTF-8 design text (`toDesignText` for objects, the text itself for strings). With
 * `embed` the design object is included as well.
 */
export async function designSource(
  design: DesignConfig | string,
  options: { embed?: boolean } = {},
): Promise<DungeonSource> {
  const text = typeof design === 'string' ? design : toDesignText(design);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const designHash = `sha256:${hex}`;
  if (!options.embed) return { designHash };
  return { designHash, design: typeof design === 'string' ? parseDesignText(design) : design };
}
