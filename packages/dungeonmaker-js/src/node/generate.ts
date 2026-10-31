// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference types="node" />
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseDesignText } from '../config/parse.js';
import { toDesignText } from '../config/serialize.js';
import { loadCore } from '../core/core.js';
import {
  type DungeonSource,
  designSource,
  TILESET_IMAGE,
  toAsciiText,
  toDungeonJson,
  toPng,
  toRaw,
  toTiledMap,
  toTilesetPng,
} from '../export.js';
import { type OutputOptions, parseOutput } from '../layers.js';
import * as presets from '../presets.js';
import { checkScale, MAX_PIXELS } from '../render/raster.js';
import { DesignValidationError } from '../errors.js';
import type { DesignConfig } from '../schema/model.js';
import { validateDesign } from '../schema/validate.js';
import { VERSION } from '../version.js';
import { renderName } from './name.js';
import { MAX_SEEDS_PER_RUN } from './seeds.js';

export type PresetName = keyof typeof presets;
export type ExportFormat = 'json' | 'png' | 'tmj' | 'txt' | 'bin';

export const EXPORT_EXTENSIONS: Readonly<Record<ExportFormat, string>> = {
  json: '.dungeon.json',
  png: '.png',
  tmj: '.tmj',
  txt: '.txt',
  bin: '.bin',
};

export interface GenerateToFilesOptions {
  /** A design object or legacy design text. Exactly one of `design` and `preset`. */
  design?: DesignConfig | string;
  preset?: PresetName;
  /** Value of `{name}` for a `design`. Default `dungeon`. */
  designName?: string;
  seeds: readonly number[];
  formats: readonly ExportFormat[];
  outDir: string;
  /** File name template without extension; default `{name}-{seed}`. */
  name?: string;
  output?: OutputOptions;
  /** Also write `manifest.json`. */
  manifest?: boolean;
  /** Embed the design in the dungeon JSON (never for presets). */
  embedDesign?: boolean;
  /** PNG scale, default 1. */
  scale?: number;
  /** Generator string for the files; default `dungeonmaker-js@<version>`. */
  generator?: string;
}

export interface GenerateToFilesResult {
  /** Absolute paths, in write order. */
  readonly files: readonly string[];
  readonly manifest?: string;
}

const MAX_SEED = 0xffff_ffff;
const PRESETS: Readonly<Record<PresetName, DesignConfig>> = { ...presets };
const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

function checkSeeds(seeds: readonly number[]): void {
  if (seeds.length === 0) throw new RangeError('No seeds given');
  if (seeds.length > MAX_SEEDS_PER_RUN) {
    throw new RangeError(`Too many seeds: ${seeds.length}, at most ${MAX_SEEDS_PER_RUN} per run`);
  }
  for (const s of seeds) {
    if (!Number.isInteger(s) || s < 1 || s > MAX_SEED) {
      throw new RangeError(`Invalid seed ${s}: seeds are 1 … ${MAX_SEED}`);
    }
  }
}

/** The preset whose design text equals the given one, if any. */
function presetOf(text: string): PresetName | undefined {
  let normalised: string;
  try {
    normalised = toDesignText(parseDesignText(text));
  } catch {
    return undefined; // not parseable here: it is no preset, and the core reports the real error
  }
  return PRESET_NAMES.find((n) => toDesignText(PRESETS[n]) === normalised);
}

/**
 * Generates one dungeon per seed and writes the requested formats into `outDir`. Everything
 * is validated before the first generation; existing files are overwritten.
 *
 * @throws TypeError unless exactly one of `design` and `preset` is given.
 * @throws RangeError for invalid seeds or file names, or a name template without `{seed}`
 * for several seeds.
 */
export async function generateToFiles(
  options: GenerateToFilesOptions,
): Promise<GenerateToFilesResult> {
  if ((options.design === undefined) === (options.preset === undefined)) {
    throw new TypeError('Exactly one of `design` and `preset` must be given');
  }
  if (options.preset !== undefined && !PRESET_NAMES.includes(options.preset)) {
    throw new TypeError(`Unknown preset "${options.preset}"`);
  }
  checkSeeds(options.seeds);
  const template = options.name ?? '{name}-{seed}';
  if (options.seeds.length > 1 && !template.includes('{seed}')) {
    throw new RangeError(
      `Name template "${template}" lacks {seed}: with ${options.seeds.length} seeds every file would overwrite the previous one`,
    );
  }
  const output = parseOutput(options.output);
  const generator = options.generator ?? `dungeonmaker-js@${VERSION}`;
  const formats = [...new Set(options.formats)];
  if (formats.length === 0) throw new RangeError('No formats given');
  for (const format of formats) {
    if (!Object.hasOwn(EXPORT_EXTENSIONS, format)) {
      throw new RangeError(
        `Unknown format "${format}": expected one of ${Object.keys(EXPORT_EXTENSIONS).join(', ')}`,
      );
    }
  }
  checkScale(options.scale);

  let designText: string;
  let mapSize: { width: number; height: number };
  let name: string;
  let source: DungeonSource;
  if (options.preset !== undefined) {
    designText = toDesignText(PRESETS[options.preset]);
    mapSize = PRESETS[options.preset].map;
    name = options.preset;
    source = { preset: options.preset };
  } else {
    const design = options.design as DesignConfig | string;
    // A malformed design throws a DesignValidationError before any side effect: text goes
    // through the parser, objects through the same validation as `validate`.
    let config: DesignConfig;
    if (typeof design === 'string') {
      config = parseDesignText(design);
    } else {
      const issues = validateDesign(design);
      if (issues.length > 0) throw new DesignValidationError(issues);
      config = design;
    }
    designText = typeof design === 'string' ? design : toDesignText(design);
    mapSize = config.map;
    name = options.designName ?? 'dungeon';
    const known = presetOf(designText);
    source =
      known !== undefined
        ? { preset: known }
        : await designSource(design, { embed: options.embedDesign });
  }
  if (formats.includes('png')) {
    const scale = checkScale(options.scale);
    const pixels = mapSize.width * scale * (mapSize.height * scale);
    if (pixels > MAX_PIXELS) {
      throw new RangeError(
        `PNG of ${mapSize.width * scale}x${mapSize.height * scale} pixels exceeds the limit of ${MAX_PIXELS} pixels: lower --scale`,
      );
    }
  }
  const fileNames = options.seeds.map((seed) => renderName(template, { name, seed }));
  if (new Set(fileNames).size !== fileNames.length) {
    throw new RangeError(`Name template "${template}" yields duplicate file names`);
  }
  if (formats.includes('tmj') && fileNames.some((n) => `${n}.png` === TILESET_IMAGE)) {
    throw new RangeError(
      `Name template "${template}" would make a .png collide with the tileset ${TILESET_IMAGE}`,
    );
  }

  const outDir = resolve(options.outDir);
  const core = await loadCore();
  await mkdir(outDir, { recursive: true });

  const files: string[] = [];
  const manifestFiles: { seed: number; files: string[] }[] = [];
  const write = async (file: string, data: string | Uint8Array): Promise<string> => {
    const path = join(outDir, file);
    await writeFile(path, data);
    files.push(path);
    return file;
  };

  for (const [i, seed] of options.seeds.entries()) {
    const base = fileNames[i] as string;
    const dungeon = core.generate(designText, seed, output);
    const written: string[] = [];
    for (const format of formats) {
      const file = `${base}${EXPORT_EXTENSIONS[format]}`;
      let data: string | Uint8Array;
      if (format === 'json') data = toDungeonJson(dungeon, { source, generator });
      else if (format === 'png') data = await toPng(dungeon, { scale: options.scale, generator });
      else if (format === 'tmj') data = toTiledMap(dungeon, { generator });
      else if (format === 'txt') data = toAsciiText(dungeon);
      else data = toRaw(dungeon);
      written.push(await write(file, data));
    }
    manifestFiles.push({ seed, files: written });
  }
  if (formats.includes('tmj')) await write(TILESET_IMAGE, await toTilesetPng());

  let manifest: string | undefined;
  if (options.manifest) {
    const doc = {
      format: 'dungeonmaker-js/manifest',
      formatVersion: 1,
      generator,
      source,
      output: output ?? {},
      formats,
      files: manifestFiles,
    };
    manifest = join(outDir, 'manifest.json');
    await writeFile(manifest, `${JSON.stringify(doc, null, 2)}\n`);
  }
  return manifest === undefined ? { files } : { files, manifest };
}
