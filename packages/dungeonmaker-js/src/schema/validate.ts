// SPDX-License-Identifier: GPL-3.0-or-later
import Value from 'typebox/value';
import { checkDesign } from '../config/check.js';
import type { DesignIssue } from '../errors.js';
import { type DesignConfig, DesignConfigSchema } from './model.js';

/** Escapes one reference token for a JSON Pointer (RFC 6901). */
const token = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');

const names = (list: unknown): string[] => (Array.isArray(list) ? list.map(String) : []);

/**
 * Structural validation against the TypeBox model, then the semantic checks of
 * `checkDesign`. The semantic pass only runs on structurally valid input, because
 * it assumes well-typed values. At most one issue per path.
 */
export function validateDesign(value: unknown): DesignIssue[] {
  const seen = new Set<string>();
  const issues: DesignIssue[] = [];
  const add = (path: string, message: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    issues.push({ path, message });
  };

  // `required` and `additionalProperties` first: an extra property also produces a generic
  // "schema is false" error at its own path, which would otherwise win the path.
  const errors = [...Value.Errors(DesignConfigSchema, value)];
  for (const error of errors) {
    const params = error.params as Record<string, unknown>;
    if (error.keyword === 'required') {
      for (const name of names(params.requiredProperties))
        add(`${error.instancePath}/${token(name)}`, 'missing required property');
    } else if (error.keyword === 'additionalProperties') {
      for (const name of names(params.additionalProperties))
        add(`${error.instancePath}/${token(name)}`, 'unknown property');
    }
  }
  for (const error of errors) {
    if (error.keyword !== 'required' && error.keyword !== 'additionalProperties')
      add(error.instancePath, error.message);
  }
  if (issues.length > 0) return issues;
  return checkDesign(value as DesignConfig);
}
