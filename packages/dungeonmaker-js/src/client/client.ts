// SPDX-License-Identifier: GPL-3.0-or-later

import { type Dungeon, toDungeon } from '../dungeon.js';
import { WorkerError } from '../errors.js';
import {
  decodeError,
  type FromWorker,
  PROTOCOL_VERSION,
  parseFromWorker,
  type ToWorker,
} from '../protocol.js';
import type { DesignConfig } from '../schema/model.js';
import { resolveSeed } from './seed.js';

export const DEFAULT_TIMEOUT = 30_000;

export interface DungeonRequest {
  design: DesignConfig | string;
  seed?: number;
}

export interface CallOptions {
  signal?: AbortSignal;
  timeout?: number;
}

export interface DungeonMakerOptions {
  worker?: () => Worker;
  wasmUrl?: string | URL;
  timeout?: number;
  validate?: boolean;
}

export interface DungeonMaker {
  create(request: DungeonRequest, opts?: CallOptions): Promise<Dungeon>;
  ready(): Promise<void>;
  dispose(): void;
}

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
  reject(reason: unknown): void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // A rejection nobody awaits (ready() never called) must not surface as unhandled.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

/** Everything that belongs to one spawned worker. */
interface WorkerState {
  worker: Worker;
  ready: Deferred;
  detach(): void;
}

interface Job {
  id: number;
  design: DesignConfig | string;
  seed: number;
  options: CallOptions;
  resolve(dungeon: Dungeon): void;
  reject(reason: unknown): void;
  /** Runs when the job settles, whatever the outcome (timers, abort listeners). */
  cleanup: (() => void)[];
}

export function createDungeonMaker(options: DungeonMakerOptions = {}): DungeonMaker {
  let current: WorkerState | null = null;
  let running: Job | null = null;
  const queue: Job[] = [];
  let nextId = 1;
  let disposed = false;

  const disposedError = () => new DOMException('DungeonMaker was disposed', 'AbortError');

  /** The single settle path of a job: clears the running slot, runs cleanups, continues. */
  function settle(
    job: Job,
    outcome: { ok: true; value: Dungeon } | { ok: false; reason: unknown },
  ) {
    if (running === job) running = null;
    for (const fn of job.cleanup.splice(0)) fn();
    if (outcome.ok) job.resolve(outcome.value);
    else job.reject(outcome.reason);
    pump();
  }

  function spawn(): WorkerState {
    if (!options.worker) throw new WorkerError('no worker factory configured');
    let worker: Worker;
    try {
      worker = options.worker();
    } catch (e) {
      throw new WorkerError('could not create the worker', { cause: e });
    }
    const state: WorkerState = { worker, ready: deferred(), detach: () => {} };
    const onMessage = (event: Event) => handleMessage(state, (event as MessageEvent).data);
    worker.addEventListener('message', onMessage);
    state.detach = () => worker.removeEventListener('message', onMessage);
    current = state;
    const init: ToWorker = { type: 'init', v: PROTOCOL_VERSION };
    if (options.wasmUrl !== undefined) init.wasmUrl = String(options.wasmUrl);
    worker.postMessage(init);
    return state;
  }

  function handleMessage(state: WorkerState, data: unknown): void {
    if (state !== current) return;
    try {
      const message: FromWorker = parseFromWorker(data);
      switch (message.type) {
        case 'ready':
          state.ready.resolve();
          return;
        case 'result': {
          const job = running;
          if (!job || job.id !== message.id) return;
          settle(job, {
            ok: true,
            value: toDungeon({
              width: message.width,
              height: message.height,
              seed: message.seed,
              cells: message.cells,
              diagnostics: message.diagnostics,
            }),
          });
          return;
        }
        case 'error': {
          if (message.id === null) {
            const failure = new WorkerError(`worker failed to start: ${message.error.message}`);
            state.ready.reject(failure);
            if (running) settle(running, { ok: false, reason: failure });
            return;
          }
          const job = running;
          if (!job || job.id !== message.id) return;
          settle(job, { ok: false, reason: decodeError(message.error) });
          return;
        }
      }
    } catch (e) {
      const failure =
        e instanceof WorkerError
          ? e
          : new WorkerError('malformed message from worker', { cause: e });
      if (running) settle(running, { ok: false, reason: failure });
    }
  }

  function pump(): void {
    if (disposed || running) return;
    const job = queue.shift();
    if (!job) return;
    let state: WorkerState;
    try {
      state = current ?? spawn();
    } catch (e) {
      settle(job, { ok: false, reason: e });
      return;
    }
    running = job;
    const message: ToWorker = {
      type: 'create',
      v: PROTOCOL_VERSION,
      id: job.id,
      design: job.design,
      seed: job.seed,
    };
    try {
      state.worker.postMessage(message);
    } catch (e) {
      settle(job, { ok: false, reason: e });
    }
  }

  async function create(request: DungeonRequest, callOptions: CallOptions = {}): Promise<Dungeon> {
    if (disposed) throw disposedError();
    const seed = resolveSeed(request.seed);
    return new Promise<Dungeon>((resolve, reject) => {
      queue.push({
        id: nextId++,
        design: request.design,
        seed,
        options: callOptions,
        resolve,
        reject,
        cleanup: [],
      });
      pump();
    });
  }

  async function ready(): Promise<void> {
    if (disposed) throw disposedError();
    if (!current) current = spawn();
    return current.ready.promise;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    const state = current;
    current = null;
    if (state) {
      state.detach();
      state.worker.terminate();
      state.ready.reject(disposedError());
    }
    const pending = [...(running ? [running] : []), ...queue.splice(0)];
    running = null;
    for (const job of pending) {
      for (const fn of job.cleanup.splice(0)) fn();
      job.reject(disposedError());
    }
  }

  return { create, ready, dispose };
}
