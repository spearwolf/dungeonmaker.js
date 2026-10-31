// SPDX-License-Identifier: GPL-3.0-or-later

import { parseDesignText } from '../src/config/parse.js';
import { DesignValidationError } from '../src/errors.js';
import { DESIGNS, dropRecord, readDesign, reflow, vendorConfig } from './helpers.js';

/** Runs parseDesignText, expects a DesignValidationError with text issues and returns their messages. */
function rejected(text: string): string[] {
  let error: unknown;
  try {
    parseDesignText(text);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DesignValidationError);
  const { issues } = error as DesignValidationError;
  expect(issues.every((i) => i.path === '')).toBe(true);
  return issues.map((i) => i.message);
}

test.each(DESIGNS)('%s parses', (name) => expect(() => vendorConfig(name)).not.toThrow());

test('design: map, lists without terminators, records', () => {
  const d = vendorConfig('design');
  expect(d.map).toEqual({
    width: 200,
    height: 80,
    background: 'closed',
    joinDistance: 12,
    tunnelJoinDistance: 18,
    openings: ['W'],
  });
  expect(d.spawnDelay.crawler).toEqual([0, 0, 50, 0, 50, 0, 0, 0, 0, 0, 0]);
  expect(d.crawlers.stepLength).toEqual([3, 3, 3, 3, 3, 3]);
  expect(d.crawlers.corridorWidth).toEqual([15, 15, 7, 7, 3, 3, 2, 2, 1]);
  expect(d.crawlers.random).toEqual({
    perThousandWallSquares: [0],
    genes: {
      straightSingleSpawn: 0,
      straightDoubleSpawn: 20,
      turnSingleSpawn: 0,
      turnDoubleSpawn: 80,
      changeDirection: 20,
    },
  });
  expect(d.crawlers.inTunnels).toEqual({
    enabled: false,
    inAnterooms: false,
    seedCount: 0,
    generation: -1,
    maxAge: 20,
    stepLength: 3,
    genes: {
      straightSingleSpawn: 0,
      straightDoubleSpawn: 0,
      turnSingleSpawn: 0,
      turnDoubleSpawn: 0,
      changeDirection: 0,
    },
    closedProbability: 100,
  });
  expect(d.tunnelers.sizeUpProbability).toEqual([0, 10, 10, 10, 20, 30, 40]);
  expect(d.tunnelers.anteroomProbability).toEqual([20, 20, 50, 0, 0]);
  expect(d.tunnelers.joinPreference).toEqual([0, 0, 10, 100, 100]);
  expect(d.tunnelers.lastChance).toEqual({
    makeRoomsLeft: 80,
    makeRoomsRight: 80,
    changeDirection: 30,
    straightDoubleSpawn: 0,
    turnDoubleSpawn: 30,
    generationDelay: 4,
  });
  expect([
    d.tunnelers.sizeUpGenerationDelay,
    d.tunnelers.columns,
    d.tunnelers.anteroomGenerationSpeedUp,
  ]).toEqual([1, false, 2]);
  expect(d.tunnelers.seeds).toEqual([
    {
      location: { x: 2, y: 40 },
      direction: 'E',
      intendedDirection: 'E',
      dormancy: 0,
      maxAge: 16,
      generation: 0,
      stepLength: 5,
      tunnelWidth: 1,
      genes: {
        straightDoubleSpawn: 25,
        turnDoubleSpawn: 50,
        changeDirection: 30,
        makeRoomsRight: 100,
        makeRoomsLeft: 100,
        joinPreference: 100,
      },
    },
  ]);
  expect(d.rooms).toEqual({
    size: { min: 20, medium: 50, large: 100, max: 300 },
    count: {
      labyrinth: { small: 20, medium: 5, large: 1 },
      dungeon: { small: 100, medium: 20, large: 2 },
    },
    sizeProbability: {
      sideways: [
        { small: 100, medium: 0, large: 0 },
        { small: 100, medium: 0, large: 0 },
        { small: 70, medium: 30, large: 0 },
        { small: 50, medium: 50, large: 0 },
        { small: 0, medium: 50, large: 50 },
      ],
      branching: [
        { small: 100, medium: 0, large: 0 },
        { small: 50, medium: 50, large: 0 },
        { small: 0, medium: 30, large: 70 },
      ],
    },
    aspectRatio: 0.6,
  });
  expect(d.behaviour).toEqual({ mutator: 20, noHeadingProbability: 40, patience: 90 });
  expect(d.population?.mobs.dungeon).toEqual({
    rooms: { groupSize: 4, groupSizeVariance: 2, byLevel: [50, 20, 50, 5, 2] },
    open: { anteroomProbability: 50, byLevel: [0, 30, 0, 20, 2] },
  });
  expect(d.population?.mobs.labyrinth.open.byLevel).toEqual([]);
  expect(d.population?.treasure.dungeon).toEqual({
    groupSize: 0,
    groupSizeVariance: 2,
    byLevel: [3, 3, 2, 2, 1],
  });
});

test('design3A: rectangles swap to screen coordinates', () => {
  const d = vendorConfig('design3A');
  expect(d.map).toMatchObject({ width: 160, height: 81, openings: ['E', 'W'] });
  expect(d.rectangles?.[0]).toEqual({ from: { x: 76, y: 36 }, to: { x: 84, y: 44 }, cell: 'open' });
});

test('design5: crawler seeds and pairs', () => {
  const d = vendorConfig('design5');
  expect(d.crawlers.seeds?.[0]).toEqual({
    location: { x: 70, y: 103 },
    direction: 'N',
    intendedDirection: 'N',
    dormancy: 0,
    maxAge: 40,
    generation: 8,
    stepLength: 3,
    open: true,
    corridorWidth: 1,
    genes: {
      straightSingleSpawn: 0,
      straightDoubleSpawn: 30,
      turnSingleSpawn: 0,
      turnDoubleSpawn: 60,
      changeDirection: 40,
    },
  });
  expect(d.crawlers.pairs?.length).toBe(2);
  expect(d.crawlers.pairs?.[0]?.first).toMatchObject({
    location: { x: 70, y: 15 },
    direction: 'E',
    corridorWidth: 7,
  });
  expect(d.crawlers.pairs?.[0]?.second).toMatchObject({
    location: { x: 70, y: 15 },
    direction: 'W',
  });
  expect(d.crawlers.pairs?.[0]?.first).not.toHaveProperty('open');
});

test.each(DESIGNS)('%s: CRLF, BOM, tabs and wrapped records parse identically', (name) => {
  expect(parseDesignText(reflow(readDesign(name)))).toEqual(vendorConfig(name));
});

test('comments after a complete record and after the D openings', () => {
  const text = readDesign('design')
    .replace(/^T .*$/m, '$& XX trailing comment')
    .replace(/^D .*$/m, '$& XX rest of the line');
  expect(parseDesignText(text)).toEqual(vendorConfig('design'));
});

test('a surplus integer after a complete record is skipped like upstream (designOld1)', () => {
  const text = readDesign('design').replace(/^PR .*$/m, '$& 60');
  expect(parseDesignText(text)).toEqual(vendorConfig('design'));
});

test.each([undefined, 42, new Uint8Array([68])])(
  'a non-string argument (%s) is rejected',
  (value) => {
    expect(rejected(value as unknown as string)).toEqual(['design text must be a string']);
  },
);

test('XX as a crawler intended direction means any', () => {
  const d = parseDesignText(`${readDesign('design')}\nWS 40 2 EA XX 0 16 0 5 1 1 0 30 0 60 40\n`);
  expect(d.crawlers.seeds?.[0]?.intendedDirection).toBe('any');
});

test('population is absent without E1, E2, H1, H2, I1 and I2', () => {
  const text = ['E1', 'E2', 'H1', 'H2', 'I1', 'I2'].reduce(dropRecord, readDesign('design'));
  expect(parseDesignText(text)).not.toHaveProperty('population');
});

test('a duplicate optional record is rejected', () => {
  expect(rejected(`${readDesign('design')}\nF 20 100\n`)).toEqual([
    expect.stringMatching(/^line \d+: duplicate F record$/),
  ]);
});

test('upstream normalisations', () => {
  const text = readDesign('design')
    .replace(/^PR .*$/m, 'PR -5 150 0 80 20')
    .replace(/^M .*$/m, 'M 20 40 90 1 0 0 1.5 0')
    .replace(/^PU .*$/m, 'PU 80 80 30 0 30 0');
  const d = parseDesignText(text);
  expect(d.crawlers.random.genes).toMatchObject({
    straightSingleSpawn: 0,
    straightDoubleSpawn: 100,
  });
  expect([
    d.rooms.aspectRatio,
    d.tunnelers.anteroomGenerationSpeedUp,
    d.tunnelers.lastChance.generationDelay,
  ]).toEqual([0.6, 1, 1]);
});

test('dropped like AcceptDesign: inconsistent WS, inconsistent WP2 pair, inverted R', () => {
  const base = vendorConfig('design5');
  const text = `${readDesign('design5')}
WS 50 50 NO SO 0 20 0 3 1 1 0 30 0 60 40
WP1 50 50 NO NO 0 20 0 3 2 7 0 30 0 50 40
WP2 50 50 NO SO 0 20 0 3 2 7 0 30 0 50 40
R 10 10 5 5 OPEN
`;
  const d = parseDesignText(text);
  expect([d.crawlers.seeds?.length, d.crawlers.pairs?.length, d.rectangles?.length]).toEqual([
    base.crawlers.seeds?.length,
    base.crawlers.pairs?.length,
    base.rectangles?.length,
  ]);
});

test('missing records', () => {
  expect(rejected('D 50 50 CLOSED 12 18\nXX\n')).toEqual(
    expect.arrayContaining(['missing BC record', 'missing T record', 'missing PU record']),
  );
  expect(rejected(dropRecord(readDesign('design'), 'T'))).toEqual(['missing T record']);
});

const design = readDesign('design');
const design5 = readDesign('design5');

test.each([
  ['duplicate record', `${design}\nBC 0 0 50 0 50 0 0 0 0 0 0\n`, /^line \d+: duplicate BC record/],
  ['unknown record', `${design}\nQ 1 2\n`, /^line \d+: unknown record "Q"/],
  ['comment without XX', `X comment\n${design}`, /^line 1: .*XX/],
  [
    'list without terminator',
    `${dropRecord(design, 'S')}\nS 3 3\n`,
    /^line \d+: S record is incomplete/,
  ],
  ['N flag out of range', design.replace(/^N .*$/m, 'N 0 -1 2 0 1 0'), /^line \d+: .*0 or 1/],
  [
    'WS op out of range',
    `${design5}\nWS 103 70 NO NO 0 40 8 3 2 1 0 30 0 60 40\n`,
    /^line \d+: .*0 or 1/,
  ],
  [
    'WP1 not followed by WP2',
    `${design5}\nWP1 15 70 EA EA 0 20 0 3 2 7 0 30 0 50 40\nXX\nWP2 15 70 WE WE 0 20 0 3 2 7 0 30 0 50 40\n`,
    /^line \d+: WP1 must be followed by WP2/,
  ],
  [
    'diagonal tunneler start direction',
    `${design}\nU 40 2 NE NE 0 16 0 5 1 25 50 30 100 100 100\n`,
    /^line \d+: .*direction/,
  ],
  ['non-numeric value', `${design}\nR 1 2 3 x OPEN\n`, /^line \d+: expected an integer/],
  ['value beyond int32', `${design}\nR 1 2 2147483648 4 OPEN\n`, /^line \d+: expected an integer/],
  [
    'room size probabilities not summing to 100',
    design.replace(/^GS .*$/m, 'GS 100 0 0 50 40 0 0 0 100'),
    /^line \d+: .*100/,
  ],
  [
    'WP2 without WP1',
    `${design}\nWP2 15 70 WE WE 0 20 0 3 2 7 0 30 0 50 40\n`,
    /^line \d+: WP2 must directly follow/,
  ],
  [
    'inconsistent WP1',
    `${design5}\nWP1 15 70 NO SO 0 20 0 3 2 7 0 30 0 50 40\nWP2 15 70 WE WE 0 20 0 3 2 7 0 30 0 50 40\n`,
    /^line \d+: WP1 has inconsistent/,
  ],
  [
    'XX as tunneler intended direction',
    `${design}\nU 40 2 EA XX 0 16 0 5 1 25 50 30 100 100 100\n`,
    /^line \d+: .*intended direction/,
  ],
  ['comment inside a record', `${design}\nR 1 2\nXX\n`, /^line \d+: R record is interrupted/],
  ['aspect ratio beyond double', design.replace(/^M .*$/m, 'M 20 40 90 1 0 0 1e400 2'), /a number/],
])('rejects %s', (_label, text, message) => {
  const messages = rejected(text);
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatch(message);
});
