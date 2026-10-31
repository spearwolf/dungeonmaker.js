// SPDX-License-Identifier: GPL-3.0-or-later
import {
  type ExportableDungeon,
  TILESET_IMAGE,
  toAsciiText,
  toDungeonJson,
  toPng,
  toRaw,
  toTiledMap,
  toTilesetPng,
  VERSION,
} from 'dungeonmaker-js/export';
import { DESIGN_FILE, designFileText, type ResolvedSource } from './source';

export type DownloadKind = 'json' | 'png' | 'tmj' | 'tileset' | 'txt' | 'bin' | 'design';

export interface DownloadFile {
  fileName: string;
  mime: string;
  data: string | Uint8Array;
}

export interface DownloadContext {
  dungeon: ExportableDungeon & { readonly seed: number };
  resolved: ResolvedSource;
  /** PNG scale, default 1. */
  scale?: number;
}

const KINDS: readonly DownloadKind[] = ['json', 'png', 'tmj', 'tileset', 'txt', 'bin'];

/** `design.json` is only offered for editor designs, i.e. when the command reads `--design`. */
export function downloadKinds(resolved: ResolvedSource): readonly DownloadKind[] {
  return resolved.cliArgs[0] === '--design' ? [...KINDS, 'design'] : KINDS;
}

/** Builds one download with the exporters and options `generateToFiles` uses. */
export async function buildDownload(
  kind: DownloadKind,
  ctx: DownloadContext,
): Promise<DownloadFile> {
  const { dungeon, resolved } = ctx;
  const generator = `dungeonmaker-js@${VERSION}`;
  const base = `${resolved.name}-${dungeon.seed}`;
  switch (kind) {
    case 'json':
      return {
        fileName: `${base}.dungeon.json`,
        mime: 'application/json',
        data: toDungeonJson(dungeon, { source: resolved.source, generator }),
      };
    case 'png':
      return {
        fileName: `${base}.png`,
        mime: 'image/png',
        data: await toPng(dungeon, { scale: ctx.scale, generator }),
      };
    case 'tmj':
      return {
        fileName: `${base}.tmj`,
        mime: 'application/json',
        data: toTiledMap(dungeon, { generator }),
      };
    case 'tileset':
      return { fileName: TILESET_IMAGE, mime: 'image/png', data: await toTilesetPng() };
    case 'txt':
      return {
        fileName: `${base}.txt`,
        mime: 'text/plain;charset=utf-8',
        data: toAsciiText(dungeon),
      };
    case 'bin':
      return { fileName: `${base}.bin`, mime: 'application/octet-stream', data: toRaw(dungeon) };
    case 'design':
      return {
        fileName: DESIGN_FILE,
        mime: 'application/json',
        data: designFileText(resolved.design),
      };
  }
}
