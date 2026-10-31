// SPDX-License-Identifier: GPL-3.0-or-later
// Hand-written declarations for reference.mjs (the site tsconfig has no allowJs).

export interface FieldRow {
  path: string;
  type: string;
  constraints: string;
  required: boolean;
  omitted: string;
  description: string;
  upstream: string;
}

export const OMITTED: Readonly<Record<string, string>>;
export const DUNGEON_OMITTED: Readonly<Record<string, string>>;
export function schemaRows(schema: unknown): FieldRow[];
export function fieldTable(
  rows: readonly FieldRow[],
  omitted?: Readonly<Record<string, string>>,
): string;
export function cellLegendTable(): string;
