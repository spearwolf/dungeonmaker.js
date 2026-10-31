// SPDX-License-Identifier: GPL-3.0-or-later
import { Cell } from 'dungeonmaker-js';
import { drawToCanvas, toImageData, toRgba } from 'dungeonmaker-js/render';

const d = {
  width: 3,
  height: 2,
  cells: Uint8Array.of(
    Cell.Open,
    Cell.Closed,
    Cell.Column,
    Cell.HorizontalDoor,
    Cell.Mob1,
    Cell.Treasure3,
  ),
};

test('drawToCanvas paints an OffscreenCanvas with the rgba raster', () => {
  const canvas = new OffscreenCanvas(1, 1);
  drawToCanvas(d, canvas, { scale: 3 });
  expect(canvas.width).toBe(9);
  expect(canvas.height).toBe(6);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const got = ctx.getImageData(0, 0, 9, 6).data;
  expect([...got]).toEqual([...toRgba(d, { scale: 3 }).data]);
});

test('toImageData returns an ImageData', () => {
  const img = toImageData(d, { scale: 2 });
  expect(img).toBeInstanceOf(ImageData);
  expect([img.width, img.height]).toEqual([6, 4]);
});
