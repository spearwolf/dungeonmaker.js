// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Fills a file name template. Placeholders: `{name}` and `{seed}`.
 *
 * @throws RangeError for an unknown placeholder, a path separator or `..` in the result, and
 * an empty result: the template must name a file, never a path.
 */
export function renderName(template: string, values: { name: string; seed: number }): string {
  const result = template.replace(/\{([^{}]*)\}/g, (_, key: string) => {
    if (key === 'name') return values.name;
    if (key === 'seed') return String(values.seed);
    throw new RangeError(`Unknown placeholder {${key}} in name template "${template}"`);
  });
  if (result === '' || /[/\\]/.test(result) || result.includes('..')) {
    throw new RangeError(
      `Invalid file name "${result}" from template "${template}": it must be non-empty and contain no "/", "\\" or ".."`,
    );
  }
  return result;
}
