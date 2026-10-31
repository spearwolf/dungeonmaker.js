#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference types="node" />
import { main } from './commands.js';

process.exitCode = await main(process.argv.slice(2), {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
  cwd: process.cwd(),
});
