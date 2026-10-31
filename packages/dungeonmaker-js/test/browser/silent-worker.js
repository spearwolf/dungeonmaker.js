// SPDX-License-Identifier: GPL-3.0-or-later
// A worker that never answers: no timer, no load, only an ignored message listener.
self.addEventListener('message', () => {});
