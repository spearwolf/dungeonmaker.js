<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import type { PresetName, SiteSource } from '../src/source';
import Workbench from './Workbench.vue';

const DEFAULT_PRESET: PresetName = 'design3A';

const names = shallowRef<readonly PresetName[]>([DEFAULT_PRESET]);
const preset = ref<PresetName>(DEFAULT_PRESET);
const source = computed<SiteSource>(() => ({ kind: 'preset', preset: preset.value }));

onMounted(async () => {
  names.value = (await import('../src/source')).PRESET_NAMES;
});
</script>

<template>
  <div class="dm-ui dm-playground">
    <label class="dm-preset">
      <span>Preset</span>
      <select v-model="preset" data-testid="preset">
        <option v-for="name in names" :key="name" :value="name">{{ name }}</option>
      </select>
    </label>
    <Workbench :source="source" :auto="true" />
  </div>
</template>

<style scoped>
.dm-playground {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dm-preset {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
</style>
