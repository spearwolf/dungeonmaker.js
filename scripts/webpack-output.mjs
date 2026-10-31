// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * True for a clean webpack build, and for one whose only warnings are the "asset size limit"
 * hint naming nothing but the wasm file (webpack's default 244 KiB limit is below the 264 KiB
 * wasm). Any other warning, including "entrypoint size limit", or any error fails.
 */
export function webpackBuildAccepted(output) {
  if (/ERROR in/.test(output)) return false;
  if (/compiled successfully/.test(output)) return true;
  const summary = /compiled with (\d+) warnings?/.exec(output);
  if (!summary) return false;
  const warnings = output.split(/^WARNING in /m).slice(1);
  if (warnings.length !== Number(summary[1])) return false;
  return warnings.every((block) => {
    if (!block.startsWith('asset size limit')) return false;
    const assets = /^Assets:\s*\n((?:[ \t]+\S.*\n?)+)/m.exec(block);
    if (!assets) return false;
    const names = assets[1].split('\n').filter((line) => line.trim() !== '');
    return names.length === 1 && /^\s*\S+\.wasm \(/.test(names[0]);
  });
}
