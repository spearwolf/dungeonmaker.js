// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Importer for the legacy design text of DungeonMaker 2.05.
 *
 * Reads the text the way `Config::AcceptDesign` (with patch 0002) reads it: token by
 * token, so values may wrap over lines, and CRLF, tabs or a BOM make no difference.
 * Where upstream silently normalises or drops data, so does this parser, so the config
 * means exactly what the text meant. Where upstream would fail, assert or keep garbage,
 * it throws a `DesignValidationError`. It is stricter than `AcceptDesign` in places
 * (exact upper-case tags, no duplicate records, flags only 0 or 1), never different.
 */

import { DesignValidationError } from '../errors.js';
import type {
  CrawlerPairMember,
  CrawlerSeed,
  DesignConfig,
  Genes,
  Population,
  Rectangle,
  RoomSizeProbability,
  TunnelerSeed,
} from '../schema/model.js';
import { pointFromLibrary, sizeFromLibrary } from './axes.js';
import {
  ANY_DIRECTION,
  ANY_DIRECTION_TOKEN,
  type Background,
  CARDINAL_DIRECTIONS,
  type CardinalDirection,
  CELL_NAMES,
  CELL_TOKENS,
  type CellName,
  DIRECTION_TOKENS,
  DIRECTIONS,
  type Direction,
} from './tokens.js';

const INTEGER = /^[+-]?\d+$/;
const REAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const UINT32_MAX = 4294967295;
/** Smallest positive normal double; `>> double` reports anything below as a range error. */
const DOUBLE_MIN_NORMAL = 2.2250738585072014e-308;

const DIRECTION_BY_TOKEN = new Map(DIRECTIONS.map((d) => [DIRECTION_TOKENS[d], d]));
const CARDINAL_BY_TOKEN = new Map(CARDINAL_DIRECTIONS.map((d) => [DIRECTION_TOKENS[d], d]));
const INTENDED_BY_TOKEN = new Map<string, Direction | typeof ANY_DIRECTION>([
  ...DIRECTION_BY_TOKEN,
  [ANY_DIRECTION_TOKEN, ANY_DIRECTION],
]);
const CELL_BY_TOKEN = new Map(CELL_NAMES.map((n) => [CELL_TOKENS[n], n]));
const BACKGROUND_BY_TOKEN = new Map<string, Background>([
  [CELL_TOKENS.open, 'open'],
  [CELL_TOKENS.closed, 'closed'],
]);

/** Start directions an intended direction is consistent with (`Config::ValidateDirections`). */
const CONSISTENT_STARTS: Readonly<Record<Direction, readonly Direction[]>> = {
  N: ['W', 'NW', 'N', 'NE', 'E'],
  E: ['N', 'NE', 'E', 'SE', 'S'],
  S: ['W', 'SW', 'S', 'SE', 'E'],
  W: ['N', 'NW', 'W', 'SW', 'S'],
  NW: ['N', 'W'],
  SW: ['S', 'W'],
  NE: ['N', 'E'],
  SE: ['S', 'E'],
};

interface Token {
  readonly text: string;
  readonly line: number;
}

function fail(line: number, message: string): never {
  throw new DesignValidationError([{ path: '', message: `line ${line}: ${message}` }]);
}

/** Splits into maximal runs of non-whitespace, each with its 1-based line (`\n` ends a line). */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const [index, content] of text.split('\n').entries()) {
    for (const [word] of content.matchAll(/\S+/g)) tokens.push({ text: word, line: index + 1 });
  }
  return tokens;
}

class Cursor {
  #index = 0;
  readonly #tokens: readonly Token[];

  constructor(tokens: readonly Token[]) {
    this.#tokens = tokens;
  }

  next(): Token | undefined {
    return this.#tokens[this.#index++];
  }

  /** Drops the remaining tokens of `line`, like the `getline` after an upstream `XX`. */
  skipRestOfLine(line: number): void {
    while (this.#tokens[this.#index]?.line === line) this.#index++;
  }
}

/** Reads the values of one record; errors point at the last token read. */
class RecordReader {
  readonly tag: Token;
  readonly #cursor: Cursor;
  #last: Token;

  constructor(cursor: Cursor, tag: Token) {
    this.#cursor = cursor;
    this.tag = tag;
    this.#last = tag;
  }

  fail(message: string): never {
    return fail(this.#last.line, message);
  }

  token(): Token {
    const token = this.#cursor.next();
    if (!token) return fail(this.tag.line, `${this.tag.text} record is incomplete`);
    this.#last = token;
    return token;
  }

  #expected(what: string): never {
    const { text } = this.#last;
    return this.fail(
      text.startsWith('XX')
        ? `${this.tag.text} record is interrupted by a comment`
        : `expected ${what} in ${this.tag.text} record, got "${text}"`,
    );
  }

  #lookup<T>(table: ReadonlyMap<string, T>, what: string): T {
    const value = table.get(this.token().text);
    return value === undefined ? this.#expected(what) : value;
  }

  int(): number {
    const { text } = this.token();
    const n = INTEGER.test(text) ? Number(text) : Number.NaN;
    if (!(n >= INT32_MIN && n <= INT32_MAX)) return this.#expected('an integer (int32)');
    return n || 0; // no -0 from "-0"
  }

  ints(count: number): number[] {
    return Array.from({ length: count }, () => this.int());
  }

  /** Integers up to the terminator, which is consumed but not returned. */
  list(isTerminator: (n: number) => boolean): number[] {
    const values: number[] = [];
    for (let n = this.int(); !isTerminator(n); n = this.int()) values.push(n);
    return values;
  }

  flag(): boolean {
    const n = this.int();
    if (n !== 0 && n !== 1) this.fail(`expected 0 or 1 in ${this.tag.text} record, got ${n}`);
    return n === 1;
  }

  /** `>> double`; out-of-range values set failbit upstream. */
  real(): number {
    const { text } = this.token();
    const n = REAL.test(text) ? Number(text) : Number.NaN;
    const inRange =
      n === 0 ? !/[1-9]/.test(text.split(/[eE]/)[0] ?? '') : Math.abs(n) >= DOUBLE_MIN_NORMAL;
    if (!(Number.isFinite(n) && inRange)) return this.#expected('a number');
    return n || 0;
  }

  /** `>> unsigned int`: accepts a sign, rejects magnitudes beyond 32 bits. */
  uint32(): void {
    const { text } = this.token();
    if (!(INTEGER.test(text) && Math.abs(Number(text)) <= UINT32_MAX)) {
      this.#expected('an unsigned 32-bit integer');
    }
  }

  direction(): Direction | typeof ANY_DIRECTION {
    return this.#lookup(INTENDED_BY_TOKEN, 'a direction (NO NE EA SE SO SW WE NW or XX)');
  }

  /** Builders assert a cardinal heading (`Builder` constructor). */
  startDirection(): CardinalDirection {
    return this.#lookup(CARDINAL_BY_TOKEN, 'a start direction (NO, EA, SO or WE)');
  }

  cell(): CellName {
    return this.#lookup(CELL_BY_TOKEN, 'a cell type');
  }

  background(): Background {
    return this.#lookup(BACKGROUND_BY_TOKEN, 'OPEN or CLOSED');
  }

  /** The `D` openings: directions up to `XX`, which also ends its line as a comment. */
  openings(): Direction[] {
    const openings: Direction[] = [];
    for (;;) {
      const { text, line } = this.token();
      if (text === ANY_DIRECTION_TOKEN) {
        this.#cursor.skipRestOfLine(line);
        return openings;
      }
      const direction = DIRECTION_BY_TOKEN.get(text);
      if (direction === undefined) return this.#expected('a direction or XX');
      openings.push(direction);
    }
  }
}

// ---------------------------------------------------------------------------
// Record readers

const percent = (n: number) => Math.min(100, Math.max(0, n));
const isNegative = (n: number) => n < 0;

/** The five crawler genes; `adjust` maps each value (PR and PT clamp to 0…100). */
function readGenes(r: RecordReader, adjust = (n: number) => n): Genes {
  return {
    straightSingleSpawn: adjust(r.int()),
    straightDoubleSpawn: adjust(r.int()),
    turnSingleSpawn: adjust(r.int()),
    turnDoubleSpawn: adjust(r.int()),
    changeDirection: adjust(r.int()),
  };
}

function readSizeProbabilities(r: RecordReader): RoomSizeProbability[] {
  const list: RoomSizeProbability[] = [];
  for (;;) {
    const small = r.int();
    const medium = r.int();
    const large = r.int();
    if (small < 0 || medium < 0 || large < 0 || small + medium + large !== 100) {
      r.fail(
        `${r.tag.text} room size probabilities must be non-negative and sum to 100, got ${small} ${medium} ${large}`,
      );
    }
    if (large === 100) return list;
    list.push({ small, medium, large });
  }
}

type Group = Population['treasure']['dungeon'];

const readGroup = (r: RecordReader): Group => ({
  groupSize: r.int(),
  groupSizeVariance: r.int(),
  byLevel: r.list(isNegative),
});

const readRoomCount = (r: RecordReader) => ({ small: r.int(), medium: r.int(), large: r.int() });

/** Records that may appear at most once, keyed by tag. */
const SINGLE_READERS = {
  D: (r) => ({
    ...sizeFromLibrary(r.int(), r.int()),
    background: r.background(),
    joinDistance: r.int(),
    tunnelJoinDistance: r.int(),
    openings: r.openings(),
  }),
  BC: (r) => r.ints(11),
  BR: (r) => r.ints(11),
  BT: (r) => r.ints(11),
  ZU: (r) => r.list((n) => n === -1),
  ZD: (r) => r.list((n) => n === -1),
  F: (r) => r.list((n) => n === 100),
  J: (r) => r.list((n) => n === -1),
  T: (r) => ({
    size: { min: r.int(), medium: r.int(), large: r.int(), max: r.int() },
    count: { labyrinth: readRoomCount(r), dungeon: readRoomCount(r) },
  }),
  GS: readSizeProbabilities,
  GB: readSizeProbabilities,
  S: (r) => r.list((n) => n === 0),
  C: (r) => r.list((n) => n === 0),
  AC: (r) => r.list((n) => n === 0),
  AT: (r) => r.list((n) => n === 0),
  M: (r) => {
    const behaviour = { mutator: r.int(), noHeadingProbability: r.int(), patience: r.int() };
    const sizeUpGenerationDelay = r.int();
    const columns = r.int() !== 0;
    const crawlersInTunnels = r.int() !== 0;
    const aspectRatio = r.real();
    return {
      behaviour,
      sizeUpGenerationDelay,
      columns,
      crawlersInTunnels,
      // DungeonMaker::Init_fromConfig resets both
      aspectRatio: aspectRatio > 0 && aspectRatio < 1 ? aspectRatio : 0.6,
      anteroomGenerationSpeedUp: Math.max(1, r.int()),
    };
  },
  N: (r) => {
    const seedCount = r.int();
    const generation = r.int();
    r.flag(); // showMovie
    r.flag(); // storeMovie
    r.uint32(); // randSeed
    return { seedCount, generation, inAnterooms: r.flag() };
  },
  K: (r) => r.list((n) => n === 99),
  PR: (r) => readGenes(r, percent),
  PT: (r) => ({
    maxAge: r.int(),
    stepLength: r.int(),
    genes: readGenes(r, percent),
    closedProbability: r.int(),
  }),
  PU: (r) => ({
    makeRoomsLeft: percent(r.int()),
    makeRoomsRight: percent(r.int()),
    changeDirection: percent(r.int()),
    straightDoubleSpawn: percent(r.int()),
    turnDoubleSpawn: percent(r.int()),
    generationDelay: Math.max(1, r.int()),
  }),
  E1: readGroup,
  E2: (r) => r.list(isNegative),
  H1: readGroup,
  H2: (r) => ({ anteroomProbability: r.int(), byLevel: r.list(isNegative) }),
  I1: readGroup,
  I2: readGroup,
} satisfies Record<string, (r: RecordReader) => unknown>;

type SingleTag = keyof typeof SINGLE_READERS;
type Singles = { [K in SingleTag]: ReturnType<(typeof SINGLE_READERS)[K]> };

const REQUIRED = [
  'D',
  'BC',
  'BR',
  'BT',
  'S',
  'C',
  'AC',
  'AT',
  'J',
  'ZU',
  'ZD',
  'T',
  'M',
  'N',
  'PR',
  'PT',
  'PU',
] as const satisfies readonly SingleTag[];
type Found = Pick<Singles, (typeof REQUIRED)[number]> & Partial<Singles>;

const isSingleTag = (tag: string): tag is SingleTag => Object.hasOwn(SINGLE_READERS, tag);

function readRectangle(r: RecordReader): Rectangle | undefined {
  const [sX = 0, sY = 0, eX = 0, eY = 0] = r.ints(4);
  const cell = r.cell();
  // DungeonMaker::SetRect refuses inverted rectangles
  if (sX > eX || sY > eY) return undefined;
  return { from: pointFromLibrary(sX, sY), to: pointFromLibrary(eX, eY), cell };
}

/** The 15 values of `WS`, `WP1` and `WP2`; `readOp` reads the `op` field in its place. */
function readCrawler<Op>(r: RecordReader, readOp: (r: RecordReader) => Op) {
  const location = pointFromLibrary(r.int(), r.int());
  const direction = r.startDirection();
  const intendedDirection = r.direction();
  const [dormancy = 0, maxAge = 0, generation = 0, stepLength = 0] = r.ints(4);
  const op = readOp(r);
  const member: CrawlerPairMember = {
    location,
    direction,
    intendedDirection,
    dormancy,
    maxAge,
    generation,
    stepLength,
    corridorWidth: r.int(),
    genes: readGenes(r),
  };
  const consistent =
    intendedDirection === ANY_DIRECTION || CONSISTENT_STARTS[intendedDirection].includes(direction);
  return { member, op, consistent };
}

/** Pair members get a fresh random `op` upstream, so the text value is irrelevant. */
const ignoreOp = (r: RecordReader) => void r.int();

function readTunneler(r: RecordReader): TunnelerSeed {
  const location = pointFromLibrary(r.int(), r.int());
  const direction = r.startDirection();
  const intendedDirection = r.direction();
  if (intendedDirection === ANY_DIRECTION) {
    r.fail(`expected a compass direction as intended direction in U record, got "XX"`);
  }
  return {
    location,
    direction,
    intendedDirection,
    dormancy: r.int(),
    maxAge: r.int(),
    generation: r.int(),
    stepLength: r.int(),
    tunnelWidth: r.int(),
    genes: {
      straightDoubleSpawn: r.int(),
      turnDoubleSpawn: r.int(),
      changeDirection: r.int(),
      makeRoomsRight: r.int(),
      makeRoomsLeft: r.int(),
      joinPreference: r.int(),
    },
  };
}

// ---------------------------------------------------------------------------

interface Repeated {
  rectangles: Rectangle[];
  seeds: CrawlerSeed[];
  pairs: { first: CrawlerPairMember; second: CrawlerPairMember }[];
  tunnelers: TunnelerSeed[];
}

function readRepeated(cursor: Cursor, r: RecordReader, into: Repeated): void {
  switch (r.tag.text) {
    case 'R': {
      const rectangle = readRectangle(r);
      if (rectangle) into.rectangles.push(rectangle);
      return;
    }
    case 'WS': {
      const { member, op: open, consistent } = readCrawler(r, (r) => r.flag());
      const { corridorWidth, genes, ...start } = member;
      if (consistent) into.seeds.push({ ...start, open, corridorWidth, genes });
      return;
    }
    case 'WP1': {
      const first = readCrawler(r, ignoreOp);
      if (!first.consistent) fail(r.tag.line, 'WP1 has inconsistent start and intended directions');
      const tag = cursor.next();
      if (tag?.text !== 'WP2') fail(tag?.line ?? r.tag.line, 'WP1 must be followed by WP2');
      const second = readCrawler(new RecordReader(cursor, tag), ignoreOp);
      if (second.consistent) into.pairs.push({ first: first.member, second: second.member });
      return;
    }
    case 'U':
      into.tunnelers.push(readTunneler(r));
      return;
    default:
      fail(
        r.tag.line,
        r.tag.text === 'WP2'
          ? 'WP2 must directly follow the values of a WP1 record'
          : `unknown record "${r.tag.text}"`,
      );
  }
}

function emptyGroup(): Group {
  return { groupSize: 0, groupSizeVariance: 0, byLevel: [] };
}

function assemble(found: Found, { rectangles, seeds, pairs, tunnelers }: Repeated): DesignConfig {
  const { M, N, PT } = found;
  const config: DesignConfig = {
    map: found.D,
    rectangles,
    spawnDelay: { crawler: found.BC, roomie: found.BR, tunneler: found.BT },
    crawlers: {
      stepLength: found.S,
      corridorWidth: found.C,
      maxAge: found.AC,
      random: { perThousandWallSquares: found.K ?? [], genes: found.PR },
      inTunnels: {
        enabled: M.crawlersInTunnels,
        inAnterooms: N.inAnterooms,
        seedCount: N.seedCount,
        generation: N.generation,
        ...PT,
      },
      seeds,
      pairs,
    },
    tunnelers: {
      sizeUpProbability: found.ZU,
      sizeDownProbability: found.ZD,
      anteroomProbability: found.F ?? [],
      joinPreference: found.J,
      maxAge: found.AT,
      sizeUpGenerationDelay: M.sizeUpGenerationDelay,
      columns: M.columns,
      anteroomGenerationSpeedUp: M.anteroomGenerationSpeedUp,
      lastChance: found.PU,
      seeds: tunnelers,
    },
    rooms: {
      ...found.T,
      sizeProbability: { sideways: found.GS ?? [], branching: found.GB ?? [] },
      aspectRatio: M.aspectRatio,
    },
    behaviour: M.behaviour,
  };
  const { E1, E2, H1, H2, I1, I2 } = found;
  if ([E1, E2, H1, H2, I1, I2].some((record) => record !== undefined)) {
    config.population = {
      mobs: {
        labyrinth: { rooms: E1 ?? emptyGroup(), open: { byLevel: E2 ?? [] } },
        dungeon: { rooms: H1 ?? emptyGroup(), open: H2 ?? { anteroomProbability: 0, byLevel: [] } },
      },
      treasure: { labyrinth: I1 ?? emptyGroup(), dungeon: I2 ?? emptyGroup() },
    };
  }
  return config;
}

/**
 * Parses a legacy design text into a `DesignConfig`.
 *
 * @throws DesignValidationError with `path: ''` issues: one `line <n>: …` issue for the
 *   first problem, or one `missing <TAG> record` issue per missing required record.
 */
export function parseDesignText(text: string): DesignConfig {
  const cursor = new Cursor(tokenize(text));
  const found: Partial<Singles> = {};
  const repeated: Repeated = { rectangles: [], seeds: [], pairs: [], tunnelers: [] };

  for (let tag = cursor.next(); tag; tag = cursor.next()) {
    const { text: name, line } = tag;
    if (name.startsWith('XX')) {
      cursor.skipRestOfLine(line);
      continue;
    }
    if (name.startsWith('X')) fail(line, `a comment must start with XX, got "${name}"`);
    // Upstream reads one character per record tag and skips signs and digits, so a
    // surplus value after a complete record (designOld1: `PR` with six values) is ignored.
    if (INTEGER.test(name)) continue;
    const reader = new RecordReader(cursor, tag);
    if (!isSingleTag(name)) {
      readRepeated(cursor, reader, repeated);
      continue;
    }
    if (found[name] !== undefined) fail(line, `duplicate ${name} record`);
    (found as Record<SingleTag, unknown>)[name] = SINGLE_READERS[name](reader);
  }

  const missing = REQUIRED.filter((tag) => found[tag] === undefined);
  if (missing.length > 0) {
    throw new DesignValidationError(
      missing.map((tag) => ({ path: '', message: `missing ${tag} record` })),
    );
  }
  return assemble(found as Found, repeated);
}
