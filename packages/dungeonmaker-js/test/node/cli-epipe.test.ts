// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../dist/node/cli.js', import.meta.url));

// Runs the built CLI (needs `pnpm build`), so it is skipped in a fresh checkout.
test.skipIf(!existsSync(cli))(
  'a reader that closes stdout early ends the CLI quietly with exit code 0',
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dm-epipe-'));
    try {
      const child = spawn(
        process.execPath,
        [cli, 'generate', '--preset', 'design3A', '--count', '30', '--format', 'txt', '--out', dir],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.stdout.destroy(); // like `| head -1` after the first line: the write end has no reader
      const code = await new Promise((done) => child.on('close', done));
      expect(stderr).toBe('');
      expect(code).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
