// SPDX-License-Identifier: GPL-3.0-or-later
import { createDiagnostics } from '../src/core/diagnostics.js';

test('caps collected lines and reports how many were suppressed', () => {
  const d = createDiagnostics(200);
  for (let i = 0; i < 205; i++) d.push(`line ${i}`);
  const lines = d.take();
  expect(lines).toHaveLength(201);
  expect(lines[199]).toBe('line 199');
  expect(lines[200]).toBe('… 5 more lines suppressed');
  expect(d.take()).toEqual([]);
});

test('returns all lines below the limit unchanged', () => {
  const d = createDiagnostics();
  d.push('a');
  d.push('b');
  expect(d.take()).toEqual(['a', 'b']);
});
