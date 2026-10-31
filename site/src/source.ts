// SPDX-License-Identifier: GPL-3.0-or-later
import { type DesignConfig, parseDesignText, toDesignText } from 'dungeonmaker-js';
import { type DungeonSource, designSource } from 'dungeonmaker-js/export';
import * as presets from 'dungeonmaker-js/presets';

/** The `$schema` of design files; the site tests pin it to `DESIGN_SCHEMA_ID` of the schema entry. */
export const DESIGN_SCHEMA_ID = 'https://unpkg.com/dungeonmaker-js/design.schema.json';

export type PresetName = keyof typeof presets;

const PRESETS: Readonly<Record<PresetName, DesignConfig>> = { ...presets };
export const PRESET_NAMES = Object.keys(PRESETS) as readonly PresetName[];

export type SiteSource =
  | { kind: 'preset'; preset: PresetName }
  | { kind: 'design'; design: DesignConfig };

export interface ResolvedSource {
  /** The CLI's `{name}`: the preset name or `design`. */
  name: string;
  /** The `source` entry exactly as `generateToFiles` writes it. */
  source: DungeonSource;
  cliArgs: readonly string[];
  /** The design that is generated. */
  design: DesignConfig;
}

/** The file name the copied command expects next to the shell's working directory. */
export const DESIGN_FILE = 'design.json';

/** The preset whose design text equals the given design's, if any (as `presetOf` in the CLI). */
function presetOf(design: DesignConfig): PresetName | undefined {
  const normalised = toDesignText(parseDesignText(toDesignText(design)));
  return PRESET_NAMES.find((n) => toDesignText(PRESETS[n]) === normalised);
}

/**
 * Applies the CLI's source rule: a preset is written as `{ preset }`; an editor design is
 * `--design ./design.json` with the file name `design`, and is written as `{ preset }` when its
 * text equals a preset, otherwise by hash only (never embedded).
 */
export async function resolveSource(input: SiteSource): Promise<ResolvedSource> {
  if (input.kind === 'preset') {
    return {
      name: input.preset,
      source: { preset: input.preset },
      cliArgs: ['--preset', input.preset],
      design: PRESETS[input.preset],
    };
  }
  const known = presetOf(input.design);
  return {
    name: 'design',
    source: known !== undefined ? { preset: known } : await designSource(input.design),
    cliArgs: ['--design', `./${DESIGN_FILE}`],
    design: input.design,
  };
}

/** The content of `design.json` as the demo offers it: `$schema` first, 2 spaces, final newline. */
export function designFileText(design: DesignConfig): string {
  return `${JSON.stringify({ $schema: DESIGN_SCHEMA_ID, ...design }, null, 2)}\n`;
}
