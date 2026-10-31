// SPDX-License-Identifier: GPL-3.0-or-later
import type { StepLayer } from 'dungeonmaker-js';

export interface StepPlayer {
  readonly frames: number;
  /** Cells after frame `frame` (clamped); returns an internal buffer that the next seek overwrites. */
  seek(frame: number): Uint8Array;
}

export function createStepPlayer(steps: StepLayer, cellCount: number): StepPlayer {
  const frames = Math.max(0, steps.offsets.length - 1);
  const cells = new Uint8Array(cellCount);
  let current = -1; // last applied frame; -1 = nothing applied

  function apply(frame: number): void {
    const from = steps.offsets[frame] as number;
    const to = steps.offsets[frame + 1] as number;
    for (let i = from; i < to; i++) cells[steps.index[i] as number] = steps.cell[i] as number;
  }

  return {
    frames,
    seek(frame) {
      const target = frames === 0 ? -1 : Math.min(Math.max(Math.trunc(frame) || 0, 0), frames - 1);
      if (target < current) {
        cells.fill(0);
        current = -1;
      }
      while (current < target) apply(++current);
      return cells;
    },
  };
}
