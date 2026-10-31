// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Cell values of a generated dungeon. The numbering is the order of the
 * library enum `alifegames::SquareData`, so the bridge can copy cells without
 * a translation table.
 */
export const Cell = {
  Open: 0,
  Closed: 1,
  GuaranteedOpen: 2,
  GuaranteedClosed: 3,
  NonJoinOpen: 4,
  NonJoinClosed: 5,
  NonJoinGuaranteedOpen: 6,
  NonJoinGuaranteedClosed: 7,
  InsideRoomOpen: 8,
  InsideTunnelOpen: 9,
  InsideAnteroomOpen: 10,
  HorizontalDoor: 11,
  VerticalDoor: 12,
  Mob1: 13,
  Mob2: 14,
  Mob3: 15,
  Treasure1: 16,
  Treasure2: 17,
  Treasure3: 18,
  Column: 19,
} as const;

export type Cell = (typeof Cell)[keyof typeof Cell];
