// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Token tables of the legacy design text format (DungeonMaker 2.05) and the
 * JSON names they map to. Plain data, no TypeBox: config code imports this
 * file at runtime, the schema module imports it to build its enums.
 */

/** The eight compass directions; JSON names, in the order of the upstream enum. */
export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Directions a crawler or tunneler may face (diagonals are only intended headings). */
export const CARDINAL_DIRECTIONS = ['N', 'E', 'S', 'W'] as const;
export type CardinalDirection = (typeof CARDINAL_DIRECTIONS)[number];

/** Design text token per direction. */
export const DIRECTION_TOKENS: Readonly<Record<Direction, string>> = {
  N: 'NO',
  NE: 'NE',
  E: 'EA',
  SE: 'SE',
  S: 'SO',
  SW: 'SW',
  W: 'WE',
  NW: 'NW',
};

/** JSON value of an unconstrained intended direction of a crawler seed. */
export const ANY_DIRECTION = 'any';
/** Design text token for {@link ANY_DIRECTION}. */
export const ANY_DIRECTION_TOKEN = 'XX';

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

/**
 * Whether upstream accepts a start direction together with an intended direction:
 * `'any'` always, otherwise only the combinations of `Config::ValidateDirections`.
 * The parser drops inconsistent legacy crawlers; the semantic check rejects them.
 */
export function areDirectionsConsistent(
  direction: Direction,
  intendedDirection: Direction | typeof ANY_DIRECTION,
): boolean {
  return (
    intendedDirection === ANY_DIRECTION || CONSISTENT_STARTS[intendedDirection].includes(direction)
  );
}

/** Background fill of the map. */
export const BACKGROUNDS = ['open', 'closed'] as const;
export type Background = (typeof BACKGROUNDS)[number];

/** Cell names in the order of the `Cell` constant (= `alifegames::SquareData`). */
export const CELL_NAMES = [
  'open',
  'closed',
  'guaranteedOpen',
  'guaranteedClosed',
  'nonJoinOpen',
  'nonJoinClosed',
  'nonJoinGuaranteedOpen',
  'nonJoinGuaranteedClosed',
  'insideRoomOpen',
  'insideTunnelOpen',
  'insideAnteroomOpen',
  'horizontalDoor',
  'verticalDoor',
  'mob1',
  'mob2',
  'mob3',
  'treasure1',
  'treasure2',
  'treasure3',
  'column',
] as const;
export type CellName = (typeof CELL_NAMES)[number];

/** Design text token (upstream `SquareData` name) per cell name. */
export const CELL_TOKENS: Readonly<Record<CellName, string>> = {
  open: 'OPEN',
  closed: 'CLOSED',
  guaranteedOpen: 'G_OPEN',
  guaranteedClosed: 'G_CLOSED',
  nonJoinOpen: 'NJ_OPEN',
  nonJoinClosed: 'NJ_CLOSED',
  nonJoinGuaranteedOpen: 'NJ_G_OPEN',
  nonJoinGuaranteedClosed: 'NJ_G_CLOSED',
  insideRoomOpen: 'IR_OPEN',
  insideTunnelOpen: 'IT_OPEN',
  insideAnteroomOpen: 'IA_OPEN',
  horizontalDoor: 'H_DOOR',
  verticalDoor: 'V_DOOR',
  mob1: 'MOB1',
  mob2: 'MOB2',
  mob3: 'MOB3',
  treasure1: 'TREAS1',
  treasure2: 'TREAS2',
  treasure3: 'TREAS3',
  column: 'COLUMN',
};

/**
 * Smallest positive normal double. `>> double` reports anything closer to zero as a range
 * error, so the design text carries no subnormal number (the only real one: the aspect ratio).
 */
export const DOUBLE_MIN_NORMAL = 2.2250738585072014e-308;
