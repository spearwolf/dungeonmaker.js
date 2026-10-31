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

function merge(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = target[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      merge(current, value);
    } else {
      target[key] = structuredClone(value);
    }
  }
}

/**
 * Derives a design from `base`: plain objects merge deeply, arrays and primitives from
 * `patch` replace the base value, `undefined` is skipped. The result shares nothing with
 * `base` or `patch`. Does not validate; `toDesignText` does.
 */
export function extendDesign(base: DesignConfig, patch: DesignPatch): DesignConfig {
  const result = structuredClone(base);
  merge(result as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  return result;
}
