// SPDX-License-Identifier: GPL-3.0-or-later

import type { DesignIssue } from './errors.js';
import { DesignValidationError, GenerationError, WorkerError } from './errors.js';
import {
  type EntityLayer,
  type OutputOptions,
  parseOutput,
  type RoomLayer,
  type StepLayer,
} from './layers.js';
import type { DesignConfig } from './schema/model.js';

export const PROTOCOL_VERSION = 1;

/** An error reduced to structured-cloneable fields (never `cause` or `stack`). */
export interface WireError {
  name: string;
  message: string;
  issues?: DesignIssue[];
  diagnostics?: string[];
}

export type ToWorker =
  | { type: 'init'; v: 1; wasmUrl?: string }
  | {
      type: 'create';
      v: 1;
      id: number;
      design: DesignConfig | string;
      seed: number;
      output?: OutputOptions;
    };

export type FromWorker =
  | { type: 'ready'; v: 1 }
  | {
      type: 'result';
      v: 1;
      id: number;
      width: number;
      height: number;
      seed: number;
      cells: Uint8Array;
      diagnostics: string[];
      rooms?: RoomLayer;
      entities?: EntityLayer;
      steps?: StepLayer;
    }
  | { type: 'error'; v: 1; id: number | null; error: WireError };

export function encodeError(error: unknown): WireError {
  if (error instanceof DesignValidationError) {
    return {
      name: error.name,
      message: error.message,
      issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
      diagnostics: [...error.diagnostics],
    };
  }
  if (error instanceof GenerationError) {
    return { name: error.name, message: error.message, diagnostics: [...error.diagnostics] };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'Error', message: String(error) };
}

export function decodeError(wire: WireError): Error {
  switch (wire.name) {
    case 'DesignValidationError':
      return new DesignValidationError(
        wire.issues ?? [{ path: '', message: wire.message }],
        wire.diagnostics ?? [],
      );
    case 'GenerationError':
      return new GenerationError(wire.message, wire.diagnostics ?? []);
    case 'RangeError':
      return new RangeError(wire.message);
    default:
      return new Error(wire.message);
  }
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null;
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isNonNegInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function versionProblem(data: Record<string, unknown>): string | undefined {
  return data.v === PROTOCOL_VERSION
    ? undefined
    : `protocol version ${String(data.v)}, expected ${PROTOCOL_VERSION}`;
}

/** Validates a message received by the worker. Throws a plain Error naming the problem. */
export function parseToWorker(data: unknown): ToWorker {
  if (!isRecord(data)) throw new Error('message to worker is not an object');
  const problem = versionProblem(data);
  if (problem) throw new Error(problem);
  switch (data.type) {
    case 'init':
      if (data.wasmUrl !== undefined && typeof data.wasmUrl !== 'string') {
        throw new Error('init: wasmUrl must be a string');
      }
      return data as ToWorker;
    case 'create':
      if (!isId(data.id)) throw new Error('create: id must be an integer >= 1');
      if (typeof data.design !== 'string' && !isRecord(data.design)) {
        throw new Error('create: design must be a string or an object');
      }
      if (typeof data.seed !== 'number') throw new Error('create: seed must be a number');
      parseOutput(data.output);
      return data as ToWorker;
    default:
      throw new Error(`unknown message type ${String(data.type)}`);
  }
}

/** Checks the optional layers of a result: type and length of every typed array. */
function checkLayers(data: Record<string, unknown>, area: number): void {
  const { rooms, entities, steps } = data;
  if (rooms !== undefined) {
    if (
      !isRecord(rooms) ||
      !(rooms.roomIds instanceof Uint16Array) ||
      rooms.roomIds.length !== area ||
      !Array.isArray(rooms.rooms)
    ) {
      throw new WorkerError('result: rooms must hold a Uint16Array of width * height and a list');
    }
  }
  if (entities !== undefined && !Array.isArray(entities)) {
    throw new WorkerError('result: entities must be an array');
  }
  if (steps !== undefined) {
    if (
      !isRecord(steps) ||
      !(steps.offsets instanceof Uint32Array) ||
      !(steps.index instanceof Uint32Array) ||
      !(steps.cell instanceof Uint8Array) ||
      steps.offsets.length < 1 ||
      steps.offsets[steps.offsets.length - 1] !== steps.index.length ||
      steps.cell.length !== steps.index.length
    ) {
      throw new WorkerError('result: steps must be consistent offsets, index and cell arrays');
    }
  }
}

/** Validates a message received from the worker. Throws WorkerError. */
export function parseFromWorker(data: unknown): FromWorker {
  if (!isRecord(data)) throw new WorkerError('message from worker is not an object');
  const problem = versionProblem(data);
  if (problem) throw new WorkerError(problem);
  switch (data.type) {
    case 'ready':
      return data as FromWorker;
    case 'result': {
      if (!isId(data.id)) throw new WorkerError('result: id must be an integer >= 1');
      const { width, height, seed, cells, diagnostics } = data;
      if (!isNonNegInt(width) || !isNonNegInt(height))
        throw new WorkerError('result: invalid dimensions');
      if (typeof seed !== 'number') throw new WorkerError('result: seed must be a number');
      if (!(cells instanceof Uint8Array) || cells.length !== width * height) {
        throw new WorkerError('result: cells must be a Uint8Array of width * height');
      }
      if (!Array.isArray(diagnostics))
        throw new WorkerError('result: diagnostics must be an array');
      checkLayers(data, width * height);
      return data as FromWorker;
    }
    case 'error': {
      if (data.id !== null && !isId(data.id))
        throw new WorkerError('error: id must be null or an integer >= 1');
      const error = data.error;
      if (!isRecord(error) || typeof error.name !== 'string' || typeof error.message !== 'string') {
        throw new WorkerError('error: malformed error payload');
      }
      return data as FromWorker;
    }
    default:
      throw new WorkerError(`unknown message type ${String(data.type)}`);
  }
}
