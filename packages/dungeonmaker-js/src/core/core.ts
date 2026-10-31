// SPDX-License-Identifier: GPL-3.0-or-later
import { DesignValidationError, GenerationError } from '../errors.js';
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

/** Hoisted so that `new URL(url, moduleUrl)` is not a pattern bundlers try to resolve. */
const moduleUrl = import.meta.url;

async function readWasmBytes(url: string | URL): Promise<BufferSource> {
  const isNode =
    typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions
      ?.node === 'string';
  if (isNode) {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import(/* webpackIgnore: true */ /* @vite-ignore */ 'node:fs/promises'),
      import(/* webpackIgnore: true */ /* @vite-ignore */ 'node:url'),
    ]);
    const href = url instanceof URL ? url : new URL(url, moduleUrl);
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
      // Synchronous on purpose: the glue calls this hook inside a Promise executor without a
      // reject path, so only a synchronous throw turns a failed instantiation into a rejection.
      done(new WebAssembly.Instance(wasmModule, imports), wasmModule);
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
      if (aborted) {
        throw new GenerationError(
          'the WebAssembly core aborted earlier; create a new one with loadCore({ wasmModule })',
        );
      }
      assertSeed(seed);
      diagnostics.take();
      const size = mod.lengthBytesUTF8(designText) + 1;
      const ptr = mod._malloc(size);
      let status: number;
      try {
        mod.stringToUTF8(designText, ptr, size);
        status = mod._dm_generate(ptr, seed >>> 0, 0);
      } catch (cause) {
        // After an abort the instance is unusable; do not touch its heap again.
        aborted = true;
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new GenerationError(message, diagnostics.take(), { cause });
      }
      mod._free(ptr);
      if (status === 1) {
        const message = mod.UTF8ToString(mod._dm_last_error());
        throw new DesignValidationError([{ path: '', message }], diagnostics.take());
      }
      if (status !== 0) {
        throw new RangeError(mod.UTF8ToString(mod._dm_last_error()));
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
