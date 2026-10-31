// SPDX-License-Identifier: GPL-3.0-or-later
import type { DesignConfig } from '../schema/model.js';

/**
 * A recursive partial of `T` over plain objects. Arrays are replaced as a whole, so their
 * element type is kept as is; `undefined` leaves the base value untouched.
 */
export type DesignPatch<T = DesignConfig> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DesignPatch<T[K]> | undefined }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function merge(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || FORBIDDEN_KEYS.has(key)) continue;
    const current = Object.hasOwn(target, key) ? target[key] : undefined;
    if (isPlainObject(value)) {
      // Merge into the base object or into a fresh one: nothing is shared with the patch,
      // and nested `undefined` values are skipped there as well.
      const into = isPlainObject(current) ? current : {};
      merge(into, value);
      target[key] = into;
    } else {
      target[key] = structuredClone(value);
    }
  }
}

/**
 * Derives a design from `base`: plain objects merge deeply, arrays and primitives from
 * `patch` replace the base value, `undefined` is skipped. The result shares nothing with
 * `base` or `patch`. Does not validate; `toDesignText` does.
 *
 * `base` and `patch` must be JSON-like plain data (structured-cloneable), because both are
 * copied with `structuredClone`. A class instance does not throw but arrives as a plain
 * object without its prototype and private fields.
 *
 * @throws DOMException named `DataCloneError` (not a `DesignValidationError`) if a value
 *   cannot be cloned at all, such as a function or a symbol.
 */
export function extendDesign(base: DesignConfig, patch: DesignPatch): DesignConfig {
  const result = structuredClone(base);
  merge(result as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  return result;
}
