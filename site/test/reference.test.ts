// SPDX-License-Identifier: GPL-3.0-or-later
import designSchema from 'dungeonmaker-js/design.schema.json';
import dungeonSchema from 'dungeonmaker-js/dungeon.schema.json';
import { cellLegendTable, fieldTable, OMITTED, schemaRows } from '../scripts/reference.mjs';

test('every field of the design schema has a row with its upstream record', () => {
  const rows = schemaRows(designSchema);
  expect(rows.find((r) => r.path === 'map.width')).toMatchObject({
    type: 'integer',
    required: true,
    upstream: 'D dimY',
  });
  expect(rows.find((r) => r.path === 'rectangles[].from.x')).toMatchObject({
    upstream: 'R sX sY',
  });
  expect(rows.find((r) => r.path === 'spawnDelay.crawler')).toMatchObject({
    type: 'integer[]',
    upstream: 'BC',
  });
  expect(rows.some((r) => r.path.startsWith('spawnDelay.crawler['))).toBe(false);
  // Only $schema and the population containers lack a record; every population leaf has one.
  const missing = rows.filter((r) => r.upstream === '');
  expect(
    missing.every(
      (r) => r.path === '$schema' || (r.path.startsWith('population') && r.type === 'object'),
    ),
  ).toBe(true);
});

test('the Upstream sentence is split off the description', () => {
  const row = schemaRows(designSchema).find((r) => r.path === 'map.width');
  expect(row?.description).toBe('Map width in cells (columns).');
});

test('every optional field explains what omitting it means', () => {
  for (const row of schemaRows(designSchema).filter((r) => !r.required)) {
    expect(OMITTED[row.path], row.path).toBeDefined();
  }
});

test('the dungeon file schema yields rows for the layers and the cell encodings', () => {
  const paths = schemaRows(dungeonSchema).map((r) => r.path);
  expect(paths).toContain('width');
  expect(paths).toContain('cells{base64}.data');
  expect(paths).toContain('rooms.rooms[].bounds.x');
  expect(paths).toContain('steps.offsets');
});

test('field tables escape pipes and angle brackets outside code spans', () => {
  const table = fieldTable([
    {
      path: 'a',
      type: 'enum',
      constraints: 'x | y',
      required: false,
      omitted: '',
      description: 'See `<b>|` and <i>.',
      upstream: '',
    },
  ]);
  expect(table).toContain('x \\| y');
  expect(table).toContain('`<b>\\|`');
  expect(table).toContain('&lt;i>');
});

test('the cell legend lists all 20 cells with the dungeon-file names', () => {
  const table = cellLegendTable();
  expect(table.split('\n').filter((l) => /^\| \d+ \|/.test(l))).toHaveLength(20);
  expect(table).toContain('| 0 | Open | `open` |');
  expect(table).toContain('| 19 | Column | `column` |');
});
