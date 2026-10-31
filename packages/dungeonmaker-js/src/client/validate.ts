// SPDX-License-Identifier: GPL-3.0-or-later
import { DesignValidationError } from '../errors.js';
import type { DesignConfig } from '../schema/model.js';

/**
 * The only runtime path from the client to TypeBox: loaded on demand, so a client that
 * never asks for `validate: true` never fetches the schema.
 */
export async function validateOrThrow(design: DesignConfig): Promise<void> {
  const { validateDesign } = await import('../schema/validate.js');
  const issues = validateDesign(design);
  if (issues.length > 0) throw new DesignValidationError(issues);
}
