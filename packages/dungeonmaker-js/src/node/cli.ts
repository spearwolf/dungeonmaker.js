#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference types="node" />
import { main } from './commands.js';

// A reader that closes early (`presets | head -2`) makes the next write fail with EPIPE:
// end quietly with the exit code reached so far, and let every other stream error surface.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(process.exitCode ?? 0);
    throw error;
  });
}

process.exitCode = await main(process.argv.slice(2), {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
  cwd: process.cwd(),
});
