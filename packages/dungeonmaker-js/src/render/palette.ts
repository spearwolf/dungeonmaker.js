// SPDX-License-Identifier: GPL-3.0-or-later
import { CELL_NAMES, type CellName } from '../config/tokens.js';

/** A color per cell name, as `#rrggbb` (`#rgb` is accepted in overrides). */
export type Palette = Readonly<Record<CellName, string>>;

/** Colors of the legacy demo, assigned by cell name. */
export const DEFAULT_PALETTE: Palette = {
  open: '#f0f0f0',
  closed: '#303030',
  guaranteedOpen: '#f0f0f0',
  guaranteedClosed: '#303030',
  nonJoinOpen: '#f0f0f0',
  nonJoinClosed: '#303030',
  nonJoinGuaranteedOpen: '#f0f0f0',
  nonJoinGuaranteedClosed: '#303030',
  insideRoomOpen: '#f0f0f0',
  insideTunnelOpen: '#e8e8e8',
  insideAnteroomOpen: '#e0e0e0',
  horizontalDoor: '#a04000',
  verticalDoor: '#a04000',
  mob1: '#ff0040',
  mob2: '#f00030',
  mob3: '#e00020',
  treasure1: '#ffff00',
  treasure2: '#f0f000',
  treasure3: '#e0e000',
  column: '#00ff00',
};

const LONG = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const SHORT = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;

function parseColor(name: string, value: unknown): [number, number, number] {
  if (typeof value === 'string') {
    const long = LONG.exec(value);
    if (long)
      return [
        parseInt(long[1] ?? '', 16),
        parseInt(long[2] ?? '', 16),
        parseInt(long[3] ?? '', 16),
      ];
    const short = SHORT.exec(value);
    if (short) {
      return [
        parseInt((short[1] ?? '') + (short[1] ?? ''), 16),
        parseInt((short[2] ?? '') + (short[2] ?? ''), 16),
        parseInt((short[3] ?? '') + (short[3] ?? ''), 16),
      ];
    }
  }
  throw new TypeError(
    `palette.${name} must be a color like "#rrggbb" or "#rgb", got ${JSON.stringify(value)}`,
  );
}

/** The palette (defaults plus overrides) as 20 * 3 RGB bytes, index = `Cell`. */
export function paletteRgb(palette?: Partial<Palette>): Uint8Array {
  const out = new Uint8Array(CELL_NAMES.length * 3);
  for (const [i, name] of CELL_NAMES.entries()) {
    const [r, g, b] = parseColor(name, palette?.[name] ?? DEFAULT_PALETTE[name]);
    out.set([r, g, b], i * 3);
  }
  return out;
}
