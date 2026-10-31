// SPDX-License-Identifier: GPL-3.0-or-later
import { CELL_NAMES } from '../config/tokens.js';
import { VERSION } from '../version.js';
import type { ExportableDungeon } from './dungeon-json.js';
import { TILESET_IMAGE } from './png.js';

export interface TiledOptions {
  /** Default 16. */
  tileWidth?: number;
  /** Default 16. */
  tileHeight?: number;
  /** Default {@link TILESET_IMAGE}. */
  tilesetImage?: string;
  /** Default `dungeonmaker-js@<version>`. */
  generator?: string;
}

interface Property {
  name: string;
  type: 'string' | 'int';
  value: string | number;
}
const str = (name: string, value: string): Property => ({ name, type: 'string', value });
const int = (name: string, value: number): Property => ({ name, type: 'int', value });

function tileSize(value: number | undefined, name: string): number {
  const v = value ?? 16;
  if (!Number.isInteger(v) || v < 1 || v > 1024) {
    throw new RangeError(`${name} must be an integer from 1 to 1024, got ${v}`);
  }
  return v;
}

/** The dungeon as a Tiled JSON map (`.tmj`, 2-space JSON plus a trailing newline). */
export function toTiledMap(dungeon: ExportableDungeon, options: TiledOptions = {}): string {
  const tw = tileSize(options.tileWidth, 'tileWidth');
  const th = tileSize(options.tileHeight, 'tileHeight');
  const { width, height } = dungeon;
  const layers: object[] = [
    {
      id: 1,
      name: 'cells',
      type: 'tilelayer',
      x: 0,
      y: 0,
      width,
      height,
      opacity: 1,
      visible: true,
      data: Array.from(dungeon.cells, (c) => c + 1),
    },
  ];
  let nextObjectId = 1;
  const objectLayer = (name: string, objects: object[]) => ({
    id: layers.length + 1,
    name,
    type: 'objectgroup',
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    draworder: 'topdown',
    objects,
  });
  if (dungeon.rooms) {
    layers.push(
      objectLayer(
        'rooms',
        dungeon.rooms.rooms.map((r) => ({
          id: nextObjectId++,
          name: `room-${r.id}`,
          type: 'room',
          x: r.bounds.x * tw,
          y: r.bounds.y * th,
          width: r.bounds.width * tw,
          height: r.bounds.height * th,
          rotation: 0,
          visible: true,
          properties: [str('area', r.area), int('size', r.size)],
        })),
      ),
    );
  }
  if (dungeon.entities) {
    layers.push(
      objectLayer(
        'entities',
        dungeon.entities.map((e) => ({
          id: nextObjectId++,
          name: e.kind,
          type: e.kind,
          point: true,
          x: e.x * tw + tw / 2,
          y: e.y * th + th / 2,
          width: 0,
          height: 0,
          rotation: 0,
          visible: true,
          properties: [str('kind', e.kind), int('level', e.level)],
        })),
      ),
    );
  }
  const tilesetImage = options.tilesetImage ?? TILESET_IMAGE;
  const map = {
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    compressionlevel: -1,
    width,
    height,
    tilewidth: tw,
    tileheight: th,
    nextlayerid: layers.length + 1,
    nextobjectid: nextObjectId,
    properties: [
      str('generator', options.generator ?? `dungeonmaker-js@${VERSION}`),
      int('seed', dungeon.seed),
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'dungeonmaker',
        tilewidth: tw,
        tileheight: th,
        tilecount: CELL_NAMES.length,
        columns: CELL_NAMES.length,
        margin: 0,
        spacing: 0,
        image: tilesetImage,
        imagewidth: CELL_NAMES.length * tw,
        imageheight: th,
        tiles: CELL_NAMES.map((type, id) => ({ id, type })),
      },
    ],
    layers,
  };
  return `${JSON.stringify(map, null, 2)}\n`;
}
