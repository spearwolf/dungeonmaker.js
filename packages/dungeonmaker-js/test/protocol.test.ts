// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from 'vitest';
import { DesignValidationError, GenerationError, WorkerError } from '../src/errors.js';
import { decodeError, encodeError, parseFromWorker, parseToWorker } from '../src/protocol.js';

test('DesignValidationError survives the round trip with issues and diagnostics', () => {
  const e = decodeError(
    encodeError(
      new DesignValidationError([{ path: '/map/width', message: 'too small' }], ['warn']),
    ),
  );
  expect(e).toBeInstanceOf(DesignValidationError);
  expect((e as DesignValidationError).issues).toEqual([
    { path: '/map/width', message: 'too small' },
  ]);
  expect((e as DesignValidationError).diagnostics).toEqual(['warn']);
});

test('GenerationError keeps message and diagnostics', () => {
  const e = decodeError(encodeError(new GenerationError('aborted', ['d1', 'd2'])));
  expect(e).toBeInstanceOf(GenerationError);
  expect(e.message).toBe('aborted');
  expect((e as GenerationError).diagnostics).toEqual(['d1', 'd2']);
});

test('RangeError stays a RangeError', () => {
  const e = decodeError(encodeError(new RangeError('seed out of range')));
  expect(e).toBeInstanceOf(RangeError);
  expect(e.message).toBe('seed out of range');
});

test('anything else becomes a plain Error with its message', () => {
  expect(decodeError(encodeError('boom'))).toEqual(new Error('boom'));
  expect(decodeError({ name: 'Weird', message: 'x' }).message).toBe('x');
});

test('encodeError output is structured-cloneable', () => {
  expect(() =>
    structuredClone(encodeError(new GenerationError('x', ['d'], { cause: () => 1 }))),
  ).not.toThrow();
});

test.each([[null], [{}], [{ type: 'result', v: 2, id: 1 }], [{ type: 'nope', v: 1 }]])(
  'parseFromWorker rejects %j with WorkerError',
  (data) => {
    expect(() => parseFromWorker(data)).toThrow(WorkerError);
  },
);

test('parseFromWorker names the version mismatch', () => {
  expect(() => parseFromWorker({ type: 'ready', v: 2 })).toThrow(/protocol version 2.*expected 1/);
});

test('parseFromWorker accepts well-formed messages', () => {
  expect(parseFromWorker({ type: 'ready', v: 1 }).type).toBe('ready');
  const result = {
    type: 'result',
    v: 1,
    id: 1,
    width: 2,
    height: 1,
    seed: 5,
    cells: new Uint8Array(2),
    diagnostics: [],
  };
  expect(parseFromWorker(result)).toBe(result);
  const err = { type: 'error', v: 1, id: null, error: { name: 'Error', message: 'x' } };
  expect(parseFromWorker(err)).toBe(err);
});

test('parseFromWorker rejects a result whose cells do not match the dimensions', () => {
  const bad = {
    type: 'result',
    v: 1,
    id: 1,
    width: 3,
    height: 3,
    seed: 5,
    cells: new Uint8Array(2),
    diagnostics: [],
  };
  expect(() => parseFromWorker(bad)).toThrow(WorkerError);
});

test.each([[{ type: 'create', v: 1, id: 0, design: '', seed: 1 }], [{ type: 'init', v: 3 }]])(
  'parseToWorker rejects %j',
  (data) => {
    expect(() => parseToWorker(data)).toThrow();
  },
);

test('parseToWorker names the version mismatch like parseFromWorker', () => {
  expect(() => parseToWorker({ type: 'init', v: 3 })).toThrow(/protocol version 3.*expected 1/);
});

test('parseToWorker accepts well-formed messages', () => {
  expect(parseToWorker({ type: 'init', v: 1 }).type).toBe('init');
  const create = { type: 'create', v: 1, id: 2, design: 'D 1', seed: 9 };
  expect(parseToWorker(create)).toBe(create);
});
