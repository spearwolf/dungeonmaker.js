<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script setup lang="ts">
import type { Dungeon, OutputOptions } from 'dungeonmaker-js';
import { computed, onMounted, ref, watch } from 'vue';
import type { DownloadKind } from '../src/downloads';
import type { Runner } from '../src/runners';
import type { ResolvedSource } from '../src/source';

/** The props describe the shown dungeon, so the files and the command always match it. */
const props = defineProps<{
  dungeon: Dungeon;
  resolved: ResolvedSource;
  output: OutputOptions;
}>();

const RUNNER_KEY = 'dungeonmaker-js:runner';
const SCALES = [1, 2, 4, 8] as const;
const LABELS: Readonly<Record<DownloadKind, string>> = {
  json: 'Dungeon JSON',
  png: 'PNG image',
  tmj: 'Tiled map',
  tileset: 'Tiled tileset',
  txt: 'ASCII text',
  bin: 'Raw cells',
  design: 'Design JSON',
};

type Modules = typeof import('../src/downloads') &
  typeof import('../src/runners') &
  typeof import('../src/save');

const loaded = ref(false);
const scale = ref<number>(1);
const runner = ref<Runner>('pnpm');
const runners = ref<readonly Runner[]>([]);
const notice = ref('');
let mods: Modules | undefined;

const kinds = computed(() => (loaded.value && mods ? mods.downloadKinds(props.resolved) : []));
const command = computed(() =>
  loaded.value && mods
    ? mods.cliCommand(runner.value, {
        cliArgs: props.resolved.cliArgs,
        seed: props.dungeon.seed,
        output: props.output,
        scale: scale.value,
      })
    : '',
);

watch(command, () => {
  notice.value = '';
});

watch(runner, (value) => {
  try {
    localStorage.setItem(RUNNER_KEY, value);
  } catch {
    // Storage can be unavailable (privacy settings); the choice then lasts for the page only.
  }
});

async function download(kind: DownloadKind): Promise<void> {
  if (!mods) return;
  const { dungeon, resolved } = props;
  try {
    mods.saveFile(await mods.buildDownload(kind, { dungeon, resolved, scale: scale.value }));
  } catch (e) {
    notice.value = `Could not build the download: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function copy(): Promise<void> {
  if (!mods) return;
  notice.value = (await mods.copyText(command.value))
    ? 'Copied to the clipboard.'
    : 'Copying is not available here; select the command and copy it by hand.';
}

onMounted(async () => {
  const [downloads, cli, save] = await Promise.all([
    import('../src/downloads'),
    import('../src/runners'),
    import('../src/save'),
  ]);
  mods = { ...downloads, ...cli, ...save };
  runners.value = cli.RUNNERS;
  try {
    const stored = localStorage.getItem(RUNNER_KEY);
    const known = cli.RUNNERS.find((r) => r === stored);
    if (known) runner.value = known;
  } catch {
    // See above: no storage, default runner.
  }
  loaded.value = true;
});
</script>

<template>
  <section class="dm-downloads" aria-label="Downloads">
    <template v-if="loaded">
      <div class="dm-row">
        <span class="dm-label">Download</span>
        <button
          v-for="kind in kinds"
          :key="kind"
          type="button"
          :data-download="kind"
          @click="download(kind)"
        >
          {{ LABELS[kind] }}
        </button>
        <label class="dm-inline">
          PNG scale
          <select v-model.number="scale" data-testid="png-scale">
            <option v-for="s in SCALES" :key="s" :value="s">{{ s }}×</option>
          </select>
        </label>
      </div>
      <div class="dm-row">
        <span class="dm-label">Same files with the CLI</span>
        <label class="dm-inline">
          Runner
          <select v-model="runner" data-testid="runner">
            <option v-for="r in runners" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>
        <button type="button" data-testid="copy-cli" @click="copy">Copy CLI command</button>
      </div>
      <code class="dm-command" data-testid="cli-command">{{ command }}</code>
      <p v-if="resolved.cliArgs[0] === '--design'" class="dm-note">
        The command reads <code>design.json</code> from the current directory; download it first.
      </p>
      <p class="dm-note" role="status">{{ notice }}</p>
    </template>
  </section>
</template>

<style scoped>
.dm-downloads {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}
.dm-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.dm-label {
  min-width: 11em;
  font-weight: 600;
}
.dm-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}
.dm-command {
  display: block;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--vp-c-bg-alt);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  overflow-wrap: anywhere;
  user-select: all;
}
.dm-note {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.dm-note:empty {
  display: none;
}
</style>
