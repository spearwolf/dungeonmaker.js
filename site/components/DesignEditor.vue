<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { LintResult } from '../src/design-lint';
import type { EditorHandle } from '../src/editor';
import type { PresetName, SiteSource } from '../src/source';
import Workbench from './Workbench.vue';

const STORAGE_KEY = 'dungeonmaker-js:design';
const START_PRESET: PresetName = 'designEmpty';

type TestWindow = Window & { __dmEditor?: EditorHandle };

const host = ref<HTMLElement | null>(null);
const dialog = ref<HTMLDialogElement | null>(null);
const loaded = ref(false);
/** The text changed and its lint has not run yet. */
const pending = ref(true);
const lint = shallowRef<LintResult | null>(null);
const names = shallowRef<readonly PresetName[]>([]);
const preset = ref<PresetName | ''>('');
const legacyText = ref('');
const legacyError = ref('');

let editor: EditorHandle | undefined;
let mods:
  | (typeof import('../src/legacy') &
      typeof import('../src/source') & {
        presets: typeof import('dungeonmaker-js/presets');
      })
  | undefined;

/** Only a design that the lint accepted, for the current text, can be generated. */
const source = computed<SiteSource | null>(() => {
  const design = lint.value?.design;
  return !pending.value && design ? { kind: 'design', design } : null;
});
const issues = computed(() => lint.value?.issues ?? []);

function store(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Storage can be unavailable (privacy settings); the text then lasts for the page only.
  }
}

function loadPreset(): void {
  if (!mods || !editor || preset.value === '') return;
  editor.setText(mods.designFileText(mods.presets[preset.value]));
  preset.value = '';
}

function openLegacy(): void {
  legacyError.value = '';
  dialog.value?.showModal();
}

function closeLegacy(): void {
  dialog.value?.close();
}

function importText(): void {
  if (!mods || !editor) return;
  const result = mods.importLegacy(legacyText.value);
  if ('error' in result) {
    legacyError.value = `This is not a design text the parser accepts: ${result.error}`;
    return;
  }
  editor.setText(result.json);
  legacyText.value = '';
  legacyError.value = '';
  closeLegacy();
}

onMounted(async () => {
  const [{ createDesignEditor }, legacy, sourceModule, presets] = await Promise.all([
    import('../src/editor'),
    import('../src/legacy'),
    import('../src/source'),
    import('dungeonmaker-js/presets'),
  ]);
  if (!host.value) return; // unmounted while loading
  mods = { ...legacy, ...sourceModule, presets };
  names.value = sourceModule.PRESET_NAMES;
  let doc: string | null = null;
  try {
    doc = localStorage.getItem(STORAGE_KEY);
  } catch {
    // See store(): no storage, start text.
  }
  editor = createDesignEditor(host.value, {
    doc: doc || sourceModule.designFileText(presets[START_PRESET]),
    onLint(result) {
      lint.value = result;
      pending.value = false;
    },
    onChange() {
      pending.value = true;
      if (editor) store(editor.getText());
    },
  });
  // Test hook for the browser checks; not part of the page otherwise.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    (window as TestWindow).__dmEditor = editor;
  }
  loaded.value = true;
});

onBeforeUnmount(() => {
  editor?.dispose();
  editor = undefined;
  delete (window as TestWindow).__dmEditor;
});
</script>

<template>
  <div class="dm-ui dm-design-editor">
    <section class="dm-editor-pane" aria-label="Design">
      <div class="dm-editor-bar">
        <label class="dm-inline">
          Start from
          <select v-model="preset" data-testid="load-preset" :disabled="!loaded" @change="loadPreset">
            <option value="" disabled>preset…</option>
            <option v-for="name in names" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <button type="button" data-testid="legacy-open" :disabled="!loaded" @click="openLegacy">
          Import legacy text…
        </button>
        <span class="dm-lint" :class="{ 'dm-lint-bad': !pending && issues.length > 0 }">
          <span data-testid="lint-count" :data-state="pending ? 'pending' : 'done'">{{
            pending ? '…' : issues.length
          }}</span>
          {{ !pending && issues.length === 1 ? 'problem' : 'problems' }}
        </span>
      </div>
      <div ref="host" class="dm-editor-host" />
      <ul v-if="!pending && issues.length > 0" class="dm-issues" data-testid="lint-issues">
        <li v-for="(issue, i) in issues" :key="i">
          <code v-if="issue.path">{{ issue.path }}</code> {{ issue.message }}
        </li>
      </ul>
    </section>

    <Workbench class="dm-editor-bench" :source="source" :auto="false" />

    <dialog ref="dialog" class="dm-legacy" aria-labelledby="dm-legacy-title">
      <form method="dialog" @submit.prevent="importText">
        <h2 id="dm-legacy-title">Import legacy design text</h2>
        <p>
          Paste a DungeonMaker 2.05 design file (such as <code>design3A</code>). It replaces the
          editor content as JSON; undo brings the old content back.
        </p>
        <textarea
          v-model="legacyText"
          data-testid="legacy-text"
          rows="14"
          spellcheck="false"
          aria-label="Legacy design text"
        />
        <p data-testid="legacy-error" class="dm-error" role="alert">{{ legacyError }}</p>
        <div class="dm-dialog-actions">
          <button type="button" @click="closeLegacy">Cancel</button>
          <button type="submit" class="dm-primary" data-testid="legacy-import">Import</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.dm-design-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}
@media (min-width: 1024px) {
  .dm-design-editor {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }
}
.dm-editor-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.dm-editor-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.dm-inline {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dm-lint {
  margin-left: auto;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.dm-lint-bad {
  color: var(--vp-c-danger-1);
}
.dm-editor-host {
  height: min(70vh, 720px);
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
}
.dm-editor-host :deep(.cm-editor) {
  height: 100%;
  font-size: 13px;
}
.dm-editor-host :deep(.cm-gutters) {
  border-right-color: var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-3);
}
.dm-issues {
  max-height: 10em;
  margin: 0;
  padding-left: 1.2em;
  overflow: auto;
  color: var(--vp-c-danger-1);
  font-size: 14px;
}
.dm-legacy {
  width: min(720px, calc(100vw - 32px));
  padding: 20px 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.dm-legacy::backdrop {
  background: rgb(0 0 0 / 50%);
}
.dm-legacy h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.dm-legacy p {
  margin: 0 0 12px;
  font-size: 14px;
}
.dm-legacy textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}
.dm-error {
  color: var(--vp-c-danger-1);
}
.dm-error:empty {
  display: none;
}
.dm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
