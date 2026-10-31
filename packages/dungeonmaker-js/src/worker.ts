// SPDX-License-Identifier: GPL-3.0-or-later
import { loadCore } from './core/core.js';
import { createWorkerHandler } from './worker/handler.js';

declare const self: {
  postMessage(message: unknown, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

const handle = createWorkerHandler({
  post: (message, transfer) => self.postMessage(message, transfer),
  loadCore,
});

self.addEventListener('message', (event) => void handle(event.data));
