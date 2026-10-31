// SPDX-License-Identifier: GPL-3.0-or-later
import { toDesignText } from '../config/serialize.js';
import type { DungeonMakerCore, LoadCoreOptions } from '../core/core.js';
import { encodeError, type FromWorker, PROTOCOL_VERSION, parseToWorker } from '../protocol.js';

export interface WorkerHandlerDeps {
  post(message: FromWorker, transfer: Transferable[]): void;
  loadCore(options: LoadCoreOptions): Promise<DungeonMakerCore>;
}

/** The id of a raw message, if it carries a usable one; used to answer unparsable requests. */
function readableId(data: unknown): number | null {
  const id = typeof data === 'object' && data !== null ? (data as { id?: unknown }).id : undefined;
  return typeof id === 'number' && Number.isInteger(id) && id >= 1 ? id : null;
}

/** Handles one incoming message; calls are processed strictly in arrival order. */
export function createWorkerHandler(deps: WorkerHandlerDeps): (data: unknown) => Promise<void> {
  let core: Promise<DungeonMakerCore> | undefined;
  let queue: Promise<void> = Promise.resolve();

  const fail = (id: number | null, error: unknown): void => {
    deps.post({ type: 'error', v: PROTOCOL_VERSION, id, error: encodeError(error) }, []);
  };

  async function process(data: unknown): Promise<void> {
    let message: ReturnType<typeof parseToWorker>;
    try {
      message = parseToWorker(data);
    } catch (e) {
      fail(readableId(data), e);
      return;
    }

    if (message.type === 'init') {
      if (!core) {
        const options: LoadCoreOptions = message.wasmUrl ? { wasmUrl: message.wasmUrl } : {};
        core = deps.loadCore(options);
      }
      try {
        await core;
        deps.post({ type: 'ready', v: PROTOCOL_VERSION }, []);
      } catch (e) {
        core = undefined;
        fail(null, e);
      }
      return;
    }

    if (!core) {
      fail(message.id, new Error('worker is not initialized: send init first'));
      return;
    }
    let current: DungeonMakerCore;
    try {
      current = await core;
    } catch (e) {
      fail(message.id, e);
      return;
    }
    try {
      const text =
        typeof message.design === 'string' ? message.design : toDesignText(message.design);
      const r = current.generate(text, message.seed);
      deps.post(
        {
          type: 'result',
          v: PROTOCOL_VERSION,
          id: message.id,
          width: r.width,
          height: r.height,
          seed: r.seed,
          cells: r.cells,
          diagnostics: [...r.diagnostics],
        },
        [r.cells.buffer as ArrayBuffer],
      );
    } catch (e) {
      fail(message.id, e);
      if (current.aborted) {
        // An abort poisons the instance; the compiled module is reused for a fresh one.
        core = deps.loadCore({ wasmModule: current.wasmModule });
        core.catch(() => {
          core = undefined;
        });
      }
    }
  }

  return (data) => {
    const run = queue.then(() => process(data));
    queue = run.catch(() => {});
    return run;
  };
}
