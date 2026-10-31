// SPDX-License-Identifier: GPL-3.0-or-later
import { DesignValidationError, GenerationError } from '../errors.js';
import {
  type DungeonLayers,
  type Entity,
  OUTPUT_ENTITIES_LIST,
  OUTPUT_ROOMS,
  OUTPUT_STEPS,
  type OutputOptions,
  outputFlags,
  parseOutput,
  type Room,
  type RoomLayer,
  type StepLayer,
} from '../layers.js';
import { createDiagnostics } from './diagnostics.js';
import { type DungeonMakerWasmModule, loadDungeonMakerWasm } from './glue.js';

/** An already compiled WebAssembly module (opaque, so no DOM lib is needed); cast internally. */
export type CompiledWasm = object;

export interface LoadCoreOptions {
  /** Where to load dungeonmaker.wasm from (default: next to the glue in wasm/). */
  wasmUrl?: string | URL;
  /** An already compiled module, e.g. from a previous core; skips loading and compiling. */
  wasmModule?: CompiledWasm;
}

export interface CoreResult extends DungeonLayers {
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
  readonly wasmModule: CompiledWasm;
  /** True after the WebAssembly instance aborted; the core cannot be used any more. */
  readonly aborted: boolean;
  /** @throws TypeError for invalid `output`. */
  generate(designText: string, seed: number, output?: OutputOptions): CoreResult;
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

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Copies `count` 32-bit words; HEAPU8 is re-read each time because memory may have grown. */
function copyWords(mod: DungeonMakerWasmModule, ptr: number, count: number): ArrayBuffer {
  return mod.HEAPU8.slice(ptr, ptr + 4 * count).buffer;
}

function readRooms(mod: DungeonMakerWasmModule, width: number, height: number): RoomLayer {
  const count = mod._dm_room_count();
  const idsPtr = mod._dm_room_ids();
  const roomIds = new Uint16Array(mod.HEAPU8.slice(idsPtr, idsPtr + 2 * width * height).buffer);
  const table = count > 0 ? new Int32Array(copyWords(mod, mod._dm_rooms(), 6 * count)) : [];
  const rooms: Room[] = [];
  for (let i = 0; i < count; i++) {
    const [inDungeon = 0, size = 0, minX = 0, minY = 0, maxX = 0, maxY = 0] = table.slice(
      6 * i,
      6 * i + 6,
    );
    rooms.push(
      Object.freeze({
        id: i + 1,
        area: inDungeon === 1 ? 'dungeon' : 'labyrinth',
        size,
        bounds: Object.freeze({
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        }),
      } as const),
    );
  }
  return Object.freeze({ roomIds, rooms: Object.freeze(rooms) });
}

function readEntities(mod: DungeonMakerWasmModule): readonly Entity[] {
  const count = mod._dm_entity_count();
  const table = count > 0 ? new Int32Array(copyWords(mod, mod._dm_entities(), 4 * count)) : [];
  const entities: Entity[] = [];
  for (let i = 0; i < count; i++) {
    const [kind = 0, x = 0, y = 0, level = 0] = table.slice(4 * i, 4 * i + 4);
    entities.push(Object.freeze({ kind: kind === 1 ? 'treasure' : 'mob', x, y, level } as const));
  }
  return Object.freeze(entities);
}

function readSteps(mod: DungeonMakerWasmModule): StepLayer {
  const frames = mod._dm_step_count();
  const offsets = new Uint32Array(copyWords(mod, mod._dm_step_offsets(), frames + 1));
  const total = offsets[frames] ?? 0;
  const index = new Uint32Array(copyWords(mod, mod._dm_step_indices(), total));
  const ptr = mod._dm_step_cells();
  const cell = mod.HEAPU8.slice(ptr, ptr + total);
  return { offsets, index, cell };
}

export async function loadCore(options: LoadCoreOptions = {}): Promise<DungeonMakerCore> {
  const wasmModule: WebAssembly.Module =
    (options.wasmModule as WebAssembly.Module | undefined) ??
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
    generate(designText, seed, outputArg) {
      if (aborted) {
        throw new GenerationError(
          'the WebAssembly core aborted earlier; create a new one with loadCore({ wasmModule })',
        );
      }
      assertSeed(seed);
      const output = parseOutput(outputArg);
      const flags = outputFlags(output);
      diagnostics.take();
      const size = mod.lengthBytesUTF8(designText) + 1;
      const ptr = mod._malloc(size);
      let status: number;
      try {
        mod.stringToUTF8(designText, ptr, size);
        status = mod._dm_generate(ptr, seed >>> 0, flags);
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
      const result: Mutable<CoreResult> = { width, height, seed, cells, diagnostics: [] };
      // Branch on the requested flags, not on null pointers: an empty table may be nullptr.
      if (flags & OUTPUT_ROOMS) result.rooms = readRooms(mod, width, height);
      if (flags & OUTPUT_ENTITIES_LIST) result.entities = readEntities(mod);
      if (flags & OUTPUT_STEPS) result.steps = readSteps(mod);
      mod._dm_reset();
      result.diagnostics = diagnostics.take();
      return result;
    },
  };
}
