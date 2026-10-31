// SPDX-License-Identifier: GPL-3.0-or-later

import type { FromWorker, ToWorker } from '../../src/protocol.js';

export class FakeWorker extends EventTarget {
  readonly posted: ToWorker[] = [];
  terminated = false;
  onPost?: (message: ToWorker) => void;

  postMessage(data: unknown, transfer?: Transferable[]): void {
    // Like a real worker: structured clone, throws DataCloneError for functions etc.
    const copy = structuredClone(data, transfer ? { transfer } : undefined) as ToWorker;
    this.posted.push(copy);
    this.onPost?.(copy);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(message: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: message }));
  }

  crash(message: string): void {
    const event = new Event('error');
    Object.defineProperty(event, 'message', { value: message });
    this.dispatchEvent(event);
  }

  messageError(): void {
    this.dispatchEvent(new Event('messageerror'));
  }
}

export function resultFor(worker: FakeWorker, id: number, width = 4, height = 3): FromWorker {
  const request = worker.posted.find((m) => m.type === 'create' && m.id === id);
  if (request?.type !== 'create') throw new Error(`no create message with id ${id}`);
  return {
    type: 'result',
    v: 1,
    id,
    width,
    height,
    seed: request.seed,
    cells: new Uint8Array(width * height),
    diagnostics: [],
  };
}

export function autoWorker(): FakeWorker {
  const worker = new FakeWorker();
  worker.onPost = (message) => {
    queueMicrotask(() => {
      if (message.type === 'init') worker.reply({ type: 'ready', v: 1 });
      else worker.reply(resultFor(worker, message.id, 4, 3));
    });
  };
  return worker;
}

export function fakeFactory(make: () => FakeWorker = () => new FakeWorker()): {
  factory: () => Worker;
  workers: FakeWorker[];
} {
  const workers: FakeWorker[] = [];
  return {
    factory: () => {
      const worker = make();
      workers.push(worker);
      return worker as unknown as Worker;
    },
    workers,
  };
}
