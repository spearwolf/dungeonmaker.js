// SPDX-License-Identifier: GPL-3.0-or-later

import type { DesignConfig } from '../../src/schema/model.js';

/**
 * A design with one defect, applied to a fresh copy of the 140 x 140 `design5`.
 *
 * - `check`: `toDesignText` throws a `DesignValidationError` with `path`.
 * - `schema`: only `validateDesign` reports it; `toDesignText` accepts it and the core
 *   generates without an abort or a hang (pinned in core-robustness.test.ts).
 * - no `path`: only the error type is asserted.
 */
export interface BrokenDesign {
  readonly name: string;
  readonly stage: 'check' | 'schema';
  readonly path?: string;
  mutate(d: DesignConfig): void;
}

/** First element of an optional list that design5 fills; throws if the fixture base changed. */
function first<T>(list: readonly T[] | undefined): T {
  const item = list?.[0];
  if (item === undefined) throw new Error('design5 no longer has the entry this fixture mutates');
  return item;
}

export const BROKEN_DESIGNS: readonly BrokenDesign[] = [
  {
    name: 'map too wide',
    stage: 'check',
    path: '/map/width',
    mutate: (d) => {
      d.map.width = 5000;
    },
  },
  {
    name: 'fractional width',
    stage: 'check',
    path: '/map/width',
    mutate: (d) => {
      d.map.width = 120.5;
    },
  },
  {
    name: 'width not a number',
    stage: 'check',
    path: '/map/width',
    mutate: (d) => {
      (d.map as { width: unknown }).width = 'wide';
    },
  },
  {
    name: 'unknown background',
    stage: 'check',
    path: '/map/background',
    mutate: (d) => {
      (d.map as { background: unknown }).background = 'lava';
    },
  },
  {
    name: 'spawn delay too short',
    stage: 'check',
    path: '/spawnDelay/crawler',
    mutate: (d) => {
      d.spawnDelay.crawler = [100, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    },
  },
  {
    name: 'spawn delay sum',
    stage: 'check',
    path: '/spawnDelay/roomie',
    mutate: (d) => {
      d.spawnDelay.roomie = [90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    },
  },
  {
    name: 'corridor width terminator',
    stage: 'check',
    path: '/crawlers/corridorWidth/1',
    mutate: (d) => {
      d.crawlers.corridorWidth = [15, 0, 7];
    },
  },
  {
    name: 'join preference terminator',
    stage: 'check',
    path: '/tunnelers/joinPreference/1',
    mutate: (d) => {
      d.tunnelers.joinPreference = [0, -1, 5];
    },
  },
  {
    name: 'random crawler terminator',
    stage: 'check',
    path: '/crawlers/random/perThousandWallSquares/1',
    mutate: (d) => {
      d.crawlers.random.perThousandWallSquares = [0, 99];
    },
  },
  {
    name: 'anteroom terminator',
    stage: 'check',
    path: '/tunnelers/anteroomProbability/1',
    mutate: (d) => {
      d.tunnelers.anteroomProbability = [20, 100, 0];
    },
  },
  {
    name: 'negative byLevel',
    stage: 'check',
    path: '/population/mobs/dungeon/rooms/byLevel/1',
    mutate: (d) => {
      d.population = {
        mobs: {
          labyrinth: {
            rooms: { groupSize: 1, groupSizeVariance: 0, byLevel: [] },
            open: { byLevel: [] },
          },
          dungeon: {
            rooms: { groupSize: 1, groupSizeVariance: 0, byLevel: [1, -2] },
            open: { anteroomProbability: 0, byLevel: [] },
          },
        },
        treasure: {
          labyrinth: { groupSize: 1, groupSizeVariance: 0, byLevel: [] },
          dungeon: { groupSize: 1, groupSizeVariance: 0, byLevel: [] },
        },
      };
    },
  },
  {
    name: 'room size sum',
    stage: 'check',
    path: '/rooms/sizeProbability/sideways/0',
    mutate: (d) => {
      d.rooms.sizeProbability.sideways[0] = { small: 50, medium: 0, large: 0 };
    },
  },
  {
    name: 'size up plus down',
    stage: 'check',
    path: '/tunnelers/sizeUpProbability/0',
    mutate: (d) => {
      d.tunnelers.sizeUpProbability = [60];
      d.tunnelers.sizeDownProbability = [50];
    },
  },
  {
    name: 'rectangle outside',
    stage: 'check',
    path: '/rectangles/0',
    mutate: (d) => {
      first(d.rectangles).to.x = 140;
    },
  },
  {
    name: 'crawler outside',
    stage: 'check',
    path: '/crawlers/seeds/0/location',
    mutate: (d) => {
      first(d.crawlers.seeds).location = { x: 500, y: 500 };
    },
  },
  {
    name: 'diagonal start',
    stage: 'check',
    path: '/crawlers/seeds/0/direction',
    mutate: (d) => {
      (first(d.crawlers.seeds) as { direction: unknown }).direction = 'NE';
    },
  },
  {
    name: 'inconsistent directions',
    stage: 'check',
    path: '/crawlers/seeds/0/intendedDirection',
    mutate: (d) => {
      const seed = first(d.crawlers.seeds);
      seed.direction = 'N';
      seed.intendedDirection = 'S';
    },
  },
  {
    name: 'tunneler outside',
    stage: 'check',
    path: '/tunnelers/seeds/0/location',
    mutate: (d) => {
      first(d.tunnelers.seeds).location = { x: 50, y: 140 };
    },
  },
  {
    name: 'pair member outside',
    stage: 'check',
    path: '/crawlers/pairs/0/first/location',
    mutate: (d) => {
      first(d.crawlers.pairs).first.location = { x: 140, y: 0 };
    },
  },
  {
    name: 'pair member with inconsistent directions',
    stage: 'check',
    path: '/crawlers/pairs/0/second/intendedDirection',
    mutate: (d) => {
      const { second } = first(d.crawlers.pairs);
      second.direction = 'N';
      second.intendedDirection = 'S';
    },
  },
  {
    name: 'empty tunneler max age list',
    stage: 'check',
    path: '/tunnelers/maxAge',
    mutate: (d) => {
      d.tunnelers.maxAge = [];
    },
  },
  {
    name: 'map too low',
    stage: 'check',
    path: '/map/height',
    mutate: (d) => {
      d.map.height = 2;
    },
  },
  // The next ones abort the core with an assert or hang it in an endless loop.
  {
    name: 'crawler corridor width 0',
    stage: 'check',
    path: '/crawlers/seeds/0/corridorWidth',
    mutate: (d) => {
      first(d.crawlers.seeds).corridorWidth = 0;
    },
  },
  {
    name: 'negative pair member corridor width',
    stage: 'check',
    path: '/crawlers/pairs/0/second/corridorWidth',
    mutate: (d) => {
      first(d.crawlers.pairs).second.corridorWidth = -1;
    },
  },
  {
    name: 'negative corridor width per generation',
    stage: 'check',
    path: '/crawlers/corridorWidth/0',
    mutate: (d) => {
      d.crawlers.corridorWidth = [-1];
    },
  },
  {
    name: 'negative crawler generation',
    stage: 'check',
    path: '/crawlers/seeds/0/generation',
    mutate: (d) => {
      first(d.crawlers.seeds).generation = -1;
    },
  },
  {
    name: 'negative pair member generation',
    stage: 'check',
    path: '/crawlers/pairs/0/first/generation',
    mutate: (d) => {
      first(d.crawlers.pairs).first.generation = -1;
    },
  },
  {
    name: 'tunneler step length 0',
    stage: 'check',
    path: '/tunnelers/seeds/0/stepLength',
    mutate: (d) => {
      first(d.tunnelers.seeds).stepLength = 0;
    },
  },
  {
    name: 'negative tunnel width',
    stage: 'check',
    path: '/tunnelers/seeds/0/tunnelWidth',
    mutate: (d) => {
      first(d.tunnelers.seeds).tunnelWidth = -1;
    },
  },
  {
    name: 'negative tunneler generation',
    stage: 'check',
    path: '/tunnelers/seeds/0/generation',
    mutate: (d) => {
      first(d.tunnelers.seeds).generation = -1;
    },
  },
  {
    name: 'negative size-up generation delay',
    stage: 'check',
    path: '/tunnelers/sizeUpGenerationDelay',
    mutate: (d) => {
      d.tunnelers.sizeUpGenerationDelay = -1;
    },
  },
  {
    name: 'subnormal aspect ratio',
    stage: 'check',
    path: '/rooms/aspectRatio',
    mutate: (d) => {
      d.rooms.aspectRatio = 1e-310;
    },
  },
  {
    name: 'missing rooms',
    stage: 'check',
    mutate: (d) => {
      delete (d as { rooms?: unknown }).rooms;
    },
  },
  {
    name: 'noHeading above 100',
    stage: 'schema',
    path: '/behaviour/noHeadingProbability',
    mutate: (d) => {
      d.behaviour.noHeadingProbability = 150;
    },
  },
  {
    name: 'aspect ratio 1.5',
    stage: 'schema',
    path: '/rooms/aspectRatio',
    mutate: (d) => {
      d.rooms.aspectRatio = 1.5;
    },
  },
  {
    name: 'negative gene',
    stage: 'schema',
    path: '/crawlers/random/genes/changeDirection',
    mutate: (d) => {
      d.crawlers.random.genes.changeDirection = -5;
    },
  },
  {
    // tilesLaid = 0 moves the crawler to the default IntCoordinate (0, 0): odd, not fatal
    name: 'crawler step length 0',
    stage: 'schema',
    path: '/crawlers/seeds/0/stepLength',
    mutate: (d) => {
      first(d.crawlers.seeds).stepLength = 0;
    },
  },
  {
    // a builder with maxAge <= 0 dies on its first step
    name: 'negative crawler max age per generation',
    stage: 'schema',
    path: '/crawlers/maxAge/0',
    mutate: (d) => {
      d.crawlers.maxAge = [-2];
    },
  },
  {
    // AcceptDesign clamps gDLC < 1 to 1
    name: 'negative last-chance generation delay',
    stage: 'schema',
    path: '/tunnelers/lastChance/generationDelay',
    mutate: (d) => {
      d.tunnelers.lastChance.generationDelay = -1;
    },
  },
  {
    name: 'typo',
    stage: 'schema',
    path: '/map/widht',
    mutate: (d) => {
      (d.map as Record<string, unknown>).widht = 120;
    },
  },
];
