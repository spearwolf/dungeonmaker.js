// SPDX-License-Identifier: GPL-3.0-or-later
// Pure functions that turn the package's JSON schemas into Markdown reference tables.
import { Cell } from 'dungeonmaker-js';
import { ROWS_ALPHABET, toDungeonFile } from 'dungeonmaker-js/export';
import { ASCII_CHARS, DEFAULT_PALETTE } from 'dungeonmaker-js/render';

/**
 * @typedef {{ path: string, type: string, constraints: string, required: boolean, omitted: string, description: string, upstream: string }} FieldRow
 */

/** What a missing optional field of `design.schema.json` means, by path. */
export const OMITTED = Object.freeze({
  $schema: 'ignored',
  rectangles: 'no rectangles',
  population: 'no entities',
  'crawlers.seeds': 'none',
  'crawlers.pairs': 'none',
  'tunnelers.seeds': 'none',
});

/** What a missing optional field of `dungeon.schema.json` means, by path. */
export const DUNGEON_OMITTED = Object.freeze({
  $schema: 'not written by the exporters',
  source: 'origin not recorded',
  'source{designHash}.design': 'design not embedded',
  rooms: 'layer not requested',
  entities: 'layer not requested',
  steps: 'layer not requested',
});

const UPSTREAM = /\s*Upstream:\s*(.+?)\.?\s*$/s;

/** @param {string} description */
function splitDescription(description) {
  const match = UPSTREAM.exec(description);
  if (!match) return { text: description, upstream: '' };
  return { text: description.slice(0, match.index).trim(), upstream: match[1] ?? '' };
}

/** @param {number | undefined} min @param {number | undefined} max @param {number | undefined} exMax */
function range(min, max, exMax) {
  if (min !== undefined && max !== undefined) return `${min} … ${max}`;
  const parts = [];
  if (min !== undefined) parts.push(`≥ ${min}`);
  if (max !== undefined) parts.push(`≤ ${max}`);
  if (exMax !== undefined) parts.push(`< ${exMax}`);
  return parts.join(', ');
}

/** Constraints of a scalar (or enum/const) schema node. */
function scalarConstraints(node) {
  if (node.enum) return `one of ${node.enum.map((v) => `\`${v}\``).join(', ')}`;
  if (node.const !== undefined) return `= \`${JSON.stringify(node.const)}\``;
  const parts = [];
  const r = range(node.minimum, node.maximum, node.exclusiveMaximum);
  if (r) parts.push(r);
  if (node.pattern) parts.push(`pattern \`${node.pattern}\``);
  return parts.join('; ');
}

function scalarType(node) {
  if (node.enum) return 'enum';
  return node.type ?? (node.const !== undefined ? 'const' : 'any');
}

function itemsCount(node) {
  const { minItems: min, maxItems: max } = node;
  if (min !== undefined && max !== undefined)
    return min === max ? `${min} items` : `${min} … ${max} items`;
  if (min !== undefined) return `≥ ${min} item${min === 1 ? '' : 's'}`;
  if (max !== undefined) return `≤ ${max} items`;
  return '';
}

const isObject = (node) => node.type === 'object' || node.properties !== undefined;
const isPrimitive = (node) => !isObject(node) && !node.items && !node.anyOf;

/** An object whose properties are all constants, e.g. the legend (0 … 19 → name). */
function isConstMap(node) {
  const entries = Object.values(node.properties ?? {});
  return entries.length >= 10 && entries.every((p) => p.const !== undefined);
}

/**
 * One row per leaf and per object of a JSON Schema (as written by the package: TypeBox output).
 * Arrays of primitives fold into one row; objects inside arrays get rows of their own
 * (`rectangles[].from.x`); a `oneOf`-style `anyOf` of objects gets one block of rows per variant
 * (`cells{base64}.data`). Rows without an `Upstream:` sentence inherit the nearest ancestor's.
 *
 * @param {any} schema
 * @returns {FieldRow[]}
 */
export function schemaRows(schema) {
  /** @type {FieldRow[]} */
  const rows = [];

  /** @param {any} node @param {string} path @param {boolean} required @param {string} inherited */
  function visit(node, path, required, inherited) {
    const { text, upstream: own } = splitDescription(node.description ?? '');
    const upstream = own || inherited;
    const row = (type, constraints) => ({
      path,
      type,
      constraints,
      required,
      omitted: '',
      description: text,
      upstream,
    });

    if (node.anyOf) {
      const variants = node.anyOf;
      if (variants.every(isObject)) {
        rows.push({ ...row('object', `one of ${variants.length} variants`), upstream: own });
        for (const variant of variants) {
          const tag =
            variant.properties?.encoding?.const ?? Object.keys(variant.properties ?? {})[0];
          children(variant, `${path}{${tag}}`, upstream);
        }
      } else {
        rows.push(
          row(
            [...new Set(variants.map(scalarType))].join(' | '),
            variants.map(scalarConstraints).filter(Boolean).join('; '),
          ),
        );
      }
      return;
    }

    if (node.items) {
      const items = node.items;
      if (isObject(items)) {
        rows.push(row('object[]', itemsCount(node)));
        children(items, `${path}[]`, upstream);
      } else {
        const itemC = scalarConstraints(items);
        rows.push(
          row(
            `${scalarType(items)}[]`,
            [itemsCount(node), itemC ? `items: ${itemC}` : ''].filter(Boolean).join('; '),
          ),
        );
      }
      return;
    }

    if (isObject(node)) {
      if (isConstMap(node)) {
        const keys = Object.keys(node.properties);
        rows.push(row('object', `keys \`${keys[0]}\` … \`${keys[keys.length - 1]}\``));
        return;
      }
      rows.push(row('object', ''));
      children(node, path, upstream);
      return;
    }

    if (isPrimitive(node)) rows.push(row(scalarType(node), scalarConstraints(node)));
  }

  /** @param {any} node @param {string} prefix @param {string} upstream */
  function children(node, prefix, upstream) {
    const required = new Set(node.required ?? []);
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      visit(child, prefix ? `${prefix}.${key}` : key, required.has(key), upstream);
    }
  }

  children(schema, '', '');
  return rows;
}

/** Escapes a table cell: `|` everywhere, `<` (Vue would parse it as a tag) outside code spans. */
function cell(text) {
  return text
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2 === 1
        ? part.replaceAll('|', '\\|')
        : part.replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('{{', '&#123;&#123;'),
    )
    .join('')
    .replaceAll('\n', ' ');
}

const code = (text) => (text ? `\`${text.replaceAll('|', '\\|')}\`` : '');

/**
 * Markdown table: Field | Type | Constraints | Default | Description | Upstream.
 *
 * @param {readonly FieldRow[]} rows
 * @param {Readonly<Record<string, string>>} [omitted] meaning of a missing optional field, by path
 */
export function fieldTable(rows, omitted = OMITTED) {
  const lines = [
    '| Field | Type | Constraints | Default | Description | Upstream |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    const fallback = omitted[r.path];
    const dflt = r.required
      ? 'required'
      : fallback
        ? `optional (omitted: ${fallback})`
        : 'optional';
    lines.push(
      `| ${[code(r.path), code(r.type), cell(r.constraints), cell(dflt), cell(r.description), code(r.upstream)].join(' | ')} |`,
    );
  }
  return lines.join('\n');
}

/** Markdown table of the 20 cell values: Value | Cell | JSON legend | ASCII | rows char | Colour. */
export function cellLegendTable() {
  const names = Object.keys(Cell);
  const legend = toDungeonFile({
    width: names.length,
    height: 1,
    seed: 1,
    cells: Uint8Array.from(names.map((_, i) => i)),
  }).legend;
  const char = (c) => (c === ' ' ? '*space*' : `\`${c === '|' ? '\\|' : c}\``);
  const lines = [
    '| Value | Cell | JSON legend | ASCII | `rows` char | Colour |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  names.forEach((name, i) => {
    const jsonName = legend[String(i)];
    const colour = DEFAULT_PALETTE[jsonName];
    const swatch = `<span style="display:inline-block;width:.8em;height:.8em;border:1px solid #888;background:${colour};vertical-align:baseline"></span>`;
    lines.push(
      `| ${i} | ${name} | \`${jsonName}\` | ${char(ASCII_CHARS[i] ?? ' ')} | ${char(ROWS_ALPHABET[i] ?? ' ')} | ${swatch} \`${colour}\` |`,
    );
  });
  return lines.join('\n');
}
