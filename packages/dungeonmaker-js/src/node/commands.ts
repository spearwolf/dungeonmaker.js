// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference types="node" />
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { randomSeed } from '../client/seed.js';
import { parseDesignText } from '../config/parse.js';
import { DesignValidationError } from '../errors.js';
import * as presets from '../presets.js';
import { DESIGN_SCHEMA_ID, type DesignConfig } from '../schema/model.js';
import { validateDesign } from '../schema/validate.js';
import { VERSION } from '../version.js';
import { readDesignFile } from './design-file.js';
import {
  EXPORT_EXTENSIONS,
  type ExportFormat,
  generateToFiles,
  type PresetName,
} from './generate.js';
import { MAX_SEEDS_PER_RUN, parseSeeds } from './seeds.js';

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
  cwd: string;
  /** Generator string written into the files. Test hook only. */
  generator?: string;
}

/** Exit codes: 0 success, 1 design/validation/generation/file error, 2 usage error. */
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

class UsageError extends Error {
  override readonly name = 'UsageError';
}

const HELP = `Usage: dungeonmaker-js <command> [options]

Commands:
  generate (--preset <name> | --design <file>) [options]
      Generates dungeons and writes one line per written file to stdout.
      --seed <n> | --seeds <spec> | --count <n>   one seed (1 … 4294967295), a spec like
                                 "1..50,99" (at most ${MAX_SEEDS_PER_RUN} seeds), or n random seeds
                                 (default: --count 1)
      --format <list>            comma separated: json, png, tmj, txt, bin (default: json)
      --out <dir>                output directory (default: current directory)
      --name <template>          file name without extension, {name} and {seed}
                                 (default: {name}-{seed}; must contain {seed} for several seeds)
      --rooms                    add the room layer
      --entities list|baked      add entities as a list, or bake them into the cells
      --steps                    add the generation steps
      --manifest                 also write manifest.json
      --embed-design             embed a custom design in the dungeon JSON
      --scale <n>                PNG pixels per cell, 1 … 64 (default: 1)
  presets                        lists the eleven bundled designs
  validate <file>                checks a design file (.json or legacy text)
  convert <file> [--out <file>]  turns a legacy design text into design JSON
  schema [design|dungeon]        prints a JSON Schema (default: design)
  help, --help, -h               prints this help
  --version                      prints the version

Exit codes: 0 success, 1 design, validation, generation or file error, 2 usage error.

Generated files are program output and are not covered by the GPL; this CLI is GPL-3.0-or-later.
`;

const PRESETS: Readonly<Record<string, DesignConfig>> = { ...presets };

type Parsed = ReturnType<typeof parseArgs>;

function parse(
  argv: readonly string[],
  options: NonNullable<Parameters<typeof parseArgs>[0]>['options'],
): Parsed {
  try {
    return parseArgs({ args: [...argv], options, allowPositionals: true, strict: true });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function integer(name: string, text: string, max: number): number {
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > max) {
    throw new UsageError(`Invalid ${name} "${text}": expected an integer in 1 … ${max}`);
  }
  return Number(text);
}

function parseFormats(list: string): ExportFormat[] {
  const formats = list.split(',').map((f) => f.trim());
  for (const format of formats) {
    if (!Object.hasOwn(EXPORT_EXTENSIONS, format)) {
      throw new UsageError(
        `Unknown format "${format}": expected one of ${Object.keys(EXPORT_EXTENSIONS).join(', ')}`,
      );
    }
  }
  return formats as ExportFormat[];
}

async function generate(args: readonly string[], io: CliIo): Promise<number> {
  const { values, positionals } = parse(args, {
    preset: { type: 'string' },
    design: { type: 'string' },
    seed: { type: 'string' },
    seeds: { type: 'string' },
    count: { type: 'string' },
    format: { type: 'string' },
    out: { type: 'string' },
    name: { type: 'string' },
    rooms: { type: 'boolean' },
    entities: { type: 'string' },
    steps: { type: 'boolean' },
    manifest: { type: 'boolean' },
    'embed-design': { type: 'boolean' },
    scale: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  });
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  if (positionals.length > 0) throw new UsageError(`Unexpected argument "${positionals[0]}"`);
  const preset = str(values.preset);
  const designFile = str(values.design);
  if ((preset === undefined) === (designFile === undefined)) {
    throw new UsageError('Give exactly one of --preset <name> and --design <file>');
  }
  if (preset !== undefined && !Object.hasOwn(PRESETS, preset)) {
    throw new UsageError(`Unknown preset "${preset}": see "dungeonmaker-js presets"`);
  }
  const seedOptions = ['seed', 'seeds', 'count'].filter((k) => values[k] !== undefined);
  if (seedOptions.length > 1) {
    throw new UsageError('Give at most one of --seed, --seeds and --count');
  }

  let seeds: number[];
  if (values.seed !== undefined) {
    seeds = [integer('seed', str(values.seed) as string, 0xffff_ffff)];
  } else if (values.seeds !== undefined) {
    try {
      seeds = parseSeeds(str(values.seeds) as string);
    } catch (error) {
      throw new UsageError((error as Error).message);
    }
  } else {
    const count =
      values.count === undefined
        ? 1
        : integer('count', str(values.count) as string, MAX_SEEDS_PER_RUN);
    const drawn = new Set<number>();
    while (drawn.size < count) drawn.add(randomSeed());
    seeds = [...drawn];
  }

  const formats = parseFormats(str(values.format) ?? 'json');
  const entities = str(values.entities);
  if (entities !== undefined && entities !== 'list' && entities !== 'baked') {
    throw new UsageError(`Invalid --entities "${entities}": expected list or baked`);
  }
  let scale: number | undefined;
  if (values.scale !== undefined) scale = integer('scale', str(values.scale) as string, 64);

  let design: DesignConfig | string | undefined;
  let designName: string | undefined;
  if (designFile !== undefined) {
    ({ design, name: designName } = await readDesignFile(resolve(io.cwd, designFile)));
  }
  const outDir = resolve(io.cwd, str(values.out) ?? '.');
  const output = {
    ...(values.rooms ? { rooms: true } : {}),
    ...(entities ? { entities } : {}),
    ...(values.steps ? { steps: true } : {}),
  } as { rooms?: boolean; entities?: 'list' | 'baked'; steps?: boolean };

  let result: Awaited<ReturnType<typeof generateToFiles>>;
  try {
    result = await generateToFiles({
      ...(preset !== undefined ? { preset: preset as PresetName } : { design, designName }),
      seeds,
      formats,
      outDir,
      name: str(values.name),
      output: Object.keys(output).length > 0 ? output : undefined,
      manifest: values.manifest === true,
      embedDesign: values['embed-design'] === true,
      scale,
      generator: io.generator,
    });
  } catch (error) {
    // Bad options reach generateToFiles as RangeError/TypeError before any side effect;
    // design, generation and file errors are other classes and stay failures (exit 1).
    if (error instanceof RangeError || error instanceof TypeError) {
      throw new UsageError(error.message);
    }
    throw error;
  }
  const rel = (file: string) => {
    const r = relative(io.cwd, file);
    return r === '' || isAbsolute(r) ? file : r;
  };
  for (const file of [...result.files, ...(result.manifest ? [result.manifest] : [])]) {
    io.stdout(`${rel(file)}\n`);
  }
  return 0;
}

function listPresets(args: readonly string[], io: CliIo): number {
  const { positionals } = parse(args, {});
  if (positionals.length > 0) throw new UsageError(`Unexpected argument "${positionals[0]}"`);
  for (const [name, design] of Object.entries(PRESETS)) {
    io.stdout(`${name}  ${design.map.width}x${design.map.height}\n`);
  }
  return 0;
}

function fileArgument(
  args: readonly string[],
  command: string,
  extra: NonNullable<Parameters<typeof parseArgs>[0]>['options'] = {},
) {
  const { values, positionals } = parse(args, extra);
  if (positionals.length !== 1) {
    throw new UsageError(`"${command}" takes exactly one file argument`);
  }
  return { file: positionals[0] as string, values };
}

async function validate(args: readonly string[], io: CliIo): Promise<number> {
  const { file } = fileArgument(args, 'validate');
  const { design } = await readDesignFile(resolve(io.cwd, file));
  const issues =
    typeof design === 'string' ? issuesOf(() => parseDesignText(design)) : validateDesign(design); // structural check, then the semantic checkDesign pass
  if (issues.length === 0) {
    io.stdout('valid\n');
    return 0;
  }
  for (const issue of issues) io.stderr(`${issue.path}: ${issue.message}\n`);
  return EXIT_FAILURE;
}

function issuesOf(parseIt: () => unknown): { path: string; message: string }[] {
  try {
    parseIt();
    return [];
  } catch (error) {
    if (error instanceof DesignValidationError) return [...error.issues];
    throw error;
  }
}

async function convert(args: readonly string[], io: CliIo): Promise<number> {
  const { file, values } = fileArgument(args, 'convert', { out: { type: 'string' } });
  const { design } = await readDesignFile(resolve(io.cwd, file));
  const config = typeof design === 'string' ? parseDesignText(design) : design;
  const { $schema: _, ...rest } = config as DesignConfig & { $schema?: string };
  const text = `${JSON.stringify({ $schema: DESIGN_SCHEMA_ID, ...rest }, null, 2)}\n`;
  const out = str(values.out);
  if (out === undefined) io.stdout(text);
  else await writeFile(resolve(io.cwd, out), text);
  return 0;
}

async function schema(args: readonly string[], io: CliIo): Promise<number> {
  const { positionals } = parse(args, {});
  const which = positionals[0] ?? 'design';
  if (positionals.length > 1 || (which !== 'design' && which !== 'dungeon')) {
    throw new UsageError('"schema" takes one optional argument: design or dungeon');
  }
  const url =
    which === 'design'
      ? new URL('../../design.schema.json', import.meta.url)
      : new URL('../../dungeon.schema.json', import.meta.url);
  io.stdout(await readFile(url, 'utf8'));
  return 0;
}

/** Runs the CLI and returns the exit code. Nothing is written to the process streams directly. */
export async function main(argv: readonly string[], io: CliIo): Promise<number> {
  try {
    const [command, ...rest] = argv;
    if (command === undefined) {
      io.stderr(HELP);
      return EXIT_USAGE;
    }
    switch (command) {
      case '--help':
      case '-h':
      case 'help':
        io.stdout(HELP);
        return 0;
      case '--version':
        io.stdout(`${VERSION}\n`);
        return 0;
      case 'generate':
        return await generate(rest, io);
      case 'presets':
        return listPresets(rest, io);
      case 'validate':
        return await validate(rest, io);
      case 'convert':
        return await convert(rest, io);
      case 'schema':
        return await schema(rest, io);
      default:
        throw new UsageError(`Unknown command "${command}"`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`dungeonmaker-js: ${error.message}\nRun "dungeonmaker-js --help" for usage.\n`);
      return EXIT_USAGE;
    }
    io.stderr(`dungeonmaker-js: ${(error as Error).message}\n`);
    return EXIT_FAILURE;
  }
}
