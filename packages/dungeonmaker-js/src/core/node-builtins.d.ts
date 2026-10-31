// SPDX-License-Identifier: GPL-3.0-or-later
// The only Node APIs the core uses (loaded dynamically, Node only). Declared here so the
// package build does not depend on @types/node; with @types/node present these merge.
declare module 'node:fs/promises' {
  export function readFile(path: string): Promise<Uint8Array<ArrayBuffer>>;
}
declare module 'node:url' {
  export function fileURLToPath(url: URL | string): string;
}
