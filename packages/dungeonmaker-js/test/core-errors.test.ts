// SPDX-License-Identifier: GPL-3.0-or-later
import {
  DesignValidationError,
  type DungeonMakerCore,
  GenerationError,
  loadCore,
} from '../src/core.js';
import { caught, dropRecord, fnv1a32, golden, readDesign, withDimensions } from './helpers.js';

function validationError(core: DungeonMakerCore, text: string): DesignValidationError {
  const e = caught(() => core.generate(text, 1));
  expect(e).toBeInstanceOf(DesignValidationError);
  return e as DesignValidationError;
}

let core: DungeonMakerCore;
beforeAll(async () => {
  core = await loadCore();
});

test('empty design is a validation error', () => {
  const e = validationError(core, '');
  expect(e.issues[0]?.message).toMatch(/missing D record/);
  expect(core.aborted).toBe(false);
  expect(fnv1a32(core.generate(readDesign('design'), 42).cells)).toBe(golden['design:42']);
});

test('truncated D record does not hang', { timeout: 5_000 }, () => {
  expect(validationError(core, 'D 50 50 CLOSED 12 18 NO').issues[0]?.message).toMatch(/XX/);
});

test('parser rejection carries library output', () => {
  const e = validationError(core, `${readDesign('design')}\nWPX\n`);
  expect(e.issues[0]?.message).toMatch(/rejected by parser/);
  expect(e.diagnostics.some((line) => line.includes('Expected WP1'))).toBe(true);
});

test('missing BC record', () => {
  const text = readDesign('design')
    .split('\n')
    .filter((line) => !line.startsWith('BC'))
    .join('\n');
  expect(validationError(core, text).issues[0]?.message).toMatch(/BC record must have 11 entries/);
});

test('oversized map', () => {
  const text = withDimensions(readDesign('design'), 5000, 5000);
  expect(validationError(core, text).issues[0]?.message).toMatch(/3\.\.4096/);
});

// A builder below the active generation would make generate() loop forever; the bridge
// rejects such raw design text before generating. Without that check these tests hang.
test.each([
  [
    'WS',
    `${readDesign('design5')}\nWS 50 50 NO NO 0 20 -1 3 1 1 0 30 0 60 40\n`,
    /WS crawler generation/,
  ],
  [
    'WP',
    `${readDesign('design5')}\nWP1 50 50 NO NO 0 20 0 3 2 7 0 30 0 50 40\nWP2 50 50 SO SO 0 20 -1 3 2 7 0 30 0 50 40\n`,
    /WP crawler generation/,
  ],
  [
    'U',
    `${readDesign('design')}\nU 40 2 EA EA 0 16 -1 5 1 25 50 30 100 100 100\n`,
    /U tunneler generation/,
  ],
  ['M', `${dropRecord(readDesign('design'), 'M')}\nM 20 40 90 -1 0 0 0.6 2\n`, /sizeUpGenDelay/],
])('negative generation in %s is rejected instead of hanging', (_tag, text, message) => {
  expect(validationError(core, text).issues[0]?.message).toMatch(message);
  expect(core.aborted).toBe(false);
});

test('non-ASCII text is marshalled as UTF-8', () => {
  // The last record must matter: a buffer sized in UTF-16 units instead of UTF-8 bytes
  // silently cuts off the end of the text.
  const ascii = `${readDesign('design')}R   10   10   20   20   G_OPEN\n`;
  const unicode = `XX Drachenhöhle 🐉 – ünïcödé\n${ascii}`;
  const expected = fnv1a32(core.generate(ascii, 42).cells);
  expect(expected).not.toBe(golden['design:42']);
  expect(fnv1a32(core.generate(unicode, 42).cells)).toBe(expected);
});

test('assert abort becomes GenerationError and is recoverable', async () => {
  const own = await loadCore({ wasmModule: core.wasmModule });
  const broken = `${readDesign('design')}\nWS   500    500    WE   SW     0     15      2    4   1    7   0     20    0     60    10\n`;
  const e = caught(() => own.generate(broken, 1));
  expect(e).toBeInstanceOf(GenerationError);
  const g = e as GenerationError;
  expect(`${g.message}\n${g.diagnostics.join('\n')}`).toMatch(/Assertion/);
  expect(own.aborted).toBe(true);
  expect(process.exitCode ?? 0).toBe(0);

  const again = caught(() => own.generate(readDesign('design'), 42));
  expect(again).toBeInstanceOf(GenerationError);
  expect((again as Error).message).toMatch(/aborted/);

  const fresh = await loadCore({ wasmModule: own.wasmModule });
  expect(fnv1a32(fresh.generate(readDesign('design'), 42).cells)).toBe(golden['design:42']);
});

test('loadCore rejects instead of hanging when instantiation fails', {
  timeout: 5_000,
}, async () => {
  // A valid module that imports zz.zz, which the Emscripten glue does not provide.
  const bytes = new Uint8Array([
    0x00,
    0x61,
    0x73,
    0x6d,
    0x01,
    0x00,
    0x00,
    0x00, // magic, version
    0x01,
    0x04,
    0x01,
    0x60,
    0x00,
    0x00, // type section: () -> ()
    0x02,
    0x09,
    0x01,
    0x02,
    0x7a,
    0x7a,
    0x02,
    0x7a,
    0x7a,
    0x00,
    0x00, // import zz.zz func 0
  ]);
  await expect(loadCore({ wasmModule: new WebAssembly.Module(bytes) })).rejects.toThrow();
});
