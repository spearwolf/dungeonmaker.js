// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * The JSON design model as a TypeBox schema: the single source for the
 * TypeScript types (`Static<…>`) and for `design.schema.json`.
 *
 * Coordinates use the screen convention (`x` column, `y` row, north up); the
 * swap to the library's row/column order lives in `config/axes.ts`. Arrays never
 * contain the list terminator of the text format; the serializer appends it.
 * Each description ends with the upstream record and field it maps to.
 */

import Type, { type Static, type TSchema } from 'typebox';
import {
  ANY_DIRECTION,
  BACKGROUNDS,
  CARDINAL_DIRECTIONS,
  CELL_NAMES,
  DIRECTIONS,
  DOUBLE_MIN_NORMAL,
} from '../config/tokens.js';

export const DESIGN_SCHEMA_ID = 'https://unpkg.com/dungeonmaker-js/design.schema.json';

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

interface IntBounds {
  min?: number;
  max?: number;
}

/** Integer within int32 (the parser reads `>> int`), optionally narrower. */
const int = (description: string, { min = INT32_MIN, max = INT32_MAX }: IntBounds = {}) =>
  Type.Integer({ minimum: min, maximum: max, description });

/** Percentage: integer 0…100. */
const percent = (description: string) => int(description, { min: 0, max: 100 });

const bool = (description: string) => Type.Boolean({ description });

const strict = { additionalProperties: false } as const;

const withDescription = <T extends TSchema>(
  description: string,
  make: (options: { description: string }) => T,
): T => make({ description });

// ---------------------------------------------------------------------------
// Helper types

const pointOf = (description?: string) =>
  Type.Object(
    {
      x: int('Column, counted from the left edge (0 = leftmost).', { min: 0 }),
      y: int('Row, counted from the top edge (0 = topmost, north is up).', { min: 0 }),
    },
    description ? { ...strict, description } : strict,
  );

export const PointSchema = pointOf();
export type Point = Static<typeof PointSchema>;

const DirectionSchema = (description: string) => Type.Enum([...DIRECTIONS], { description });
const CardinalDirectionSchema = (description: string) =>
  Type.Enum([...CARDINAL_DIRECTIONS], { description });

const genesOf = (description: string) =>
  Type.Object(
    {
      straightSingleSpawn: percent(
        'Percent chance per step that a straight step spawns one new builder. Upstream: sSSP.',
      ),
      straightDoubleSpawn: percent(
        'Percent chance per step that a straight step spawns two new builders. Upstream: sDSP.',
      ),
      turnSingleSpawn: percent(
        'Percent chance that a turn spawns one new builder. Upstream: tSSP.',
      ),
      turnDoubleSpawn: percent(
        'Percent chance that a turn spawns two new builders. Upstream: tDSP.',
      ),
      changeDirection: percent(
        'Percent chance per step that the builder changes direction. Upstream: cDP.',
      ),
    },
    { ...strict, description },
  );

export const GenesSchema = genesOf('Inheritable behaviour of a crawler.');
export type Genes = Static<typeof GenesSchema>;

const crawlerBaseFields = {
  location: pointOf('Start cell of the crawler. Upstream: WS locX locY.'),
  direction: CardinalDirectionSchema('Initial heading of the crawler. Upstream: WS dir.'),
  intendedDirection: Type.Union(
    [
      DirectionSchema('A compass direction the crawler tries to head to.'),
      Type.Literal(ANY_DIRECTION, { description: 'No preferred direction.' }),
    ],
    {
      description: `Direction the crawler prefers to travel to, or "${ANY_DIRECTION}" for none. Upstream: WS intDir (XX = any).`,
    },
  ),
  dormancy: int('Number of steps the crawler waits before it starts to dig. Upstream: WS dorm.', {
    min: 0,
  }),
  maxAge: int('Number of steps after which the crawler dies. Upstream: WS maxAge.', { min: 0 }),
  generation: int(
    'Generation of the crawler; indexes the per-generation lists (stepLength, corridorWidth, maxAge, random). Upstream: WS gen.',
    { min: 0 },
  ),
  stepLength: int('Length of one straight run in cells. Upstream: WS sL.', { min: 1 }),
  corridorWidth: int(
    'Number of cells the crawler leaves open between the cells it fills and those already filled; at least 1. Upstream: WS cW.',
    { min: 1 },
  ),
  genes: genesOf('Gene set the crawler hands down to its offspring. Upstream: WS genes.'),
};

export const CrawlerSeedSchema = Type.Object(
  {
    ...crawlerBaseFields,
    open: bool(
      'true: the crawler always leaves an opening at the end of its run; false: it tries to connect its wall to an existing closed cell. Upstream: WS op.',
    ),
  },
  strict,
);
export type CrawlerSeed = Static<typeof CrawlerSeedSchema>;

export const CrawlerPairMemberSchema = Type.Object(crawlerBaseFields, strict);
export type CrawlerPairMember = Static<typeof CrawlerPairMemberSchema>;

export const TunnelerGenesSchema = Type.Object(
  {
    straightDoubleSpawn: percent(
      'Percent chance per step that a straight step spawns two tunnelers. Upstream: sDSP.',
    ),
    turnDoubleSpawn: percent('Percent chance that a turn spawns two tunnelers. Upstream: tDSP.'),
    changeDirection: percent(
      'Percent chance per step that the tunneler changes direction. Upstream: cDP.',
    ),
    makeRoomsRight: percent(
      'Percent chance per step that a room is made on the right side. Upstream: mRRP.',
    ),
    makeRoomsLeft: percent(
      'Percent chance per step that a room is made on the left side. Upstream: mRLP.',
    ),
    joinPreference: percent('Percent preference to join existing open areas. Upstream: jP.'),
  },
  { ...strict, description: 'Inheritable behaviour of a tunneler.' },
);
export type TunnelerGenes = Static<typeof TunnelerGenesSchema>;

export const TunnelerSeedSchema = Type.Object(
  {
    location: pointOf('Start cell of the tunneler. Upstream: U locX locY.'),
    direction: CardinalDirectionSchema('Initial heading of the tunneler. Upstream: U dir.'),
    intendedDirection: DirectionSchema(
      'Direction the tunneler prefers to travel to. Upstream: U intDir.',
    ),
    dormancy: int('Number of steps the tunneler waits before it starts to dig. Upstream: U dorm.', {
      min: 0,
    }),
    maxAge: int('Number of steps after which the tunneler dies. Upstream: U maxAge.', { min: 0 }),
    generation: int('Generation of the tunneler. Upstream: U gen.', { min: 0 }),
    stepLength: int('Length of one straight run in cells. Upstream: U sL.', { min: 1 }),
    tunnelWidth: int('Width of the tunnel in cells; indexes the per-width lists. Upstream: U tW.', {
      min: 0,
    }),
    genes: TunnelerGenesSchema,
  },
  strict,
);
export type TunnelerSeed = Static<typeof TunnelerSeedSchema>;

export const RoomSizeProbabilitySchema = Type.Object(
  {
    small: percent('Percent chance of a small room.'),
    medium: percent('Percent chance of a medium room.'),
    large: int(
      'Percent chance of a large room; at most 99, because the list terminator (0 0 100) must stay unambiguous.',
      { min: 0, max: 99 },
    ),
  },
  { ...strict, description: 'Room size distribution; the three values sum to 100.' },
);
export type RoomSizeProbability = Static<typeof RoomSizeProbabilitySchema>;

export const RectangleSchema = Type.Object(
  {
    from: pointOf('Top-left corner (inclusive). Upstream: R sX sY.'),
    to: pointOf('Bottom-right corner (inclusive). Upstream: R eX eY.'),
    cell: Type.Enum([...CELL_NAMES], {
      description: 'Cell type the rectangle is filled with. Upstream: R type.',
    }),
  },
  strict,
);
export type Rectangle = Static<typeof RectangleSchema>;

// ---------------------------------------------------------------------------
// Population

const groupOf = (description: string) =>
  Type.Object(
    {
      groupSize: int('Base number of entities per group. Upstream: groupSize.', { min: 0 }),
      groupSizeVariance: int(
        'Random variance added to the group size. Upstream: groupSizeVariance.',
        { min: 0 },
      ),
      byLevel: Type.Array(int('Count for one dungeon level.', { min: 0 }), {
        description:
          'Group count per dungeon level; the index is the level. The serializer appends the terminator -1. Upstream: trailing list.',
      }),
    },
    { ...strict, description },
  );

export const PopulationSchema = Type.Object(
  {
    mobs: Type.Object(
      {
        labyrinth: Type.Object(
          {
            rooms: groupOf('Mob groups placed in rooms of the labyrinth. Upstream: E1.'),
            open: Type.Object(
              {
                byLevel: Type.Array(int('Count for one dungeon level.', { min: 0 }), {
                  description:
                    'Mobs in open labyrinth areas per dungeon level; the index is the level. Upstream: E2 list.',
                }),
              },
              { ...strict, description: 'Mobs in open areas of the labyrinth. Upstream: E2.' },
            ),
          },
          { ...strict, description: 'Mobs of the labyrinth.' },
        ),
        dungeon: Type.Object(
          {
            rooms: groupOf('Mob groups placed in rooms of the dungeon. Upstream: H1.'),
            open: Type.Object(
              {
                anteroomProbability: percent(
                  'Percent chance that a mob is placed in an anteroom. Upstream: H2 first value.',
                ),
                byLevel: Type.Array(int('Count for one dungeon level.', { min: 0 }), {
                  description:
                    'Mobs in open dungeon areas per dungeon level; the index is the level. Upstream: H2 list.',
                }),
              },
              { ...strict, description: 'Mobs in open areas of the dungeon. Upstream: H2.' },
            ),
          },
          { ...strict, description: 'Mobs of the dungeon.' },
        ),
      },
      { ...strict, description: 'Mob placement.' },
    ),
    treasure: Type.Object(
      {
        labyrinth: groupOf('Treasure groups of the labyrinth. Upstream: I1.'),
        dungeon: groupOf('Treasure groups of the dungeon. Upstream: I2.'),
      },
      { ...strict, description: 'Treasure placement.' },
    ),
  },
  {
    ...strict,
    description: 'Entity placement; parsed and serialized, effective only with entity output.',
  },
);
export type Population = Static<typeof PopulationSchema>;

// ---------------------------------------------------------------------------
// Design config

const percentList = (description: string, extra: { minItems?: number; maxItems?: number } = {}) =>
  Type.Array(percent('Percent value.'), { description, ...extra });

const sizeProbabilityList = (description: string) =>
  Type.Array(RoomSizeProbabilitySchema, { description });

const roomCount = (description: string) =>
  Type.Object(
    {
      small: int('Number of small rooms.', { min: 0 }),
      medium: int('Number of medium rooms.', { min: 0 }),
      large: int('Number of large rooms.', { min: 0 }),
    },
    { ...strict, description },
  );

const DesignConfigObject = Type.Object(
  {
    $schema: Type.Optional(
      Type.String({ description: 'JSON Schema URL for editor support; ignored by the parser.' }),
    ),
    map: Type.Object(
      {
        width: int('Map width in cells (columns). Upstream: D dimY.', { min: 3, max: 4096 }),
        height: int('Map height in cells (rows). Upstream: D dimX.', { min: 3, max: 4096 }),
        background: Type.Enum([...BACKGROUNDS], {
          description: 'Initial fill of the map before any builder digs. Upstream: D background.',
        }),
        joinDistance: int(
          'Maximum distance in cells over which open areas are joined. Upstream: D joinDist.',
          {
            min: 0,
          },
        ),
        tunnelJoinDistance: int(
          'Maximum distance in cells over which tunnels are joined. Upstream: D tunnelJoinDist.',
          { min: 0 },
        ),
        openings: Type.Array(DirectionSchema('A map edge or corner that is kept open.'), {
          description:
            'Directions in which the map border is opened; may be empty. Upstream: D openings (ends with XX).',
        }),
      },
      { ...strict, description: 'Map dimensions and basic joining behaviour. Upstream: D.' },
    ),
    rectangles: Type.Optional(
      Type.Array(RectangleSchema, {
        description:
          'Rectangles drawn onto the map before generation, in order; later ones overwrite earlier ones. Upstream: R.',
      }),
    ),
    spawnDelay: Type.Object(
      {
        crawler: percentList(
          'Eleven percent values, summing to 100: distribution of the delay before crawlers spawn; the index is the delay. Upstream: BC.',
          { minItems: 11, maxItems: 11 },
        ),
        roomie: percentList(
          'Eleven percent values, summing to 100: distribution of the delay before room builders spawn. Upstream: BR.',
          { minItems: 11, maxItems: 11 },
        ),
        tunneler: percentList(
          'Eleven percent values, summing to 100: distribution of the delay before tunnelers spawn. Upstream: BT.',
          { minItems: 11, maxItems: 11 },
        ),
      },
      { ...strict, description: 'Spawn delay distributions. Upstream: BC, BR, BT.' },
    ),
    crawlers: Type.Object(
      {
        stepLength: Type.Array(int('Step length in cells.', { min: 1 }), {
          minItems: 1,
          description:
            'Step length per generation; the index is the generation, beyond the end the last value applies. Upstream: S (terminator 0).',
        }),
        corridorWidth: Type.Array(int('Corridor width in cells.', { min: 1 }), {
          minItems: 1,
          description:
            'Corridor width per generation; beyond the end the last value applies. Upstream: C (terminator 0).',
        }),
        maxAge: Type.Array(int('Maximum age in steps.', { min: 1 }), {
          minItems: 1,
          description:
            'Maximum age per generation; beyond the end the last value applies. Upstream: AC (terminator 0).',
        }),
        random: Type.Object(
          {
            perThousandWallSquares: Type.Array(
              int('Crawlers per thousand wall cells.', { min: 0, max: 98 }),
              {
                description:
                  'Randomly seeded crawlers per thousand wall cells, per generation; beyond the end no crawlers are seeded. Upstream: K (terminator 99).',
              },
            ),
            genes: genesOf('Gene set of the randomly seeded crawlers. Upstream: PR.'),
          },
          { ...strict, description: 'Randomly seeded crawlers. Upstream: K, PR.' },
        ),
        inTunnels: Type.Object(
          {
            enabled: bool(
              'Whether tunnelers may spawn crawlers. Upstream: M crawlersInTunnels (non-zero = true).',
            ),
            inAnterooms: bool(
              'Whether crawlers are also seeded in anterooms. Upstream: N crawlersInAnterooms.',
            ),
            seedCount: int(
              'Number of crawlers seeded in tunnels. Upstream: N seedCrawlersInTunnels.',
              { min: 0 },
            ),
            generation: int(
              'Generation of the tunnel crawlers; -1 means after all other builders. Upstream: N tunnelCrawlerGeneration.',
              { min: -1 },
            ),
            maxAge: int('Maximum age of tunnel crawlers in steps. Upstream: PT maxAge.', {
              min: 0,
            }),
            stepLength: int('Step length of tunnel crawlers in cells. Upstream: PT sL.', {
              min: 1,
            }),
            genes: genesOf('Gene set of tunnel crawlers. Upstream: PT genes.'),
            closedProbability: percent(
              'Percent chance that a tunnel crawler digs closed cells. Upstream: PT closedProb.',
            ),
          },
          { ...strict, description: 'Crawlers spawned from tunnels. Upstream: M, N, PT.' },
        ),
        seeds: Type.Optional(
          Type.Array(CrawlerSeedSchema, {
            description: 'Explicitly placed crawlers. Upstream: WS.',
          }),
        ),
        pairs: Type.Optional(
          Type.Array(
            Type.Object(
              {
                first: withDescription('First crawler of the pair. Upstream: WP1.', (o) =>
                  Type.Object(CrawlerPairMemberSchema.properties, { ...strict, ...o }),
                ),
                second: withDescription('Second crawler of the pair. Upstream: WP2.', (o) =>
                  Type.Object(CrawlerPairMemberSchema.properties, { ...strict, ...o }),
                ),
              },
              strict,
            ),
            {
              description:
                'Explicitly placed pairs of crawlers that start together. Upstream: WP1, WP2.',
            },
          ),
        ),
      },
      {
        ...strict,
        description: 'Crawler behaviour. Upstream: S, C, AC, K, PR, M, N, PT, WS, WP1, WP2.',
      },
    ),
    tunnelers: Type.Object(
      {
        sizeUpProbability: percentList(
          'Percent chance that the offspring of a tunneler gets a tunnel one cell wider, per generation of the parent; beyond the end the last value applies. Per generation, sizeUpProbability + sizeDownProbability must not exceed 100. Upstream: ZU (terminator -1).',
          { minItems: 1 },
        ),
        sizeDownProbability: percentList(
          'Percent chance that the offspring of a tunneler gets a tunnel one cell narrower, per generation of the parent; beyond the end the last value applies. Upstream: ZD (terminator -1).',
          { minItems: 1 },
        ),
        anteroomProbability: Type.Array(
          int('Percent chance of an anteroom.', { min: 0, max: 99 }),
          {
            description:
              'Percent chance of an anteroom per tunnel width; beyond the end the value is 100. Upstream: F (terminator 100).',
          },
        ),
        joinPreference: percentList(
          'Preference to join existing areas, per generation. DungeonMaker 2.05 reads this list but never uses it (GetJoinPref has no caller); it only has to be non-empty. Upstream: J (terminator -1).',
          { minItems: 1 },
        ),
        maxAge: Type.Array(int('Maximum age in steps.', { min: 1 }), {
          minItems: 1,
          description:
            'Maximum age per generation; beyond the end the last value applies. Upstream: AT (terminator 0).',
        }),
        sizeUpGenerationDelay: int(
          'Generational delay for tunneler offspring that are wider than their parents; overrides the normal delay of spawnDelay.tunneler. Upstream: M sizeUpGenDelay.',
          {
            min: 0,
          },
        ),
        columns: bool(
          'Whether tunnels get columns. Upstream: M columnsInTunnels (non-zero = true).',
        ),
        anteroomGenerationSpeedUp: int(
          'Generation speed-up when a tunneler makes an anteroom. Upstream: M genSpeedUpOnAnteRoom.',
          { min: 1 },
        ),
        lastChance: Type.Object(
          {
            makeRoomsLeft: percent(
              'Percent chance to make a room on the left. Upstream: PU, 1st value.',
            ),
            makeRoomsRight: percent(
              'Percent chance to make a room on the right. Upstream: PU, 2nd value.',
            ),
            changeDirection: percent(
              'Percent chance to change direction. Upstream: PU, 3rd value.',
            ),
            straightDoubleSpawn: percent(
              'Percent chance of a double spawn on a straight step. Upstream: PU, 4th value.',
            ),
            turnDoubleSpawn: percent(
              'Percent chance of a double spawn on a turn. Upstream: PU, 5th value.',
            ),
            generationDelay: int(
              'Generation delay of the last-chance tunnelers. Upstream: PU, 6th value.',
              { min: 1 },
            ),
          },
          {
            ...strict,
            description: 'Last-chance tunnelers that clean up unreached areas. Upstream: PU.',
          },
        ),
        seeds: Type.Optional(
          Type.Array(TunnelerSeedSchema, {
            description: 'Explicitly placed tunnelers. Upstream: U.',
          }),
        ),
      },
      { ...strict, description: 'Tunneler behaviour. Upstream: ZU, ZD, F, J, AT, M, PU, U.' },
    ),
    rooms: Type.Object(
      {
        size: Type.Object(
          {
            min: int('Smallest room edge length in cells. Upstream: T 1st value.', { min: 0 }),
            medium: int('Medium room edge length in cells. Upstream: T 2nd value.', { min: 0 }),
            large: int('Large room edge length in cells. Upstream: T 3rd value.', { min: 0 }),
            max: int('Largest room edge length in cells. Upstream: T 4th value.', { min: 0 }),
          },
          { ...strict, description: 'Room edge lengths. Upstream: T 1-4.' },
        ),
        count: Type.Object(
          {
            labyrinth: roomCount('Rooms of the labyrinth. Upstream: T 5-7.'),
            dungeon: roomCount('Rooms of the dungeon. Upstream: T 8-10.'),
          },
          { ...strict, description: 'Number of rooms per size. Upstream: T 5-10.' },
        ),
        sizeProbability: Type.Object(
          {
            sideways: sizeProbabilityList(
              'Room size distribution for rooms beside a tunnel, per tunnel width; beyond the end every room is large (0/0/100). Upstream: GS (terminator 0 0 100).',
            ),
            branching: sizeProbabilityList(
              'Room size distribution for rooms at a tunnel branch, per tunnel width; beyond the end every room is large (0/0/100). Upstream: GB (terminator 0 0 100).',
            ),
          },
          { ...strict, description: 'Room size distributions. Upstream: GS, GB.' },
        ),
        aspectRatio: Type.Number({
          minimum: DOUBLE_MIN_NORMAL,
          exclusiveMaximum: 1,
          description:
            'Ratio of the short to the long room edge, between 0 and 1 exclusive; the lower bound is the smallest normal double, because the design text cannot carry a subnormal number. Upstream: M roomAspectRatio.',
        }),
      },
      { ...strict, description: 'Room generation. Upstream: T, GS, GB, M.' },
    ),
    behaviour: Type.Object(
      {
        mutator: int('Mutation strength applied to inherited genes. Upstream: M mutator.', {
          min: 0,
        }),
        patience: int(
          'Steps a builder tolerates without progress before it gives up. Upstream: M patience.',
          {
            min: 0,
          },
        ),
        noHeadingProbability: percent(
          'Percent chance that a builder ignores its intended direction. Upstream: M noHeadingProb.',
        ),
      },
      { ...strict, description: 'General builder behaviour. Upstream: M.' },
    ),
    population: Type.Optional(PopulationSchema),
  },
  {
    ...strict,
    $id: DESIGN_SCHEMA_ID,
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'DungeonMaker design',
    description:
      'A DungeonMaker 2.05 design as JSON. Coordinates: x = column, y = row, north is up.',
  },
);

/** The root schema; TypeBox does not type root options, so `$id` and `$schema` are added to the type here. */
export const DesignConfigSchema: typeof DesignConfigObject & {
  readonly $id: typeof DESIGN_SCHEMA_ID;
  readonly $schema: 'https://json-schema.org/draft/2020-12/schema';
} = DesignConfigObject as never;
export type DesignConfig = Static<typeof DesignConfigSchema>;
