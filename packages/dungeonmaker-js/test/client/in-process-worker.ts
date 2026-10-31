// SPDX-License-Identifier: GPL-3.0-or-later
import { loadCore } from '../../src/core/core.js';
import { createWorkerHandler } from '../../src/worker/handler.js';

/**
 * A Worker stand-in that drives the real message handler and the real Wasm core in the
 * current thread. Like a real worker it delivers asynchronously, structured-clones every
 * message with its transfer list in both directions, and stops delivering on terminate().
 */
export function inProcessWorker(): Worker {
  const target = new EventTarget();
  let terminated = false;
  const handle = createWorkerHandler({
    post: (message, transfer) => {
      const copy = structuredClone(message, { transfer });
      setTimeout(() => {
        if (!terminated) target.dispatchEvent(new MessageEvent('message', { data: copy }));
      }, 0);
    },
    loadCore,
  });
  const worker = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    postMessage(data: unknown, transfer: Transferable[] = []): void {
      const copy = structuredClone(data, { transfer });
      setTimeout(() => {
        if (!terminated) void handle(copy);
      }, 0);
    },
    terminate(): void {
      terminated = true;
    },
  };
  return worker as unknown as Worker;
}
