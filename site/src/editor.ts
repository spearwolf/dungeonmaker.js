// SPDX-License-Identifier: GPL-3.0-or-later
import { json, jsonLanguage } from '@codemirror/lang-json';
import { type Diagnostic, linter } from '@codemirror/lint';
import { hoverTooltip } from '@codemirror/view';
import { basicSetup, EditorView } from 'codemirror';
import {
  getJsonPointers,
  jsonCompletion,
  jsonSchemaHover,
  stateExtensions,
} from 'codemirror-json-schema';
import schema from 'dungeonmaker-js/design.schema.json';
import { type LintResult, lintDesign } from './design-lint';

/** CodeMirror waits this long after the last change before it lints. */
const LINT_DELAY = 300;

export interface EditorHandle {
  getText(): string;
  setText(text: string): void;
  dispose(): void;
}

export interface EditorOptions {
  doc: string;
  /** Every lint result, right after the linter ran on the current text. */
  onLint(result: LintResult): void;
  /** The text changed; a lint result for it follows after the debounce. */
  onChange?(): void;
}

type DocumentParser = NonNullable<NonNullable<Parameters<typeof jsonCompletion>[0]>['jsonParser']>;

/**
 * The document parser for completion. The library's default falls back to a best-effort parser
 * for unfinished JSON, which logs every such text (nearly every keystroke while typing a key) with
 * `console.error`. Without that fallback, unfinished text has no data; completion only needs
 * data to pick between data-dependent schema branches, and the design schema has none for objects
 * (its only `anyOf` is between two string schemas).
 */
const quietParser: DocumentParser = (state) => {
  let data: unknown = null;
  try {
    data = JSON.parse(state.doc.toString());
  } catch {
    // unfinished JSON: no data, see above
  }
  return { data, pointers: getJsonPointers(state, 'json4') };
};

function toDiagnostics(result: LintResult): Diagnostic[] {
  return result.issues.map(({ path, message, from, to }) => ({
    from,
    to,
    severity: 'error',
    message: path ? `${path}: ${message}` : message,
  }));
}

/**
 * A JSON editor for design files: completion and hover from `design.schema.json`, diagnostics
 * from `lintDesign` (so it reports what the package and the CLI report).
 */
export function createDesignEditor(parent: HTMLElement, options: EditorOptions): EditorHandle {
  const view = new EditorView({
    parent,
    doc: options.doc,
    extensions: [
      basicSetup,
      json(),
      jsonLanguage.data.of({ autocomplete: jsonCompletion({ jsonParser: quietParser }) }),
      hoverTooltip(jsonSchemaHover()),
      stateExtensions(schema as Parameters<typeof stateExtensions>[0]),
      linter(
        (v) => {
          const result = lintDesign(v.state.doc.toString());
          options.onLint(result);
          return toDiagnostics(result);
        },
        { delay: LINT_DELAY },
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange?.();
      }),
      EditorView.contentAttributes.of({ 'aria-label': 'Design JSON' }),
    ],
  });
  return {
    getText: () => view.state.doc.toString(),
    setText(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    dispose: () => view.destroy(),
  };
}
