// SPDX-License-Identifier: GPL-3.0-or-later
import {
  type DesignConfig,
  type DesignIssue,
  DesignValidationError,
  toDesignText,
} from 'dungeonmaker-js';
import { validateDesign } from 'dungeonmaker-js/schema';
import { pointerRanges, type Range, rangeFor } from './pointer';

export interface LintIssue {
  /** JSON Pointer of the value the issue is about; `''` is the whole design. */
  path: string;
  message: string;
  from: number;
  to: number;
}

export interface LintResult {
  /** The design, without `$schema`; only present when there are no issues. */
  design?: DesignConfig;
  issues: readonly LintIssue[];
}

/**
 * Checks a design file text the way the package and the CLI do: JSON syntax first, then
 * `validateDesign`, then `toDesignText` (which adds the checks only the serializer makes, such
 * as int32 ranges and list terminators). Every issue is placed on the value it names, or on its
 * nearest existing ancestor.
 */
export function lintDesign(text: string): LintResult {
  let ranges: Map<string, Range>;
  try {
    ranges = pointerRanges(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { issues: [{ path: '', message, from: 0, to: text.length }] };
  }
  const place = (issues: readonly DesignIssue[]): LintResult => ({
    issues: issues.map(({ path, message }) => ({ path, message, ...rangeFor(ranges, path) })),
  });

  const value: unknown = JSON.parse(text);
  const schemaIssues = validateDesign(value);
  if (schemaIssues.length > 0) return place(schemaIssues);

  const { $schema: _, ...design } = value as DesignConfig & { $schema?: string };
  try {
    toDesignText(design);
  } catch (error) {
    if (error instanceof DesignValidationError) return place(error.issues);
    return place([{ path: '', message: error instanceof Error ? error.message : String(error) }]);
  }
  return { design, issues: [] };
}
