// SPDX-License-Identifier: GPL-3.0-or-later
import { createDiagnostics } from './diagnostics.js';
import { type DungeonMakerWasmModule, loadDungeonMakerWasm } from './glue.js';

export interface LoadCoreOptions {
  /** Where to load dungeonmaker.wasm from (default: next to the glue in wasm/). */
  wasmUrl?: string | URL;
  /** An already compiled module, e.g. from a previous core; skips loading and compiling. */
  wasmModule?: WebAssembly.Module;
}

export interface CoreResult {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  /** Row-major, north-up: index = y * width + x; values are `Cell`. */
  readonly cells: Uint8Array;
  /** Output the library printed while generating. */
  readonly diagnostics: readonly string[];
}

export interface DungeonMakerCore {
  /** The compiled module; pass it to loadCore() to get a fresh instance cheaply. */
  readonly wasmModule: WebAssembly.Module;
  /** True after the WebAssembly instance aborted; the core cannot be used any more. */
  readonly aborted: boolean;
  generate(designText: string, seed: number): CoreResult;
}

const MAX_SEED = 0xffff_ffff;

async function readWasmBytes(url: string | URL): Promise<BufferSource> {
  const isNode =
    typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions
      ?.node === 'string';
  if (isNode) {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import('node:fs/promises'),
      import('node:url'),
    ]);
    const href = url instanceof URL ? url : new URL(url, import.meta.url);
    if (href.protocol === 'file:') return readFile(fileURLToPath(href));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`failed to load ${String(url)}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 1 || seed > MAX_SEED) {
    throw new RangeError(`seed must be an integer in 1..${MAX_SEED}, got ${seed}`);
  }
}

export async function loadCore(options: LoadCoreOptions = {}): Promise<DungeonMakerCore> {
  const wasmModule =
    options.wasmModule ??
    (await WebAssembly.compile(
      await readWasmBytes(
        options.wasmUrl ?? new URL('../../wasm/dungeonmaker.wasm', import.meta.url),
      ),
    ));
  const diagnostics = createDiagnostics();
  const mod: DungeonMakerWasmModule = await loadDungeonMakerWasm({
    instantiateWasm(imports, done) {
      WebAssembly.instantiate(wasmModule, imports).then((instance) => done(instance, wasmModule));
      return {};
    },
    print: (line) => diagnostics.push(line),
    printErr: (line) => diagnostics.push(line),
  });
  let aborted = false;

  return {
    wasmModule,
    get aborted() {
      return aborted;
    },
    generate(designText, seed) {
      assertSeed(seed);
      diagnostics.take();
      const size = mod.lengthBytesUTF8(designText) + 1;
      const ptr = mod._malloc(size);
      mod.stringToUTF8(designText, ptr, size);
      const status = mod._dm_generate(ptr, seed >>> 0, 0);
      mod._free(ptr);
      if (status !== 0) {
        throw new Error(`dm_generate failed with status ${status}`);
      }
      const width = mod._dm_width();
      const height = mod._dm_height();
      const cellsPtr = mod._dm_cells();
      // Read HEAPU8 only now: memory growth during generation replaces the view.
      const cells = mod.HEAPU8.slice(cellsPtr, cellsPtr + width * height);
      mod._dm_reset();
      return { width, height, seed, cells, diagnostics: diagnostics.take() };
    },
  };
}
