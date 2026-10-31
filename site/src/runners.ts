// SPDX-License-Identifier: GPL-3.0-or-later
import type { OutputOptions } from 'dungeonmaker-js';
import { VERSION } from 'dungeonmaker-js/export';

export type Runner = 'pnpm' | 'npm' | 'yarn' | 'bun';
export const RUNNERS: readonly Runner[] = ['pnpm', 'npm', 'yarn', 'bun'];

const DLX: Readonly<Record<Runner, string>> = {
  pnpm: 'pnpm dlx',
  npm: 'npx',
  yarn: 'yarn dlx',
  bun: 'bunx',
};

const INSTALL: Readonly<Record<Runner, string>> = {
  pnpm: 'pnpm add',
  npm: 'npm install',
  yarn: 'yarn add',
  bun: 'bun add',
};

/** The formats the demo offers as downloads, in the order the command writes them. */
const FORMATS = 'json,png,tmj,txt,bin';

export function installCommand(runner: Runner): string {
  return `${INSTALL[runner]} dungeonmaker-js`;
}

export interface CliRequest {
  /** `['--preset', name]` or `['--design', './design.json']`. */
  cliArgs: readonly string[];
  seed: number;
  output?: OutputOptions;
  /** PNG scale; left out of the command when it is 1 or absent. */
  scale?: number;
}

/**
 * The CLI command that writes the same files as the demo's downloads. The version is pinned
 * because every file records `dungeonmaker-js@<version>` as its generator.
 */
export function cliCommand(runner: Runner, request: CliRequest, version: string = VERSION): string {
  const { cliArgs, seed, output, scale } = request;
  const parts = [
    DLX[runner],
    `dungeonmaker-js@${version}`,
    'generate',
    ...cliArgs,
    '--seed',
    String(seed),
    '--format',
    FORMATS,
  ];
  if (output?.rooms === true) parts.push('--rooms');
  if (output?.entities === 'list' || output?.entities === 'baked') {
    parts.push('--entities', output.entities);
  }
  if (output?.steps === true) parts.push('--steps');
  if (scale !== undefined && scale !== 1) parts.push('--scale', String(scale));
  return parts.join(' ');
}
