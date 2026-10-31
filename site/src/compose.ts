// SPDX-License-Identifier: GPL-3.0-or-later
import type { EntityLayer, RoomLayer } from 'dungeonmaker-js';
import { type DungeonLike, type Raster, toRgba } from 'dungeonmaker-js/render';

type Rgb = readonly [number, number, number];

export const MOB_RGB: Rgb = [0xe5, 0x48, 0x4d];
export const TREASURE_RGB: Rgb = [0xf5, 0xc5, 0x18];

/** Share of the room colour mixed over the base colour. */
const ROOM_MIX = 0.35;
const GOLDEN_ANGLE = 137.508;

function hslToRgb(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Golden-angle hue, so consecutive ids stay far apart: `hsl((id * 137.508) mod 360, 60%, 55%)`. */
export function roomColor(id: number): Rgb {
  return hslToRgb((((id * GOLDEN_ANGLE) % 360) + 360) % 360, 0.6, 0.55);
}

export interface ComposeOptions {
  rooms: boolean;
  entities: boolean;
  /** Cells of a step player frame, replacing `dungeon.cells`. */
  cells?: Uint8Array;
}

/** One pixel per cell (scale 1): base colours, then room tint, then entity pixels. */
export function composeRgba(
  dungeon: DungeonLike & { rooms?: RoomLayer; entities?: EntityLayer },
  options: ComposeOptions,
): Raster {
  const { width, height } = dungeon;
  const raster = toRgba({ width, height, cells: options.cells ?? dungeon.cells });
  const data = raster.data;
  if (options.rooms && dungeon.rooms) {
    const { roomIds } = dungeon.rooms;
    const colors = new Map<number, Rgb>();
    for (let i = 0; i < roomIds.length; i++) {
      const id = roomIds[i] as number;
      if (id === 0) continue;
      let c = colors.get(id);
      if (!c) {
        c = roomColor(id);
        colors.set(id, c);
      }
      for (let k = 0; k < 3; k++) {
        data[i * 4 + k] = Math.round(
          (data[i * 4 + k] as number) * (1 - ROOM_MIX) + (c[k] as number) * ROOM_MIX,
        );
      }
    }
  }
  if (options.entities && dungeon.entities) {
    for (const e of dungeon.entities) {
      if (e.x < 0 || e.y < 0 || e.x >= width || e.y >= height) continue;
      const i = (e.y * width + e.x) * 4;
      const c = e.kind === 'mob' ? MOB_RGB : TREASURE_RGB;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return raster;
}
