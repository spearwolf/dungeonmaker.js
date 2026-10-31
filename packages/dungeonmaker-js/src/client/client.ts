// SPDX-License-Identifier: GPL-3.0-or-later

import { type Dungeon, toDungeon } from '../dungeon.js';
import { TimeoutError, WorkerError } from '../errors.js';
import { type OutputOptions, parseOutput } from '../layers.js';
import {
  decodeError,
  type FromWorker,
  PROTOCOL_VERSION,
  parseFromWorker,
  type ToWorker,
} from '../protocol.js';
import type { DesignConfig } from '../schema/model.js';
import { resolveSeed } from './seed.js';
import { spawnDefaultWorker } from './spawn.js';
import { validateOrThrow } from './validate.js';

export const DEFAULT_TIMEOUT = 30_000;

/** The largest delay `setTimeout` honours; larger values fire immediately. */
const MAX_TIMEOUT = 2_147_483_647;

export interface DungeonRequest {
  design: DesignConfig | string;
  seed?: number;
  /** Optional layers next to the cells; they arrive by transfer. */
  output?: OutputOptions;
}

// The public types below are structural on purpose: the declarations of the main entry must
// type-check without the DOM lib (a Node-only consumer importing just `parseDesignText`).

/** The events the client listens to on a worker. */
export type WorkerEventType = 'message' | 'error' | 'messageerror';

/** What the client needs from a worker; a DOM `Worker` satisfies it. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: object[]): void;
  terminate(): void;
  addEventListener(type: WorkerEventType, listener: (event: unknown) => void): void;
  removeEventListener(type: WorkerEventType, listener: (event: unknown) => void): void;
}

/** What the client needs from an abort signal; a DOM `AbortSignal` satisfies it. */
export interface AbortSignalLike {
  readonly aborted: boolean;
  readonly reason?: unknown;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface CallOptions {
  signal?: AbortSignalLike;
  timeout?: number;
}

export interface DungeonMakerOptions {
  worker?: () => WorkerLike;
  /** A string or a `URL` (anything with an `href`); a relative string is resolved against the page. */
  wasmUrl?: string | { readonly href: string };
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

/** `Infinity` (no timer) or a finite number of milliseconds in `1 … 2³¹−1`. */
function checkTimeout(timeout: number): number {
  if (
    timeout === Number.POSITIVE_INFINITY ||
    (Number.isFinite(timeout) && timeout >= 1 && timeout <= MAX_TIMEOUT)
  ) {
    return timeout;
  }
  throw new RangeError(
    `timeout must be Infinity or a number of milliseconds in 1 … ${MAX_TIMEOUT}, got ${String(timeout)}`,
  );
}

/**
 * A URL object becomes its href; a relative string is resolved against the page (not this
 * module). Throws a TypeError if the page's location is no valid base (`about:blank`, …).
 */
function resolveWasmUrl(url: string | { readonly href: string }): string {
  if (typeof url !== 'string') return url.href;
  const base = (globalThis as { location?: { href?: string } }).location?.href;
  return base ? new URL(url, base).href : url;
}

function abortReason(signal: AbortSignalLike): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

/** Everything that belongs to one spawned worker. */
interface WorkerState {
  worker: WorkerLike;
  ready: Deferred;
  /** Removes every listener this client attached to the worker. */
  detach(): void;
}

type Outcome = { ok: true; value: Dungeon } | { ok: false; reason: unknown };

interface Job {
  id: number;
  design: DesignConfig | string;
  seed: number;
  output: OutputOptions | undefined;
  timeout: number;
  signal: AbortSignalLike | undefined;
  resolve(dungeon: Dungeon): void;
  reject(reason: unknown): void;
  /** Runs when the job settles, whatever the outcome (timer, abort listener). Must not throw. */
  cleanup: (() => void)[];
}

export function createDungeonMaker(options: DungeonMakerOptions = {}): DungeonMaker {
  const defaultTimeout = checkTimeout(options.timeout ?? DEFAULT_TIMEOUT);
  let current: WorkerState | null = null;
  let running: Job | null = null;
  const queue: Job[] = [];
  let nextId = 1;
  let disposed = false;

  const disposedError = () => new DOMException('DungeonMaker was disposed', 'AbortError');

  /** Runs the job's cleanups and hands the outcome to its promise; touches no queue state. */
  function finish(job: Job, outcome: Outcome): void {
    for (const fn of job.cleanup.splice(0)) fn();
    if (outcome.ok) job.resolve(outcome.value);
    else job.reject(outcome.reason);
  }

  /** The settle path of a single job: clears the running slot, finishes it, continues. */
  function settle(job: Job, outcome: Outcome): void {
    if (running === job) running = null;
    finish(job, outcome);
    pump();
  }

  /** Rejects the running and every queued job with the same reason, without pumping. */
  function rejectAll(reason: unknown): void {
    const jobs = [...(running ? [running] : []), ...queue.splice(0)];
    running = null;
    for (const job of jobs) finish(job, { ok: false, reason });
  }

  /** Terminates a worker for good: no listener of it reaches this client again. */
  function retire(state: WorkerState, reason: unknown): void {
    if (current === state) current = null;
    state.detach();
    state.worker.terminate();
    state.ready.reject(reason);
  }

  /** The worker is unusable: every job fails with WorkerError, nothing respawns until the next call. */
  function workerFailed(state: WorkerState, failure: WorkerError): void {
    if (state !== current) return;
    retire(state, failure);
    rejectAll(failure);
  }

  /** Ends the running job early (timeout, abort): its worker goes, the queue continues on a new one. */
  function interrupt(job: Job, reason: unknown): void {
    if (running !== job) return;
    // A pending ready() learns that the worker is gone, not another call's timeout or abort reason.
    if (current) retire(current, new WorkerError('worker was terminated', { cause: reason }));
    settle(job, { ok: false, reason });
  }

  function spawn(): WorkerState {
    // Resolved before the factory runs: a bad URL must not leave a worker behind.
    let wasmUrl: string | undefined;
    if (options.wasmUrl !== undefined) {
      try {
        wasmUrl = resolveWasmUrl(options.wasmUrl);
      } catch (e) {
        throw new WorkerError('invalid wasmUrl', { cause: e });
      }
    }
    let worker: WorkerLike;
    try {
      worker = (options.worker ?? spawnDefaultWorker)();
    } catch (e) {
      throw new WorkerError('could not create the worker', { cause: e });
    }
    const state: WorkerState = { worker, ready: deferred(), detach: () => {} };
    const onMessage = (event: unknown) => handleMessage(state, (event as { data?: unknown }).data);
    const onError = (event: unknown) => {
      const message = (event as { message?: unknown }).message;
      workerFailed(
        state,
        typeof message === 'string' && message
          ? new WorkerError(`worker error: ${message}`, { cause: message })
          : new WorkerError('worker error', { cause: event }),
      );
    };
    const onMessageError = (event: unknown) =>
      workerFailed(
        state,
        new WorkerError('a message from the worker could not be deserialized', { cause: event }),
      );
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onMessageError);
    state.detach = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onMessageError);
    };
    const init: ToWorker = { type: 'init', v: PROTOCOL_VERSION };
    if (wasmUrl !== undefined) init.wasmUrl = wasmUrl;
    current = state;
    try {
      worker.postMessage(init);
    } catch (e) {
      const failure = new WorkerError('could not initialise the worker', { cause: e });
      retire(state, failure);
      throw failure;
    }
    return state;
  }

  /** Turns raw message data into an action, or a WorkerError if the worker broke the protocol. */
  function interpret(
    data: unknown,
  ):
    | { kind: 'ready' }
    | { kind: 'job'; id: number; outcome: Outcome }
    | { kind: 'failed'; failure: WorkerError } {
    let message: FromWorker;
    try {
      message = parseFromWorker(data);
      switch (message.type) {
        case 'ready':
          return { kind: 'ready' };
        case 'result':
          return {
            kind: 'job',
            id: message.id,
            outcome: {
              ok: true,
              value: toDungeon({
                width: message.width,
                height: message.height,
                seed: message.seed,
                cells: message.cells,
                diagnostics: message.diagnostics,
                rooms: message.rooms,
                entities: message.entities,
                steps: message.steps,
              }),
            },
          };
        case 'error': {
          const error = decodeError(message.error);
          if (message.id === null) {
            return {
              kind: 'failed',
              failure: new WorkerError(`worker failed to start: ${error.message}`, {
                cause: error,
              }),
            };
          }
          return { kind: 'job', id: message.id, outcome: { ok: false, reason: error } };
        }
      }
    } catch (e) {
      return {
        kind: 'failed',
        failure:
          e instanceof WorkerError
            ? e
            : new WorkerError('malformed message from worker', { cause: e }),
      };
    }
  }

  function handleMessage(state: WorkerState, data: unknown): void {
    if (state !== current) return;
    // Only parsing and decoding may throw here; settling happens outside any catch, so a
    // failure further down can never be mistaken for a broken worker or reject another job.
    const action = interpret(data);
    switch (action.kind) {
      case 'ready':
        state.ready.resolve();
        return;
      case 'failed':
        workerFailed(state, action.failure);
        return;
      case 'job': {
        const job = running;
        if (!job || job.id !== action.id) return;
        settle(job, action.outcome);
        return;
      }
    }
  }

  function pump(): void {
    if (disposed || running) return;
    let job = queue.shift();
    // Jobs sharing a signal with the one just aborted see `aborted` before their own listener
    // runs; dispatching them would spawn a worker per job only to terminate it again.
    while (job?.signal?.aborted) {
      finish(job, { ok: false, reason: abortReason(job.signal) });
      job = queue.shift();
    }
    if (!job) return;
    running = job;
    let state: WorkerState;
    try {
      state = current ?? spawn();
    } catch (e) {
      // No worker to be had: fail everything now instead of retrying the factory per job.
      rejectAll(e);
      return;
    }
    const message: ToWorker = {
      type: 'create',
      v: PROTOCOL_VERSION,
      id: job.id,
      design: job.design,
      seed: job.seed,
    };
    if (job.output) message.output = job.output;
    try {
      state.worker.postMessage(message);
    } catch (e) {
      settle(job, { ok: false, reason: e });
      return;
    }
    // Counted from dispatch: time spent waiting in the queue is not the job's fault.
    if (job.timeout !== Number.POSITIVE_INFINITY) {
      const timeout = job.timeout;
      const timer = setTimeout(() => interrupt(job, new TimeoutError(timeout)), timeout);
      job.cleanup.push(() => clearTimeout(timer));
    }
  }

  function abort(job: Job, reason: unknown): void {
    if (running === job) {
      interrupt(job, reason);
      return;
    }
    const index = queue.indexOf(job);
    if (index === -1) return;
    queue.splice(index, 1);
    finish(job, { ok: false, reason });
  }

  async function create(request: DungeonRequest, callOptions: CallOptions = {}): Promise<Dungeon> {
    if (disposed) throw disposedError();
    const timeout = checkTimeout(callOptions.timeout ?? defaultTimeout);
    const seed = resolveSeed(request.seed);
    const output = parseOutput(request.output);
    const { signal } = callOptions;
    if (signal?.aborted) throw abortReason(signal);
    // Snapshot now: a caller mutating a shared design while the job waits must not change it.
    const design =
      typeof request.design === 'string' ? request.design : structuredClone(request.design);
    // Legacy text is left to the core; a config is checked here, before anything is enqueued.
    if (options.validate && typeof design !== 'string') {
      await validateOrThrow(design);
      if (disposed) throw disposedError();
      if (signal?.aborted) throw abortReason(signal);
    }
    return new Promise<Dungeon>((resolve, reject) => {
      const job: Job = {
        id: nextId++,
        design,
        seed,
        output,
        timeout,
        signal,
        resolve,
        reject,
        cleanup: [],
      };
      if (signal) {
        const onAbort = () => abort(job, abortReason(signal));
        signal.addEventListener('abort', onAbort, { once: true });
        job.cleanup.push(() => signal.removeEventListener('abort', onAbort));
      }
      queue.push(job);
      pump();
    });
  }

  async function ready(): Promise<void> {
    if (disposed) throw disposedError();
    const state = current ?? spawn();
    if (defaultTimeout === Number.POSITIVE_INFINITY) return state.ready.promise;
    // The timeout only bounds this call; the worker itself stays (running jobs have their own timers).
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new TimeoutError(defaultTimeout)), defaultTimeout);
      state.ready.promise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (reason: unknown) => {
          clearTimeout(timer);
          reject(reason);
        },
      );
    });
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    const reason = disposedError();
    if (current) retire(current, reason);
    rejectAll(reason);
  }

  return { create, ready, dispose };
}
