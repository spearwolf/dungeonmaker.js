// SPDX-License-Identifier: GPL-3.0-or-later

/** A half-open character range `[from, to)` in a text. */
export interface Range {
  from: number;
  to: number;
}

/** Escapes one reference token for a JSON Pointer (RFC 6901). */
const token = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

/**
 * Maps the JSON Pointer (RFC 6901) of every value in a JSON text to the character range of
 * that value; `''` is the root. Whitespace around a value is not part of its range. With
 * duplicate keys the last one wins, as in `JSON.parse`.
 *
 * @throws SyntaxError when the text is not valid JSON.
 */
export function pointerRanges(text: string): Map<string, Range> {
  // `JSON.parse` decides validity, so the scanner below only has to find the boundaries.
  JSON.parse(text);
  const ranges = new Map<string, Range>();
  let pos = 0;

  const skipWhitespace = () => {
    while (pos < text.length && WHITESPACE.has(text.charAt(pos))) pos++;
  };

  /** Reads the string literal at `pos` and returns its raw source. */
  const readString = (): string => {
    const start = pos;
    pos++; // opening quote
    while (text.charAt(pos) !== '"') pos += text.charAt(pos) === '\\' ? 2 : 1;
    pos++; // closing quote
    return text.slice(start, pos);
  };

  const readValue = (pointer: string): void => {
    skipWhitespace();
    const from = pos;
    const c = text.charAt(pos);
    if (c === '{') {
      pos++;
      skipWhitespace();
      while (text.charAt(pos) !== '}') {
        const key = JSON.parse(readString()) as string;
        skipWhitespace();
        pos++; // colon
        readValue(`${pointer}/${token(key)}`);
        skipWhitespace();
        if (text.charAt(pos) === ',') {
          pos++;
          skipWhitespace();
        }
      }
      pos++;
    } else if (c === '[') {
      pos++;
      skipWhitespace();
      for (let index = 0; text.charAt(pos) !== ']'; index++) {
        readValue(`${pointer}/${index}`);
        skipWhitespace();
        if (text.charAt(pos) === ',') pos++;
        skipWhitespace();
      }
      pos++;
    } else if (c === '"') {
      readString();
    } else {
      // number, true, false or null: everything up to the next delimiter
      while (pos < text.length && !/[\s,\]}]/.test(text.charAt(pos))) pos++;
    }
    ranges.set(pointer, { from, to: pos });
  };

  readValue('');
  return ranges;
}

/**
 * The range of `path`, or of its nearest ancestor that exists in the text (a missing
 * property is shown on the object that lacks it).
 */
export function rangeFor(ranges: Map<string, Range>, path: string): Range {
  let current = path;
  for (;;) {
    const range = ranges.get(current);
    if (range) return range;
    if (current === '') return { from: 0, to: 0 };
    current = current.slice(0, Math.max(0, current.lastIndexOf('/')));
  }
}
