<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script setup lang="ts">
import type { Dungeon } from 'dungeonmaker-js';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { StepPlayer } from '../src/player';

const props = defineProps<{ dungeon: Dungeon | null }>();

/** Step frames per second at 1×. */
const FPS = 15;
const SPEEDS = [1, 4, 16] as const;

type Modules = typeof import('../src/compose') &
  typeof import('../src/player') &
  typeof import('../src/viewport') &
  typeof import('../src/fnv');

const canvas = ref<HTMLCanvasElement | null>(null);
const frames = ref(0);
const frame = ref(0);
const playing = ref(false);
const speed = ref<number>(1);
const frameHash = ref('');
/** The canvas takes the map's shape (within the CSS height limits), so little space is wasted. */
const aspect = computed(() =>
  props.dungeon ? `${props.dungeon.width} / ${props.dungeon.height}` : '2 / 1',
);

let mods: Modules | undefined;
let viewport: ReturnType<Modules['attachViewport']> | undefined;
let surface: OffscreenCanvas | HTMLCanvasElement | undefined;
let shown: Dungeon | null = null;
// A new player per dungeon: seek() returns a buffer the next seek overwrites.
let player: StepPlayer | undefined;
let raf = 0;

function createSurface(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  return Object.assign(document.createElement('canvas'), { width, height });
}

/** Composes the shown dungeon (or the current step frame) into the 1-pixel-per-cell surface. */
function render(): void {
  const d = shown;
  if (!mods || !d) {
    surface = undefined;
    frameHash.value = '';
    return;
  }
  const cells = player?.seek(frame.value);
  frameHash.value = cells ? mods.fnv1a32(cells) : '';
  const raster = mods.composeRgba(d, {
    rooms: d.rooms !== undefined,
    entities: d.entities !== undefined,
    cells,
  });
  if (surface?.width !== raster.width || surface.height !== raster.height) {
    surface = createSurface(raster.width, raster.height);
  }
  const ctx = surface.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  ctx?.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
}

function paint(): void {
  render();
  viewport?.redraw();
}

function draw(
  ctx: CanvasRenderingContext2D,
  s: { scale: number; offsetX: number; offsetY: number },
) {
  if (!surface) return;
  ctx.setTransform(s.scale, 0, 0, s.scale, s.offsetX, s.offsetY);
  ctx.drawImage(surface, 0, 0);
}

function stop(): void {
  playing.value = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function show(d: Dungeon | null): void {
  stop();
  shown = d;
  player = d?.steps && mods ? mods.createStepPlayer(d.steps, d.width * d.height) : undefined;
  frames.value = player?.frames ?? 0;
  frame.value = 0;
  render();
  if (d) viewport?.fit({ width: d.width, height: d.height });
  else viewport?.redraw();
}

function play(): void {
  const current = player;
  const last = frames.value - 1;
  if (!current || last < 1) return;
  if (frame.value >= last) {
    frame.value = 0;
    paint();
  }
  playing.value = true;
  let before: number | undefined;
  let carry = 0;
  const tick = (now: number) => {
    if (!playing.value || player !== current) return;
    if (before !== undefined) carry += ((now - before) * FPS * speed.value) / 1000;
    before = now;
    const advance = Math.floor(carry);
    if (advance > 0) {
      carry -= advance;
      frame.value = Math.min(frame.value + advance, last);
      paint();
      if (frame.value >= last) {
        stop();
        return;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function toggle(): void {
  if (playing.value) stop();
  else play();
}

function onScrub(event: Event): void {
  stop();
  frame.value = Number((event.target as HTMLInputElement).value);
  paint();
}

function fit(): void {
  if (shown) viewport?.fit({ width: shown.width, height: shown.height });
}

watch(
  () => props.dungeon,
  (d) => show(d),
);

onMounted(async () => {
  const [compose, steps, view, fnv] = await Promise.all([
    import('../src/compose'),
    import('../src/player'),
    import('../src/viewport'),
    import('../src/fnv'),
  ]);
  mods = { ...compose, ...steps, ...view, ...fnv };
  if (!canvas.value) return;
  viewport = mods.attachViewport(canvas.value, draw);
  show(props.dungeon);
});

onBeforeUnmount(() => {
  stop();
  viewport?.dispose();
  viewport = undefined;
});

defineExpose({ stop });
</script>

<template>
  <div class="dm-view">
    <canvas
      ref="canvas"
      class="dm-canvas"
      role="img"
      aria-label="Dungeon map"
      :style="{ aspectRatio: aspect }"
    />
    <div class="dm-view-bar">
      <div
        v-if="frames > 0"
        class="dm-player"
        data-testid="player"
        :data-playing="String(playing)"
        :data-frame-hash="frameHash"
      >
        <button type="button" data-testid="play" @click="toggle">
          {{ playing ? 'Pause' : 'Play' }}
        </button>
        <input
          type="range"
          data-testid="frame"
          aria-label="Generation step"
          min="0"
          :max="frames - 1"
          step="1"
          :value="frame"
          @input="onScrub"
        />
        <span class="dm-frame">{{ frame }} / {{ frames - 1 }}</span>
        <select v-model.number="speed" data-testid="speed" aria-label="Playback speed">
          <option v-for="s in SPEEDS" :key="s" :value="s">{{ s }}×</option>
        </select>
      </div>
      <span class="dm-hint">Scroll to zoom, drag to pan.</span>
      <button type="button" class="dm-fit" @click="fit">Fit</button>
    </div>
  </div>
</template>

<style scoped>
.dm-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dm-canvas {
  display: block;
  width: 100%;
  min-height: 200px;
  max-height: min(70vh, 720px);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  cursor: grab;
}
.dm-canvas:active {
  cursor: grabbing;
}
.dm-view-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.dm-player {
  display: flex;
  flex: 1 1 320px;
  align-items: center;
  gap: 8px;
}
.dm-player input[type='range'] {
  flex: 1;
  min-width: 120px;
}
.dm-frame {
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.dm-hint {
  color: var(--vp-c-text-3);
  font-size: 13px;
}
.dm-fit {
  margin-left: auto;
}
</style>
