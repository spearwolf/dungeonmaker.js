// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Exporter from a `DesignConfig` to the canonical legacy design text.
 *
 * Writes every record in the read order of `Config::AcceptDesign` (the same order
 * `parse.ts` reads), one record per line, tokens separated by one space, and appends
 * the list terminators the JSON arrays never contain. Every value passes an emit
 * helper that knows its JSON path, so a value the text cannot carry faithfully
 * (a fraction where `>> int` reads, a terminator inside a list) becomes a
 * `DesignIssue` instead of a silently different dungeon.
 */

import { type DesignIssue, DesignValidationError } from '../errors.js';
import type {
  CrawlerPairMember,
  DesignConfig,
  Genes,
  Population,
  TunnelerSeed,
} from '../schema/model.js';
import { pointToLibrary, sizeToLibrary } from './axes.js';
import {
  ANY_DIRECTION,
  ANY_DIRECTION_TOKEN,
  BACKGROUNDS,
  CARDINAL_DIRECTIONS,
  CELL_NAMES,
  CELL_TOKENS,
  DIRECTION_TOKENS,
  DIRECTIONS,
} from './tokens.js';

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

type TokenTable = ReadonlyMap<unknown, string>;

const DIRECTION_TABLE: TokenTable = new Map(DIRECTIONS.map((d) => [d, DIRECTION_TOKENS[d]]));
/** Builders assert a cardinal heading, so start directions only use these four. */
const CARDINAL_TABLE: TokenTable = new Map(
  CARDINAL_DIRECTIONS.map((d) => [d, DIRECTION_TOKENS[d]]),
);
/** Crawler intended directions additionally allow `'any'`; tunnelers do not. */
const INTENDED_TABLE: TokenTable = new Map([
  ...DIRECTION_TABLE,
  [ANY_DIRECTION, ANY_DIRECTION_TOKEN],
]);
const CELL_TABLE: TokenTable = new Map(CELL_NAMES.map((n) => [n, CELL_TOKENS[n]]));
const BACKGROUND_TABLE: TokenTable = new Map(BACKGROUNDS.map((b) => [b, CELL_TOKENS[b]]));

/** A list terminator: the value itself, or a predicate for open-ended ones (E/H/I: negative). */
interface Terminator {
  readonly token: string;
  readonly ends: (n: number) => boolean;
  readonly describe: string;
}

const endsAt = (value: number): Terminator => ({
  token: String(value),
  ends: (n) => n === value,
  describe: `must not be ${value}, the list terminator of the design text`,
});

const NEGATIVE_END: Terminator = {
  token: '-1',
  ends: (n) => n < 0,
  describe: 'must not be negative, a negative value ends the list in the design text',
};

const ZERO_END = endsAt(0);
const MINUS_ONE_END = endsAt(-1);

const describe = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

/** Collects the tokens of the design text; every violation becomes a `DesignIssue`. */
class Emitter {
  readonly issues: DesignIssue[] = [];

  #issue(path: string, message: string): string {
    this.issues.push({ path, message });
    return '0';
  }

  int(path: string, v: unknown): string {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < INT32_MIN || v > INT32_MAX) {
      return this.#issue(path, `must be an integer in the int32 range, got ${describe(v)}`);
    }
    return String(v || 0); // no "-0"
  }

  /** `String(r)` is the shortest text that `>> double` reads back as exactly `r`. */
  num(path: string, v: unknown): string {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return this.#issue(path, `must be a finite number, got ${describe(v)}`);
    }
    return String(v || 0);
  }

  bool(path: string, v: unknown): string {
    if (typeof v !== 'boolean') return this.#issue(path, `must be a boolean, got ${describe(v)}`);
    return v ? '1' : '0';
  }

  token(path: string, v: unknown, table: TokenTable): string {
    const token = table.get(v);
    if (token === undefined) {
      const allowed = [...table.keys()].map(describe).join(', ');
      return this.#issue(path, `must be one of ${allowed}, got ${describe(v)}`);
    }
    return token;
  }

  /** Elements of an array; with `optional`, `undefined` counts as empty. */
  array(path: string, v: unknown, optional = false): readonly unknown[] {
    if (optional && v === undefined) return [];
    if (!Array.isArray(v)) {
      this.#issue(path, `must be an array, got ${describe(v)}`);
      return [];
    }
    return v;
  }

  /** Integers of a terminated list, followed by the terminator. */
  list(path: string, v: unknown, terminator: Terminator): string[] {
    const tokens = this.array(path, v).map((element, i) => {
      const at = `${path}/${i}`;
      const token = this.int(at, element);
      if (typeof element === 'number' && terminator.ends(element)) {
        this.#issue(at, terminator.describe);
      }
      return token;
    });
    return [...tokens, terminator.token];
  }

  /** `GS`/`GB`: `small medium large` per entry, then the terminator `0 0 100`. */
  triples(path: string, v: unknown): string[] {
    const tokens = this.array(path, v).flatMap((element, i) => {
      const at = `${path}/${i}`;
      const { small, medium, large } = element as {
        small: unknown;
        medium: unknown;
        large: unknown;
      };
      if (large === 100) {
        this.#issue(`${at}/large`, 'must not be 100, which ends the list in the design text');
      }
      return [
        this.int(`${at}/small`, small),
        this.int(`${at}/medium`, medium),
        this.int(`${at}/large`, large),
      ];
    });
    return [...tokens, '0', '0', '100'];
  }

  point(path: string, p: { x: number; y: number }): string[] {
    const [row, col] = pointToLibrary(p);
    return [this.int(`${path}/y`, row), this.int(`${path}/x`, col)];
  }
}

const line = (tag: string, values: readonly string[]) => [tag, ...values].join(' ');

/** The five crawler genes in upstream order `sSSP sDSP tSSP tDSP cDP`. */
function genes(e: Emitter, path: string, g: Genes): string[] {
  return [
    e.int(`${path}/straightSingleSpawn`, g.straightSingleSpawn),
    e.int(`${path}/straightDoubleSpawn`, g.straightDoubleSpawn),
    e.int(`${path}/turnSingleSpawn`, g.turnSingleSpawn),
    e.int(`${path}/turnDoubleSpawn`, g.turnDoubleSpawn),
    e.int(`${path}/changeDirection`, g.changeDirection),
  ];
}

/** `locX locY dir intDir dorm maxAge gen sL op cW` + genes; `op` is written by the caller. */
function crawler(e: Emitter, path: string, c: CrawlerPairMember, op: string): string[] {
  return [
    ...e.point(`${path}/location`, c.location),
    e.token(`${path}/direction`, c.direction, CARDINAL_TABLE),
    e.token(`${path}/intendedDirection`, c.intendedDirection, INTENDED_TABLE),
    e.int(`${path}/dormancy`, c.dormancy),
    e.int(`${path}/maxAge`, c.maxAge),
    e.int(`${path}/generation`, c.generation),
    e.int(`${path}/stepLength`, c.stepLength),
    op,
    e.int(`${path}/corridorWidth`, c.corridorWidth),
    ...genes(e, `${path}/genes`, c.genes),
  ];
}

function tunneler(e: Emitter, path: string, t: TunnelerSeed): string[] {
  const g = `${path}/genes`;
  return [
    ...e.point(`${path}/location`, t.location),
    e.token(`${path}/direction`, t.direction, CARDINAL_TABLE),
    e.token(`${path}/intendedDirection`, t.intendedDirection, DIRECTION_TABLE),
    e.int(`${path}/dormancy`, t.dormancy),
    e.int(`${path}/maxAge`, t.maxAge),
    e.int(`${path}/generation`, t.generation),
    e.int(`${path}/stepLength`, t.stepLength),
    e.int(`${path}/tunnelWidth`, t.tunnelWidth),
    e.int(`${g}/straightDoubleSpawn`, t.genes.straightDoubleSpawn),
    e.int(`${g}/turnDoubleSpawn`, t.genes.turnDoubleSpawn),
    e.int(`${g}/changeDirection`, t.genes.changeDirection),
    e.int(`${g}/makeRoomsRight`, t.genes.makeRoomsRight),
    e.int(`${g}/makeRoomsLeft`, t.genes.makeRoomsLeft),
    e.int(`${g}/joinPreference`, t.genes.joinPreference),
  ];
}

type Group = Population['treasure']['dungeon'];

/** `groupSize groupSizeVariance byLevel… -1` of E1, H1, I1 and I2. */
function group(e: Emitter, path: string, g: Group): string[] {
  return [
    e.int(`${path}/groupSize`, g.groupSize),
    e.int(`${path}/groupSizeVariance`, g.groupSizeVariance),
    ...e.list(`${path}/byLevel`, g.byLevel, NEGATIVE_END),
  ];
}

function population(e: Emitter, p: Population): string[] {
  const mobs = '/population/mobs';
  const treasure = '/population/treasure';
  const { labyrinth, dungeon } = p.mobs;
  return [
    line('E1', group(e, `${mobs}/labyrinth/rooms`, labyrinth.rooms)),
    line('E2', e.list(`${mobs}/labyrinth/open/byLevel`, labyrinth.open.byLevel, NEGATIVE_END)),
    line('H1', group(e, `${mobs}/dungeon/rooms`, dungeon.rooms)),
    line('H2', [
      e.int(`${mobs}/dungeon/open/anteroomProbability`, dungeon.open.anteroomProbability),
      ...e.list(`${mobs}/dungeon/open/byLevel`, dungeon.open.byLevel, NEGATIVE_END),
    ]),
    line('I1', group(e, `${treasure}/labyrinth`, p.treasure.labyrinth)),
    line('I2', group(e, `${treasure}/dungeon`, p.treasure.dungeon)),
  ];
}

function emit(e: Emitter, config: DesignConfig): string[] {
  const { map, spawnDelay, crawlers, tunnelers, rooms, behaviour } = config;
  const { inTunnels } = crawlers;
  const [dimX, dimY] = sizeToLibrary(map);
  const lines = [
    'XX generated by dungeonmaker-js',
    line('D', [
      e.int('/map/height', dimX),
      e.int('/map/width', dimY),
      e.token('/map/background', map.background, BACKGROUND_TABLE),
      e.int('/map/joinDistance', map.joinDistance),
      e.int('/map/tunnelJoinDistance', map.tunnelJoinDistance),
      ...e
        .array('/map/openings', map.openings)
        .map((d, i) => e.token(`/map/openings/${i}`, d, DIRECTION_TABLE)),
    ]),
    // ends the openings list and, as a comment, its line
    ANY_DIRECTION_TOKEN,
  ];

  e.array('/rectangles', config.rectangles, true).forEach((element, i) => {
    const r = element as NonNullable<DesignConfig['rectangles']>[number];
    const path = `/rectangles/${i}`;
    lines.push(
      line('R', [
        ...e.point(`${path}/from`, r.from),
        ...e.point(`${path}/to`, r.to),
        e.token(`${path}/cell`, r.cell, CELL_TABLE),
      ]),
    );
  });

  const eleven = (path: string, v: unknown) => {
    const values = e.array(path, v);
    if (values.length !== 11)
      e.issues.push({ path, message: `must have exactly 11 entries, got ${values.length}` });
    return values.map((n, i) => e.int(`${path}/${i}`, n));
  };

  const t = '/tunnelers';
  const r = '/rooms';
  const { size, count } = rooms;
  lines.push(
    line('BC', eleven('/spawnDelay/crawler', spawnDelay.crawler)),
    line('BR', eleven('/spawnDelay/roomie', spawnDelay.roomie)),
    line('BT', eleven('/spawnDelay/tunneler', spawnDelay.tunneler)),
    line('ZU', e.list(`${t}/sizeUpProbability`, tunnelers.sizeUpProbability, MINUS_ONE_END)),
    line('ZD', e.list(`${t}/sizeDownProbability`, tunnelers.sizeDownProbability, MINUS_ONE_END)),
    line('F', e.list(`${t}/anteroomProbability`, tunnelers.anteroomProbability, endsAt(100))),
    line('J', e.list(`${t}/joinPreference`, tunnelers.joinPreference, MINUS_ONE_END)),
    line('T', [
      e.int(`${r}/size/min`, size.min),
      e.int(`${r}/size/medium`, size.medium),
      e.int(`${r}/size/large`, size.large),
      e.int(`${r}/size/max`, size.max),
      e.int(`${r}/count/labyrinth/small`, count.labyrinth.small),
      e.int(`${r}/count/labyrinth/medium`, count.labyrinth.medium),
      e.int(`${r}/count/labyrinth/large`, count.labyrinth.large),
      e.int(`${r}/count/dungeon/small`, count.dungeon.small),
      e.int(`${r}/count/dungeon/medium`, count.dungeon.medium),
      e.int(`${r}/count/dungeon/large`, count.dungeon.large),
    ]),
    line('GS', e.triples(`${r}/sizeProbability/sideways`, rooms.sizeProbability.sideways)),
    line('GB', e.triples(`${r}/sizeProbability/branching`, rooms.sizeProbability.branching)),
    line('S', e.list('/crawlers/stepLength', crawlers.stepLength, ZERO_END)),
    line('C', e.list('/crawlers/corridorWidth', crawlers.corridorWidth, ZERO_END)),
    line('AC', e.list('/crawlers/maxAge', crawlers.maxAge, ZERO_END)),
    line('AT', e.list(`${t}/maxAge`, tunnelers.maxAge, ZERO_END)),
    line('M', [
      e.int('/behaviour/mutator', behaviour.mutator),
      e.int('/behaviour/noHeadingProbability', behaviour.noHeadingProbability),
      e.int('/behaviour/patience', behaviour.patience),
      e.int(`${t}/sizeUpGenerationDelay`, tunnelers.sizeUpGenerationDelay),
      e.bool(`${t}/columns`, tunnelers.columns),
      e.bool('/crawlers/inTunnels/enabled', inTunnels.enabled),
      e.num(`${r}/aspectRatio`, rooms.aspectRatio),
      e.int(`${t}/anteroomGenerationSpeedUp`, tunnelers.anteroomGenerationSpeedUp),
    ]),
    // showMovie storeMovie randSeed. randSeed is unused (Init_fromConfig takes the seed).
    // showMovie is NOT cosmetic: without showMovie or storeMovie, SetMap never records a
    // change, so MakeIteration() returns false after one iteration and every generation
    // runs a single iteration, which moves the point where SeedCrawlersInTunnels() fires.
    // All vendor designs set one of the flags; showMovie avoids storeMovie's frame buffer.
    line('N', [
      e.int('/crawlers/inTunnels/seedCount', inTunnels.seedCount),
      e.int('/crawlers/inTunnels/generation', inTunnels.generation),
      '1',
      '0',
      '0',
      e.bool('/crawlers/inTunnels/inAnterooms', inTunnels.inAnterooms),
    ]),
    line(
      'K',
      e.list(
        '/crawlers/random/perThousandWallSquares',
        crawlers.random.perThousandWallSquares,
        endsAt(99),
      ),
    ),
    line('PR', genes(e, '/crawlers/random/genes', crawlers.random.genes)),
    line('PT', [
      e.int('/crawlers/inTunnels/maxAge', inTunnels.maxAge),
      e.int('/crawlers/inTunnels/stepLength', inTunnels.stepLength),
      ...genes(e, '/crawlers/inTunnels/genes', inTunnels.genes),
      e.int('/crawlers/inTunnels/closedProbability', inTunnels.closedProbability),
    ]),
    line('PU', [
      e.int(`${t}/lastChance/makeRoomsLeft`, tunnelers.lastChance.makeRoomsLeft),
      e.int(`${t}/lastChance/makeRoomsRight`, tunnelers.lastChance.makeRoomsRight),
      e.int(`${t}/lastChance/changeDirection`, tunnelers.lastChance.changeDirection),
      e.int(`${t}/lastChance/straightDoubleSpawn`, tunnelers.lastChance.straightDoubleSpawn),
      e.int(`${t}/lastChance/turnDoubleSpawn`, tunnelers.lastChance.turnDoubleSpawn),
      e.int(`${t}/lastChance/generationDelay`, tunnelers.lastChance.generationDelay),
    ]),
  );

  e.array('/crawlers/seeds', crawlers.seeds, true).forEach((element, i) => {
    const seed = element as NonNullable<DesignConfig['crawlers']['seeds']>[number];
    const path = `/crawlers/seeds/${i}`;
    lines.push(line('WS', crawler(e, path, seed, e.bool(`${path}/open`, seed.open))));
  });
  // upstream rolls a fresh `op` for pair members, so the written value is irrelevant
  e.array('/crawlers/pairs', crawlers.pairs, true).forEach((element, i) => {
    const pair = element as NonNullable<DesignConfig['crawlers']['pairs']>[number];
    const path = `/crawlers/pairs/${i}`;
    lines.push(
      line('WP1', crawler(e, `${path}/first`, pair.first, '1')),
      line('WP2', crawler(e, `${path}/second`, pair.second, '1')),
    );
  });
  e.array(`${t}/seeds`, tunnelers.seeds, true).forEach((element, i) => {
    lines.push(line('U', tunneler(e, `${t}/seeds/${i}`, element as TunnelerSeed)));
  });

  if (config.population !== undefined) lines.push(...population(e, config.population));
  return lines;
}

/**
 * Serializes a `DesignConfig` to the canonical design text that `generate()` reads.
 * `parseDesignText(toDesignText(c))` gives `c` back for every config the parser produces.
 *
 * @throws DesignValidationError with one issue per value the text cannot carry,
 *   each with the JSON Pointer of that value.
 */
export function toDesignText(config: DesignConfig): string {
  const e = new Emitter();
  let lines: string[];
  try {
    lines = emit(e, config);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new DesignValidationError([
      { path: '', message: `not a DesignConfig: ${error.message}` },
    ]);
  }
  if (e.issues.length > 0) throw new DesignValidationError(e.issues);
  return `${lines.join('\n')}\n`;
}
