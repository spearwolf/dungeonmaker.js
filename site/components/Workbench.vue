<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script setup lang="ts">
import type { Dungeon, OutputOptions } from 'dungeonmaker-js';
import { onMounted, ref, shallowRef, watch } from 'vue';
import type { Latest } from '../src/latest';
import type { ResolvedSource, SiteSource } from '../src/source';
import DownloadMenu from './DownloadMenu.vue';
import DungeonView from './DungeonView.vue';

/**
 * `auto`: every change generates right away; otherwise only a click on Generate does.
 * `source: null` means there is nothing to generate (an editor design with diagnostics).
 */
const props = defineProps<{ source: SiteSource | null; auto: boolean }>();

type State = 'idle' | 'generating' | 'ready' | 'error';
type Entities = 'off' | 'list' | 'baked';

interface Result {
  dungeon: Dungeon;
  resolved: ResolvedSource;
  output: OutputOptions;
  elapsed: number;
  hash: string;
}

type Run = (source: SiteSource, seed: number, output: OutputOptions) => Promise<Latest<Result>>;

const seed = ref(42);
const seedError = ref('');
const rooms = ref(false);
const entities = ref<Entities>('off');
const steps = ref(false);
const state = ref<State>('idle');
const error = ref('');
/** The last good dungeon; it stays, with its downloads, when a later request fails. */
const result = shallowRef<Result | null>(null);
const loaded = ref(false);
const view = ref<{ stop(): void } | null>(null);

let run: Run | undefined;
let seeds: typeof import('../src/seed') | undefined;

function currentOutput(): OutputOptions {
  const output: OutputOptions = {};
  if (rooms.value) output.rooms = true;
  if (entities.value !== 'off') output.entities = entities.value;
  if (steps.value) output.steps = true;
  return output;
}

function describe(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const name = 'name' in e && typeof e.name === 'string' ? e.name : 'Error';
    return `${name}: ${String(e.message)}`;
  }
  return `Error: ${String(e)}`;
}

async function generate(): Promise<void> {
  const source = props.source;
  if (!run || !source) return;
  view.value?.stop();
  state.value = 'generating';
  try {
    const outcome = await run(source, seed.value, currentOutput());
    if (outcome.stale) return;
    result.value = outcome.value;
    error.value = '';
    state.value = 'ready';
  } catch (e) {
    error.value = describe(e);
    state.value = 'error';
  }
}

function changed(): void {
  if (props.auto) void generate();
}

function onSeed(event: Event): void {
  const input = event.target as HTMLInputElement;
  const next = seeds?.parseSeed(input.value);
  if (next === undefined) {
    seedError.value = 'The seed must be a whole number from 1 to 4294967295.';
    return;
  }
  seedError.value = '';
  if (next === seed.value) return;
  seed.value = next;
  changed();
}

function reroll(): void {
  if (!seeds) return;
  seed.value = seeds.randomSeed();
  seedError.value = '';
  changed();
}

// Layer switches made in one go generate once.
watch([rooms, entities, steps], changed);
watch(() => props.source, changed);

onMounted(async () => {
  const [{ createDungeon }, { takeLatest }, { resolveSource }, { fnv1a32 }, seedModule] =
    await Promise.all([
      import('dungeonmaker-js'),
      import('../src/latest'),
      import('../src/source'),
      import('../src/fnv'),
      import('../src/seed'),
    ]);
  seeds = seedModule;
  run = takeLatest(async (source: SiteSource, s: number, output: OutputOptions) => {
    const resolved = await resolveSource(source);
    const start = performance.now();
    const dungeon = await createDungeon({ design: resolved.design, seed: s, output });
    const elapsed = Math.round(performance.now() - start);
    return { dungeon, resolved, output, elapsed, hash: fnv1a32(dungeon.cells) };
  });
  loaded.value = true;
  changed();
});
</script>

<template>
  <div class="dm-ui dm-workbench">
    <div class="dm-controls">
      <label class="dm-field">
        <span>Seed</span>
        <input
          data-testid="seed"
          class="dm-seed"
          type="number"
          inputmode="numeric"
          min="1"
          max="4294967295"
          step="1"
          :value="seed"
          :aria-invalid="seedError !== ''"
          @change="onSeed"
        />
      </label>
      <button type="button" data-testid="reroll" :disabled="!loaded" @click="reroll">Reroll</button>
      <fieldset class="dm-layers">
        <legend>Layers</legend>
        <label><input v-model="rooms" type="checkbox" data-testid="rooms" /> Rooms</label>
        <label>
          Entities
          <select v-model="entities" data-testid="entities">
            <option value="off">off</option>
            <option value="list">list</option>
            <option value="baked">baked</option>
          </select>
        </label>
        <label><input v-model="steps" type="checkbox" data-testid="steps" /> Steps</label>
      </fieldset>
      <button
        v-if="!auto"
        type="button"
        class="dm-primary"
        data-testid="generate"
        :disabled="!loaded || !source"
        @click="generate"
      >
        Generate
      </button>
    </div>
    <p v-if="seedError" class="dm-error" role="alert">{{ seedError }}</p>

    <div
      data-testid="dungeon"
      class="dm-dungeon"
      :class="{ 'dm-busy': state === 'generating' }"
      :data-state="state"
      :data-hash="result?.hash"
      :data-seed="result?.dungeon.seed"
      :aria-busy="state === 'generating'"
    >
      <DungeonView ref="view" :dungeon="result?.dungeon ?? null" />
    </div>

    <div class="dm-status">
      <span v-if="state === 'generating'">Generating…</span>
      <span v-if="result">
        {{ result.dungeon.width }} × {{ result.dungeon.height }}, seed {{ result.dungeon.seed }},
      </span>
      <span data-testid="elapsed">{{ result ? `${result.elapsed} ms` : '' }}</span>
    </div>
    <p data-testid="error" class="dm-error" role="alert">{{ error }}</p>

    <DownloadMenu
      v-if="result"
      :dungeon="result.dungeon"
      :resolved="result.resolved"
      :output="result.output"
    />
  </div>
</template>

<style scoped>
.dm-workbench {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dm-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}
.dm-field {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dm-seed {
  width: 9.5em;
}
.dm-layers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin: 0;
  padding: 4px 12px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}
.dm-layers legend {
  padding: 0 4px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.dm-layers label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dm-dungeon {
  transition: opacity 0.2s;
}
.dm-busy {
  opacity: 0.6;
}
.dm-status {
  display: flex;
  gap: 6px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.dm-error {
  margin: 0;
  color: var(--vp-c-danger-1);
}
.dm-error:empty {
  display: none;
}
</style>
