// SPDX-License-Identifier: GPL-3.0-or-later

/** One problem found in a design. `path` is a JSON path for configs, '' for design text. */
export interface DesignIssue {
  readonly path: string;
  readonly message: string;
}

/** The design is invalid; nothing was generated. */
export class DesignValidationError extends Error {
  override readonly name = 'DesignValidationError';
  readonly issues: readonly DesignIssue[];
  readonly diagnostics: readonly string[];

  constructor(issues: readonly DesignIssue[], diagnostics: readonly string[] = []) {
    super(issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('; '));
    this.issues = issues;
    this.diagnostics = diagnostics;
  }
}

/** The WebAssembly core aborted (e.g. a failed library assert). */
export class GenerationError extends Error {
  override readonly name = 'GenerationError';
  readonly diagnostics: readonly string[];

  constructor(message: string, diagnostics: readonly string[] = [], options?: ErrorOptions) {
    super(message, options);
    this.diagnostics = diagnostics;
  }
}
