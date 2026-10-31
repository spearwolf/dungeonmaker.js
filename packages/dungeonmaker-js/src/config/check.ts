// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Semantic check of a `DesignConfig`: the rules the library enforces with `assert`,
 * out-of-range accesses or `exit()` (which would abort the WebAssembly core) rather
 * than with a return value, plus the values that send generation into an endless loop.
 * Always active in `toDesignText`, so a broken config becomes a `DesignIssue` list
 * instead of an abort or a hang. Values the library merely clamps or tolerates stay
 * schema-only (`validateDesign`).
 *
 * Runs after the emit pass of `serialize.ts`, which already guarantees that every
 * value has the right JSON type, is an int32, and does not collide with a list
 * terminator; the exact length 11 of `spawnDelay.*` lives there too. This module
 * adds the cross-field rules and reports every violation, not just the first.
 */

import type { DesignIssue } from '../errors.js';
import type { DesignConfig, Point } from '../schema/model.js';
import { areDirectionsConsistent } from './tokens.js';

const MAP_MIN = 3;
const MAP_MAX = 4096;

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** Last element repeats beyond the end of a list (`.back()` accessors upstream). */
const repeatLast = (values: readonly number[], index: number): number =>
  values[Math.min(index, values.length - 1)] ?? 0;

export function checkDesign(config: DesignConfig): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });
  const { map, spawnDelay, crawlers, tunnelers, rooms } = config;

  // 1. map size
  for (const key of ['width', 'height'] as const) {
    const n = map[key];
    if (n < MAP_MIN || n > MAP_MAX) {
      issue(`/map/${key}`, `must be between ${MAP_MIN} and ${MAP_MAX}, got ${n}`);
    }
  }

  // 2. spawn delays: percentages that add up to 100 (the length is checked by the serializer)
  for (const key of ['crawler', 'roomie', 'tunneler'] as const) {
    const delays = spawnDelay[key];
    if (delays.length === 11 && sum(delays) !== 100) {
      issue(`/spawnDelay/${key}`, `entries must add up to 100, got ${sum(delays)}`);
    }
  }

  // 3. lists the library reads with `.back()` or `[0]` must not be empty
  const required: readonly [string, readonly number[]][] = [
    ['/crawlers/stepLength', crawlers.stepLength],
    ['/crawlers/corridorWidth', crawlers.corridorWidth],
    ['/crawlers/maxAge', crawlers.maxAge],
    ['/tunnelers/maxAge', tunnelers.maxAge],
    ['/tunnelers/joinPreference', tunnelers.joinPreference],
    ['/tunnelers/sizeUpProbability', tunnelers.sizeUpProbability],
    ['/tunnelers/sizeDownProbability', tunnelers.sizeDownProbability],
  ];
  for (const [path, list] of required) {
    if (list.length === 0) issue(path, 'must have at least one entry');
  }

  // 4. per generation, size up + size down probability ≤ 100: both are slices of one
  // `rand()%101` roll (DungeonMaker.cpp:2080-2087). The path names an element that exists:
  // beyond the end of sizeUpProbability, the repeated last value is not addressable.
  const up = tunnelers.sizeUpProbability;
  const down = tunnelers.sizeDownProbability;
  if (up.length > 0 && down.length > 0) {
    for (let g = 0; g < Math.max(up.length, down.length); g++) {
      const total = repeatLast(up, g) + repeatLast(down, g);
      if (total > 100) {
        issue(
          g < up.length
            ? `/tunnelers/sizeUpProbability/${g}`
            : `/tunnelers/sizeDownProbability/${g}`,
          `size up and size down probability of generation ${g} add up to ${total}, more than 100`,
        );
      }
    }
  }

  // 5. room size probabilities per tunnel width
  for (const key of ['sideways', 'branching'] as const) {
    rooms.sizeProbability[key].forEach(({ small, medium, large }, i) => {
      const path = `/rooms/sizeProbability/${key}/${i}`;
      if (small < 0 || medium < 0 || large < 0) issue(path, 'probabilities must not be negative');
      else if (small + medium + large !== 100) {
        issue(path, `small, medium and large must add up to 100, got ${small + medium + large}`);
      }
    });
  }

  const inside = (p: Point) => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
  const where = `inside the ${map.width} x ${map.height} map`;

  // 6. rectangles
  (config.rectangles ?? []).forEach(({ from, to }, i) => {
    const path = `/rectangles/${i}`;
    if (from.x < 0 || from.y < 0 || from.x > to.x || from.y > to.y) {
      issue(path, '"from" must not be negative and not beyond "to" on either axis');
    } else if (!inside(to)) {
      issue(path, `"to" must be ${where}`);
    }
  });

  // 7. + 8. seeds: position on the map, direction pair accepted upstream
  const seeds = [
    ...(crawlers.seeds ?? []).map((c, i) => [`/crawlers/seeds/${i}`, c] as const),
    ...(crawlers.pairs ?? []).flatMap(({ first, second }, i) => [
      [`/crawlers/pairs/${i}/first`, first] as const,
      [`/crawlers/pairs/${i}/second`, second] as const,
    ]),
  ];
  for (const [path, c] of seeds) {
    if (!inside(c.location)) issue(`${path}/location`, `must be ${where}`);
    if (!areDirectionsConsistent(c.direction, c.intendedDirection)) {
      issue(
        `${path}/intendedDirection`,
        `"${c.intendedDirection}" is not consistent with the start direction "${c.direction}"`,
      );
    }
  }
  (tunnelers.seeds ?? []).forEach((t, i) => {
    if (!inside(t.location)) issue(`/tunnelers/seeds/${i}/location`, `must be ${where}`);
  });

  // 9. builder values the library asserts on or never finishes with. Line numbers refer to
  // native/vendor/dungeonmaker-2.05/DungeonMaker.cpp.
  const atLeast = (path: string, value: number, min: number, why: string) => {
    if (value < min) issue(path, `must be at least ${min}, got ${value}: ${why}`);
  };
  // Crawler corridor width: the WallCrawler constructor asserts `corridorWidth >= 0` (776),
  // and StepAhead passes it as leftFree/rightFree to FrontFree (996), which asserts both
  // are `>= 1` (786). Offspring and random crawlers take theirs from `crawlers.corridorWidth`
  // (GetCorrWidth, CreateCrawler calls at 1116-1164 and 3145-3174).
  const CORRIDOR = 'a crawler with a narrower corridor aborts the generator';
  crawlers.corridorWidth.forEach((w, i) => {
    atLeast(`/crawlers/corridorWidth/${i}`, w, 1, CORRIDOR);
  });
  // Generation: a builder whose generation is below the active one (which starts at 0) is
  // skipped by StepAhead (984, 1498) but never deleted, so AdvanceGeneration (3530-3555)
  // keeps reporting builders and generation never ends.
  const GENERATION = 'a builder below generation 0 never runs and hangs the generator';
  for (const [path, c] of seeds) {
    atLeast(`${path}/corridorWidth`, c.corridorWidth, 1, CORRIDOR);
    atLeast(`${path}/generation`, c.generation, 0, GENERATION);
  }
  (tunnelers.seeds ?? []).forEach((t, i) => {
    const path = `/tunnelers/seeds/${i}`;
    // Tunneler::StepAhead asserts `tunnelWidth >= 0` (1510) and `stepLength > 0` (2007).
    atLeast(`${path}/stepLength`, t.stepLength, 1, 'a tunneler asserts a positive step length');
    atLeast(`${path}/tunnelWidth`, t.tunnelWidth, 0, 'a tunneler asserts a tunnel width >= 0');
    atLeast(`${path}/generation`, t.generation, 0, GENERATION);
  });
  // A widening tunneler puts its offspring at generation + sizeUpGenDelay (2132): a negative
  // delay places them below the active generation, with the same endless loop.
  atLeast(
    '/tunnelers/sizeUpGenerationDelay',
    tunnelers.sizeUpGenerationDelay,
    0,
    'offspring below the active generation never run and hang the generator',
  );

  return issues;
}
