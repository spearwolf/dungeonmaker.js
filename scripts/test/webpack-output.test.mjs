// SPDX-License-Identifier: GPL-3.0-or-later
import { webpackBuildAccepted } from '../webpack-output.mjs';

const hint = (
  assets,
  kind = 'asset size limit',
) => `WARNING in ${kind}: The following asset(s) exceed the recommended size limit (244 KiB).
This can impact web performance.
Assets: 
${assets.map((a) => `  ${a}`).join('\n')}
`;

test('a clean build is accepted', () => {
  expect(webpackBuildAccepted('webpack 5.112.2 compiled successfully in 900 ms')).toBe(true);
});

test('only the wasm size hint is tolerated', () => {
  const out = `${hint(['b837.wasm (264 KiB)'])}\nwebpack 5.112.2 compiled with 1 warning in 1274 ms\n`;
  expect(webpackBuildAccepted(out)).toBe(true);
});

test('another asset in the hint, an entrypoint hint, other warnings and errors fail', () => {
  const tail = (n) => `\nwebpack 5.112.2 compiled with ${n} warning${n === 1 ? '' : 's'} in 1 ms\n`;
  expect(webpackBuildAccepted(hint(['b837.wasm (264 KiB)', 'main.js (300 KiB)']) + tail(1))).toBe(
    false,
  );
  expect(webpackBuildAccepted(hint(['main.js (300 KiB)']) + tail(1))).toBe(false);
  expect(
    webpackBuildAccepted(hint(['b837.wasm (264 KiB)'], 'entrypoint size limit') + tail(1)),
  ).toBe(false);
  expect(
    webpackBuildAccepted(
      hint(['b837.wasm (264 KiB)']) +
        hint(['b837.wasm (264 KiB)'], 'entrypoint size limit') +
        tail(2),
    ),
  ).toBe(false);
  expect(webpackBuildAccepted(`WARNING in something else\n${tail(1)}`)).toBe(false);
  expect(webpackBuildAccepted(`ERROR in x\n${hint(['b.wasm (264 KiB)'])}${tail(1)}`)).toBe(false);
  expect(webpackBuildAccepted('nothing useful')).toBe(false);
});
