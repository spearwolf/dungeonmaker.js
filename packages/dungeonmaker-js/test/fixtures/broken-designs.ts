// SPDX-License-Identifier: GPL-3.0-or-later

import type { DesignConfig } from '../../src/schema/model.js';

/**
 * A design with one defect, applied to a fresh copy of the 140 x 140 `design5`.
 *
 * - `check`: `toDesignText` throws a `DesignValidationError` with `path`.
 * - `schema`: only `validateDesign` reports it; generation is unharmed by the value.
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
    name: 'typo',
    stage: 'schema',
    path: '/map/widht',
    mutate: (d) => {
      (d.map as Record<string, unknown>).widht = 120;
    },
  },
];
