# dungeonmaker-js Phase 5 (Site, Doku, Release) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dungeonmaker-js@1.0.0` liegt auf npm, die englische Demo- und Doku-Site läuft auf GitHub Pages, und jeder Dungeon der Demo lässt sich herunterladen und per kopiertem CLI-Befehl byte-gleich reproduzieren.

**Architecture:** `site/` ist ein VitePress-Projekt und als privates Workspace-Paket `dungeonmaker-js-site` angelegt; es baut gegen das lokale Package. Die Logik der Demo steht framework-frei in `site/src/*.ts` und ist in Node testbar: CLI-Befehl, Quellenregel, Downloads, Overlay-Raster, Step-Player, Viewport, Design-Lint. Die Vue-SFCs in `site/components/` sind nur die Verdrahtung. Downloads benutzen exakt die Exporter und Optionen der CLI. Config-Referenz, Feldtabelle des Dateiformats und Cell-Legende entstehen per Script aus den JSON-Schemas und dem Package, die API-Referenz per TypeDoc. `pages.yml` deployt die Site, ein Compliance-Script prüft den Tarball vor jedem Publish, und der Versions-Bump auf `1.0.0` löst den Release aus.

**Tech Stack:** VitePress 1.6.4 (Vue 3.5, intern Vite 5), CodeMirror 6 mit `codemirror-json-schema`, TypeDoc 0.28 mit `typedoc-plugin-markdown` und `typedoc-vitepress-theme`, Playwright 1.64 (Chromium), Vitest 5, Biome 2, pnpm 12, Node 26. Das Package selbst bleibt bei TypeScript 7 und bekommt keine Dependency dazu.

**Spec:** `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md`. Phase 5 steht in §10. Außerdem verwendet: Site §8.5, pnpm-Alternativen §8.2, Exportformate und Byte-Gleichheit §7.4, CLI §7.5, Release §8.6 (Owner-Schritt D.10), Compliance §9.3, Lizenzrezept §9.4, Namensnutzung §9.6. Vorgänger: `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-4.md`.

## Global Constraints

- **Branch und Version:**
  - Die Tasks 1–11 laufen auf dem Branch `phase-5-site-docs-release` von `master`.
  - Task 12 (Release) läuft auf `master`, nach dem Merge.
  - Die Version bleibt bis Task 12 bei `0.0.2`.
- **Package-Code bleibt unverändert:**
  - In `packages/dungeonmaker-js/src/**` sind nur Doc-Kommentare und reine Typ-Exporte erlaubt (Task 7).
  - `wasm/`, `native/` und `test/golden/` bleiben unberührt.
  - Die Größenbudgets in `size-budget.json` werden nicht angehoben.
- **Site-Sprache:** Jeder Text, den ein Besucher liest, ist Englisch (§8.5). Das gilt auch für Fehlermeldungen der UI.
- **Site-Dependencies** stehen exakt gepinnt in `site/package.json`:
  - `vitepress` 1.6.4, `vue` 3.5.44
  - `codemirror` 6.0.2, `@codemirror/lang-json` 6.0.2, `@codemirror/lint` 6.9.7, `@codemirror/state` 6.7.6, `@codemirror/view` 6.43.15, `@codemirror/language` 6.13.1, `@lezer/common` 1.5.5, `codemirror-json-schema` 0.8.1
  - `typedoc` 0.28.20, `typedoc-plugin-markdown` 4.14.1, `typedoc-vitepress-theme` 1.1.4, `typescript` 6.0.3
  - `dungeonmaker-js` `workspace:*`
- **SPDX:** `.ts`/`.mjs` unter `site/` (ohne Generiertes) tragen `// SPDX-License-Identifier: GPL-3.0-or-later` in den ersten drei Zeilen, `.vue` als erste Zeile `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->`. Markdown-Seiten tragen keinen Header.
- **Lizenzregeln für Downloads (§9.4):** Presets erscheinen nur als `{ "preset": "<name>" }`. Eigene Designs stehen nur als Hash in der Datei, die Demo bettet nie ein.
- **Upstream-Manual:** Der Guide »Design concepts« ist eine eigene Zusammenfassung mit Quellenangabe. Längere Passagen aus `DM2_Manual/` werden nicht wörtlich übernommen.
- **Warten in Tests:** Browser-Checks warten per Playwright auf DOM-Zustände (`data-state`), nie per `sleep` und nie über Rechenlast.
- **Toolchain:** `mise x -- …`, wenn `pnpm`/`node` nicht im `PATH` liegen.
- **Outward-facing:** `git push` auf `master` und alles, was npm oder Pages verändert, braucht in Task 12 die ausdrückliche Freigabe des Owners im Gespräch.

## Review Focus

1. **Eigenes Design, dessen Text einem Preset gleicht** (ein Preset unverändert in den Editor importiert): Die CLI schreibt dafür `{ "preset": … }` (`presetOf` in `src/node/generate.ts`). Erwartet wird, dass Download und kopierter Befehl dasselbe tun, also Datei-Basisname `design`, Quelle `{ preset }`, Byte-Gleichheit. Test in Task 2.
2. **Ein Design, das der Lint akzeptiert, die Bridge aber ablehnt** (Entities auf einer 3×3-Karte): Erwartet wird eine sichtbare englische Fehlermeldung, kein endloses »Generating…«. Der letzte gute Dungeon bleibt stehen, und nach der Korrektur rendert die Seite wieder. Test in Task 5.
3. **Schnelles Rerollen oder Umschalten, während eine Generierung oder Animation läuft:** Erwartet wird, dass nur das Ergebnis des letzten Requests erscheint. Der Player stoppt, und kein Frame des alten Dungeons landet auf dem neuen. Tests in Task 2 (`takeLatest`) und Task 4 (Browser).
4. **Auslieferung unter dem Pages-Pfad `/dungeonmaker.js/`:** Worker und Wasm müssen unter der Base laden, nicht unter `/`. Der E2E-Server liefert deshalb ausschließlich unter der Base aus. Test ab Task 1, wirksam in Task 4.
5. **Legacy-Design mit BOM und CRLF in den Editor eingefügt** (Windows-Datei): Erwartet wird dasselbe JSON wie für LF ohne BOM, so wie `readDesignFile` es für die CLI macht. Test in Task 5.

## Festlegungen dieses Plans (zum Gegenlesen vor der Ausführung)

- **VitePress 1.6.4** erfüllt »Vite-Projekt in `site/`« (§8.5) und bringt Markdown-Seiten, Sidebar, lokale Suche, Dark Mode und `::: code-group` mit. Die Code-Groups sind die umschaltbaren pnpm/npm/yarn/bun-Tabs aus §8.2.
  - 2.0 ist Alpha und kommt deshalb nicht in Frage.
  - VitePress 1.x bringt intern Vite 5 mit. Die Site setzt `vite.worker.format: 'es'`, weil der Client einen Module Worker startet.
  - Die Site ist kein Zero-Config-Consumer-Test. Den liefert weiterhin `pnpm bundler:smoke` mit Vite 8 und webpack.
- **Base und URL:** `base: '/dungeonmaker.js/'`, Site unter `https://spearwolf.github.io/dungeonmaker.js/`. `ignoreDeadLinks` bleibt `false`, damit tote Links den Build brechen.
- **Kein SSR für Interaktives:** Komponenten mit Worker, Canvas oder CodeMirror stehen in `<ClientOnly>` und laden ihre Module per `import()` in `onMounted`.
- **Seitenstruktur** (Nav: Playground, Editor, Guide, Reference; jede Task trägt ihre Einträge selbst ein):
  - `/` Playground (`index.md`, `layout: page`)
  - `/editor`
  - `/guide/getting-started`, `/guide/client`, `/guide/layers`, `/guide/render-export`, `/guide/cli`, `/guide/offline`, `/guide/design-concepts`, `/guide/orientation`
  - `/reference/config` (generiert), `/reference/dungeon-format`, `/api/` (TypeDoc), `/license`
- **Generierte Dateien** sind gitignored und entstehen im Site-Script `generate` vor `dev`/`build`:
  - `site/api/**`
  - `site/reference/config.md`
  - `site/reference/_dungeon-fields.md`
  - `site/guide/_cell-legend.md`
- **Root-Scripts:**
  - `build` wird zu `pnpm --filter dungeonmaker-js build`; die Site läuft nicht im Package-Build mit.
  - Neu: `site:dev`, `site:build` (baut zuerst das Package), `site:e2e`, `compliance`.
  - `pnpm test` und `pnpm typecheck` decken `site/` ab, ohne vorher zu bauen. Vitest-Aliase und tsconfig-`paths` zeigen `dungeonmaker-js[/…]` auf `packages/dungeonmaker-js/src/`.
- **TypeScript in `site/`:** 6.0.3, weil TypeDoc 0.28 als Peer höchstens TS 6.0 akzeptiert. Damit läuft auch `tsc` für die Site-Logik. `moduleResolution: "Bundler"`, `allowJs` für `scripts/*.mjs`. Vue-SFCs werden nicht typgeprüft (kein `vue-tsc`); sie enthalten deshalb keine Logik, die Tests bräuchte.
- **Playground-Defaults:** Preset `design3A`, Seed `42`, keine Layer. Das ist der Golden-Hash `99cc67de`, und der E2E-Test prüft ihn. »Reroll« zieht per `crypto.getRandomValues` einen Seed in `1 … 4294967295`.
- **Downloads (§8.5):**
  - Einträge: `.dungeon.json`, `.png`, `.tmj`, Tiled-Tileset `dungeonmaker-tiles.png`, `.txt`, `.bin`. Bei Editor-Designs kommt `design.json` dazu.
  - Dateinamen nach dem CLI-Default `{name}-{seed}`: `name` ist der Preset-Name oder `design`.
  - PNG-Skalierung per Auswahl 1, 2, 4 oder 8, Default 1.
  - Die Optionen sind exakt die aus `generateToFiles`: `generator` = `dungeonmaker-js@<VERSION>`, gleiche `source`.
- **»Copy CLI command«:**
  - Form: `<runner> dungeonmaker-js@<VERSION> generate <quelle> --seed <n> --format json,png,tmj,txt,bin [--rooms] [--entities list|baked] [--steps] [--scale <n>]`.
  - Die Version ist gepinnt, weil `generator` in jeder Datei steht; nur so sind die Dateien byte-gleich.
  - `--scale` steht nur da, wenn die Skalierung nicht 1 ist.
  - Runner: `pnpm dlx` (Default), `npx`, `yarn dlx`, `bunx`. Die Wahl liegt in `localStorage['dungeonmaker-js:runner']`.
  - Der Befehl steht zusätzlich sichtbar im Menü (`<code>`), denn die Clipboard-API kann fehlen oder verweigert werden.
- **Quellenregel = CLI-Regel:**
  - Preset: `--preset <name>`, `{ preset }`.
  - Editor-Design: `--design ./design.json`. Gleicht `toDesignText(design)` einem Preset, gilt `{ preset }`, sonst `designSource(design)` ohne `embed`.
- **Overlay:**
  - Raumfarbe per Goldener-Winkel-Farbton `hsl((id · 137.508) mod 360, 60 %, 55 %)`, zu 35 % über die Basisfarbe gemischt.
  - MOB-Pixel `#e5484d`, Schatz-Pixel `#f5c518`.
- **Editor:**
  - CodeMirror 6. Von `codemirror-json-schema` kommen nur Completion, Hover und State-Extensions mit `design.schema.json`.
  - Diagnosen kommen aus dem eigenen `lintDesign`: JSON-Syntax, dann `validateDesign`, dann `toDesignText`. So meldet der Editor dieselben Fehler wie Package und CLI.
  - Debounce 300 ms. »Generate« ist gesperrt, solange es Diagnosen gibt.
  - Startinhalt ist `designFileText(designEmpty)`. Der Inhalt wird in `localStorage['dungeonmaker-js:design']` gehalten.
- **TypeDoc:**
  - Sieben Entries mit Typen: `index`, `core`, `schema`, `presets`, `render`, `export`, `node/index`. `worker` hat keine Typen.
  - Jede Entry-Datei bekommt den Tag `@module dungeonmaker-js[/<entry>]`.
  - `treatWarningsAsErrors: true`. Eine Warnung wird durch einen Typ-Export oder durch einen `intentionallyNotExported`-Eintrag mit Begründungskommentar behoben, nie durch Abschalten der Validierung.
- **READMEs (§8.5):**
  - Das Package-README wird kurz: Pitch, Install, Browser- und CLI-Beispiel, Link zur Site, Lizenz.
  - Die Abschnitte `## Quick start (browser)` und `## JSON designs and presets` bleiben, weil `bundler:smoke` und `pack:smoke` ihre Codeblöcke ausführen.
  - Der übrige Inhalt zieht in die Guides um (Task 8), bevor das README gekürzt wird (Task 10).
  - Das Root-README wird eine kurze Projektseite mit Entwickler-Kommandos.
- **CHANGELOG:** `packages/dungeonmaker-js/CHANGELOG.md` im Format »Keep a Changelog«, in `files` aufgenommen. `homepage` in `package.json` wird die Site-URL.
- **Nicht Teil dieser Phase:** die Source Map des Wasm als Release-Asset (§8.3/§8.6). Der Build erzeugt keine, und die Quellenpflicht ist über Tag und `source.tar.gz` erfüllt. Kommt in den Abschnitt »Später«.
- **Die Site dokumentiert `master`**, nicht die letzte npm-Version. Die Nav zeigt `VERSION`.

---

### Task 1: Site-Gerüst, E2E-Harness und CI-Job

**Files:**
- Create: `site/package.json`, `site/tsconfig.json`, `site/vitest.config.ts`, `site/.vitepress/config.ts`, `site/.vitepress/theme/index.ts`, `site/index.md`, `site/scripts/e2e.mjs`
- Test: `site/test/config.test.ts`, `scripts/test/workflows.test.mjs` (erweitern)
- Modify: `pnpm-workspace.yaml` (`- "site"`), `package.json` (Root-Scripts, s. Festlegungen), `vitest.config.mjs` (`projects: ['packages/*', 'scripts', 'site']`), `biome.json` (`!site/.vitepress/dist`, `!site/.vitepress/cache`, `!site/api`), `.gitignore` (generierte Dateien aus den Festlegungen plus `site/.vitepress/{dist,cache}`), `scripts/check-spdx.mjs` (COVERED um `/^site\/(src|scripts|test|components|\.vitepress)\//` ergänzen, Endungen `.ts|.mjs|.vue`), `scripts/test/check-spdx.test.mjs`, `.github/workflows/ci.yml`, `pnpm-lock.yaml`

**Interfaces:**
- Produces:
  - Das Site-Paket `dungeonmaker-js-site` mit den Scripts `dev` (`vitepress dev`), `build` (`vitepress build`), `typecheck` (`tsc -p tsconfig.json`), `test` (`vitest run`) und `e2e` (`node scripts/e2e.mjs`).
  - `site/scripts/e2e.mjs` mit dem Array `checks: { name: string; run(page: Page, base: string): Promise<void> }[]`. Spätere Tasks hängen dort ihre Checks an.
  - Ohne `E2E_BASE_URL` startet das Script einen statischen Server für `site/.vitepress/dist`, nur unter `/dungeonmaker.js/` (MIME-Tabelle wie in `scripts/bundler-smoke.mjs`, inkl. `.wasm`). Mit `E2E_BASE_URL` prüft es eine laufende Site (Task 12).
  - Jeder Check schlägt fehl, sobald die Seite ein `pageerror` oder ein `console.error` meldet.

- [ ] **Step 1: Failing tests schreiben**

```ts
// site/test/config.test.ts
import config from '../.vitepress/config';
test('the site is served below the GitHub Pages project path', () => {
  expect(config.base).toBe('/dungeonmaker.js/');
});
test('workers are emitted as ES modules (the client starts a module worker)', () => {
  expect(config.vite?.worker?.format).toBe('es');
});
test('dead links fail the build', () => {
  expect(config.ignoreDeadLinks ?? false).toBe(false);
});
```

```js
// scripts/test/workflows.test.mjs
test('the site build and its browser checks are part of the required ci gate', () => {
  const { jobs } = load('ci.yml');
  expect(jobs.ci.needs).toContain('site');
  const runs = jobs.site.steps.map((s) => s.run ?? '');
  expect(runs).toEqual(expect.arrayContaining(['pnpm site:build', 'pnpm site:e2e']));
  expect(runs.some((r) => /playwright install --with-deps chromium/.test(r))).toBe(true);
});
```

Dazu ein Fall in `check-spdx.test.mjs`: `site/components/X.vue` mit `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->` in Zeile 1 gilt als versehen.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm test`
Expected: FAIL. `site/.vitepress/config` fehlt, und `jobs.site` ist `undefined`.

- [ ] **Step 3: Gerüst anlegen**

- `config.ts`: `defineConfig` mit `title: 'dungeonmaker-js'`, `lang: 'en-US'`, `base`, `vite.worker.format`, `themeConfig.search.provider: 'local'`, Nav mit vorerst nur `Playground` und Social-Link GitHub. Wenn `api/typedoc-sidebar.json` existiert, wird es für `/api/` als Sidebar gelesen (`existsSync`), sonst bleibt der Eintrag weg.
- `theme/index.ts`: erweitert `DefaultTheme` und registriert später die globalen Komponenten.
- `index.md`: `layout: page` mit Überschrift »dungeonmaker-js«; der Playground folgt in Task 4.
- `vitest.config.ts`: Projektname `site`, `globals: true`, Aliase für `dungeonmaker-js`, `/core`, `/schema`, `/presets`, `/render`, `/export` → `../packages/dungeonmaker-js/src/<entry>.ts`, `/node` → `src/node/index.ts`, `/design.schema.json` und `/dungeon.schema.json` → die Package-Dateien.
- `tsconfig.json`: erweitert `../tsconfig.base.json` mit `module: "ESNext"`, `moduleResolution: "Bundler"`, `lib: ["ES2022", "DOM"]`, `types: ["node", "vitest/globals"]`, `allowJs: true`, `noEmit: true`, `resolveJsonModule: true`, `paths` wie die Aliase. Include: `src`, `test`, `scripts`, `.vitepress`.
- `e2e.mjs`, erster Check `home page loads under the base path`: `page.goto(base)`, der Titel enthält `dungeonmaker-js`.
- CI-Job `site`: checkout, `jdx/mise-action@v5`, `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`, `pnpm site:build`, `pnpm site:e2e`. In `jobs.ci.needs` aufnehmen.

- [ ] **Step 4: Tests und Build laufen lassen**

Run: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm site:build && pnpm site:e2e`
Expected: alles grün. `site/.vitepress/dist/index.html` existiert, und der E2E-Check meldet `ok home page loads under the base path`.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml vitest.config.mjs biome.json .gitignore scripts site .github/workflows/ci.yml
git commit -m "feat(site): VitePress workspace package, e2e harness and ci job"
```

---

### Task 2: Quellen, Downloads und CLI-Befehl der Demo

**Files:**
- Create: `site/src/source.ts`, `site/src/downloads.ts`, `site/src/runners.ts`, `site/src/latest.ts`
- Test: `site/test/source.test.ts`, `site/test/downloads.test.ts`, `site/test/runners.test.ts`, `site/test/latest.test.ts`

**Interfaces:**
- Consumes:
  - aus `dungeonmaker-js`: `toDesignText`, `extendDesign`, `DesignConfig`, `OutputOptions`
  - aus `dungeonmaker-js/presets`: alle Presets
  - aus `dungeonmaker-js/export`: `designSource`, `toDungeonJson`, `toPng`, `toTiledMap`, `toTilesetPng`, `toAsciiText`, `toRaw`, `TILESET_IMAGE`, `VERSION`, `DungeonSource`, `ExportableDungeon`
  - aus `dungeonmaker-js/schema`: `DESIGN_SCHEMA_ID`
- Produces:

```ts
// source.ts
export type PresetName = keyof typeof import('dungeonmaker-js/presets');
export const PRESET_NAMES: readonly PresetName[];
export type SiteSource =
  | { kind: 'preset'; preset: PresetName }
  | { kind: 'design'; design: DesignConfig };
export interface ResolvedSource {
  name: string;                 // '{name}' der CLI: Preset-Name oder 'design'
  source: DungeonSource;        // wie generateToFiles sie schreibt
  cliArgs: readonly string[];   // ['--preset', name] | ['--design', './design.json']
  design: DesignConfig;         // das Objekt, das generiert wird
}
export const DESIGN_FILE = 'design.json';
export function resolveSource(input: SiteSource): Promise<ResolvedSource>;
export function designFileText(design: DesignConfig): string; // {$schema, ...design}, 2 Spaces, '\n' am Ende

// downloads.ts
export type DownloadKind = 'json' | 'png' | 'tmj' | 'tileset' | 'txt' | 'bin' | 'design';
export interface DownloadFile { fileName: string; mime: string; data: string | Uint8Array }
export interface DownloadContext {
  dungeon: ExportableDungeon & { readonly seed: number };
  resolved: ResolvedSource;
  scale?: number;               // PNG, Default 1
}
export function downloadKinds(resolved: ResolvedSource): readonly DownloadKind[]; // 'design' nur bei --design
export function buildDownload(kind: DownloadKind, ctx: DownloadContext): Promise<DownloadFile>;

// runners.ts
export type Runner = 'pnpm' | 'npm' | 'yarn' | 'bun';
export const RUNNERS: readonly Runner[];                     // ['pnpm', 'npm', 'yarn', 'bun']
export function installCommand(runner: Runner): string;     // 'pnpm add dungeonmaker-js', 'npm install …', 'yarn add …', 'bun add …'
export interface CliRequest { cliArgs: readonly string[]; seed: number; output?: OutputOptions; scale?: number }
export function cliCommand(runner: Runner, request: CliRequest, version?: string): string; // version default VERSION

// latest.ts
export type Latest<R> = { stale: false; value: R } | { stale: true };
export function takeLatest<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<Latest<R>>;
```

MIME-Typen: `application/json` (json, tmj, design), `image/png` (png, tileset), `text/plain;charset=utf-8` (txt), `application/octet-stream` (bin).

- [ ] **Step 1: Failing tests schreiben**

```ts
// runners.test.ts
test('the command reproduces a preset dungeon with a pinned version', () => {
  expect(cliCommand('pnpm', { cliArgs: ['--preset', 'design3A'], seed: 42 }, '1.0.0')).toBe(
    'pnpm dlx dungeonmaker-js@1.0.0 generate --preset design3A --seed 42 --format json,png,tmj,txt,bin',
  );
});
test('layers and scale appear in a fixed order; scale 1 and entities false are omitted', () => {
  const req = { cliArgs: ['--design', './design.json'], seed: 7, output: { rooms: true, entities: 'list', steps: true }, scale: 4 } as const;
  expect(cliCommand('npm', req, '1.0.0')).toBe(
    'npx dungeonmaker-js@1.0.0 generate --design ./design.json --seed 7 --format json,png,tmj,txt,bin --rooms --entities list --steps --scale 4',
  );
  expect(cliCommand('yarn', { ...req, output: { entities: false }, scale: 1 }, '1.0.0')).toBe(
    'yarn dlx dungeonmaker-js@1.0.0 generate --design ./design.json --seed 7 --format json,png,tmj,txt,bin',
  );
  expect(cliCommand('bun', req, '1.0.0')).toMatch(/^bunx dungeonmaker-js@1\.0\.0 generate /);
});
```

```ts
// latest.test.ts
test('only the most recent call resolves as fresh', async () => {
  const resolvers: ((v: number) => void)[] = [];
  const run = takeLatest((n: number) => new Promise<number>((r) => resolvers.push(() => r(n))));
  const first = run(1);
  const second = run(2);
  resolvers[1]?.(2);
  resolvers[0]?.(1);
  expect(await second).toEqual({ stale: false, value: 2 });
  expect(await first).toEqual({ stale: true });
});
test('a rejection of a superseded call is swallowed as stale; of the latest it propagates', async () => { /* … */ });
```

```ts
// source.test.ts
test('a preset resolves like `generate --preset`', async () => {
  const r = await resolveSource({ kind: 'preset', preset: 'design3A' });
  expect(r).toMatchObject({ name: 'design3A', source: { preset: 'design3A' }, cliArgs: ['--preset', 'design3A'] });
});
test('an editor design equal to a preset keeps the file name but names the preset', async () => {
  const r = await resolveSource({ kind: 'design', design: structuredClone(presets.design5) });
  expect(r).toMatchObject({ name: 'design', source: { preset: 'design5' }, cliArgs: ['--design', './design.json'] });
});
test('any other design is referenced by hash only, never embedded', async () => {
  const design = extendDesign(presets.designEmpty, { map: { width: 60, height: 40 } });
  const r = await resolveSource({ kind: 'design', design });
  expect(r.source).toEqual({ designHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) });
});
test('the design file carries $schema and ends with a newline', () => {
  const text = designFileText(presets.designEmpty);
  expect(JSON.parse(text)).toEqual({ $schema: DESIGN_SCHEMA_ID, ...presets.designEmpty });
  expect(text.endsWith('}\n')).toBe(true);
});
```

```ts
// downloads.test.ts: der Kern von §7.4, Demo-Datei === CLI-Datei
import { main } from '../../packages/dungeonmaker-js/src/node/commands.js';
test.each([
  ['preset', { kind: 'preset', preset: 'design3A' }],
  ['custom design', { kind: 'design', design: extendDesign(presets.designEmpty, { map: { width: 60, height: 40 } }) }],
  ['design equal to a preset', { kind: 'design', design: structuredClone(presets.design5) }],
] as const)('every download equals the file the copied command writes (%s)', async (_label, input) => {
  const output = { rooms: true, entities: 'list', steps: true } as const;
  const resolved = await resolveSource(input);
  const core = await loadCore();
  const dungeon = { ...core.generate(toDesignText(resolved.design), 42, output), seed: 42 };
  const dir = mkdtempSync(join(tmpdir(), 'dm-site-'));
  if (input.kind === 'design') writeFileSync(join(dir, DESIGN_FILE), designFileText(input.design));
  const argv = cliCommand('pnpm', { cliArgs: resolved.cliArgs, seed: 42, output, scale: 2 }).split(' ').slice(3);
  expect(await main(argv, { stdout() {}, stderr() {}, cwd: dir })).toBe(0);
  for (const kind of downloadKinds(resolved).filter((k) => k !== 'design')) {
    const file = await buildDownload(kind, { dungeon, resolved, scale: 2 });
    const bytes = typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data;
    expect(Buffer.from(bytes).equals(readFileSync(join(dir, file.fileName))), file.fileName).toBe(true);
  }
});
test('file names follow the CLI default {name}-{seed}', async () => { /* json → design3A-42.dungeon.json, tileset → dungeonmaker-tiles.png, design → design.json */ });
test('downloadKinds offers design.json only for editor designs', async () => { /* … */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run --project site`
Expected: FAIL, die Module unter `site/src/` fehlen.

- [ ] **Step 3: Module implementieren**

- `resolveSource`: Preset-Erkennung über den Vergleich `toDesignText(design) === toDesignText(preset)`, wie `presetOf` in `src/node/generate.ts`.
- `buildDownload`: ruft dieselben Exporter mit denselben Optionen wie `generateToFiles` auf (`{ source, generator }`, `{ scale, generator }`, `{ generator }`) und hängt dieselben Endungen an.
- `takeLatest`: Zähler pro Aufruf. Abgelöste Aufrufe liefern `{ stale: true }`, auch wenn sie rejecten.

- [ ] **Step 4: Tests laufen lassen**

Run: `pnpm vitest run --project site && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src site/test
git commit -m "feat(site): download, source and CLI command logic matching the CLI byte for byte"
```

---

### Task 3: Overlay-Raster, Step-Player und Viewport

**Files:**
- Create: `site/src/compose.ts`, `site/src/player.ts`, `site/src/viewport.ts`, `site/src/fnv.ts`
- Test: `site/test/compose.test.ts`, `site/test/player.test.ts`, `site/test/viewport.test.ts`

**Interfaces:**
- Consumes: `toRgba`, `Raster`, `DungeonLike` (`dungeonmaker-js/render`); `RoomLayer`, `EntityLayer`, `StepLayer` (`dungeonmaker-js`)
- Produces:

```ts
// compose.ts
export function roomColor(id: number): readonly [number, number, number];
export const MOB_RGB: readonly [number, number, number];      // #e5484d
export const TREASURE_RGB: readonly [number, number, number]; // #f5c518
export interface ComposeOptions { rooms: boolean; entities: boolean; cells?: Uint8Array } // cells: Frame des Players
export function composeRgba(
  dungeon: DungeonLike & { rooms?: RoomLayer; entities?: EntityLayer },
  options: ComposeOptions,
): Raster; // immer scale 1, ein Pixel pro Zelle

// player.ts
export interface StepPlayer { readonly frames: number; seek(frame: number): Uint8Array } // gibt einen internen Puffer zurück
export function createStepPlayer(steps: StepLayer, cellCount: number): StepPlayer;

// viewport.ts
export interface ViewState { scale: number; offsetX: number; offsetY: number } // Bildschirm = map * scale + offset
export const ZOOM_LIMITS: { min: 0.25; max: 64 };
export function fitView(map: { width: number; height: number }, view: { width: number; height: number }): ViewState;
export function zoomAt(state: ViewState, factor: number, px: number, py: number): ViewState;
export function panBy(state: ViewState, dx: number, dy: number): ViewState;
export function attachViewport(canvas: HTMLCanvasElement, draw: (ctx: CanvasRenderingContext2D, s: ViewState) => void): { fit(map: { width: number; height: number }): void; redraw(): void; dispose(): void };

// fnv.ts
export function fnv1a32(bytes: Uint8Array): string; // 8 Hex-Zeichen, wie scripts/bundler-smoke.mjs
```

- [ ] **Step 1: Failing tests schreiben**

```ts
// compose.test.ts (Dungeon: design3A, Seed 42, output { rooms: true, entities: 'list' } über loadCore)
test('without layers the raster is exactly toRgba', () => {
  expect(composeRgba(d, { rooms: false, entities: false }).data).toEqual(toRgba(d).data);
});
test('rooms tint room cells and leave every other pixel alone', () => {
  const base = toRgba(d).data;
  const tinted = composeRgba(d, { rooms: true, entities: false }).data;
  const room = d.rooms.roomIds.findIndex((id) => id > 0);
  const none = d.rooms.roomIds.findIndex((id) => id === 0);
  expect(tinted.slice(room * 4, room * 4 + 4)).not.toEqual(base.slice(room * 4, room * 4 + 4));
  expect(tinted.slice(none * 4, none * 4 + 4)).toEqual(base.slice(none * 4, none * 4 + 4));
});
test('entities are painted in their kind colour', () => { /* Pixel von entities[0] (mob) === [...MOB_RGB, 255] */ });
test('a frame override paints the given cells', () => { /* cells = new Uint8Array(n).fill(Cell.Closed) → === toRgba({ …, cells }) */ });
test('consecutive room ids get distinct colours', () => {
  expect(new Set([1, 2, 3, 4, 5].map((id) => roomColor(id).join())).size).toBe(5);
});
```

```ts
// player.test.ts (design3A, Seed 42, steps: true)
test('seeking to the last frame yields the final cells', () => {
  const p = createStepPlayer(d.steps, d.width * d.height);
  expect(p.frames).toBe(d.steps.offsets.length - 1);
  expect(fnv1a32(p.seek(p.frames - 1))).toBe(fnv1a32(d.cells));
});
test('seeking backwards replays from the start map', () => {
  const p = createStepPlayer(d.steps, d.width * d.height);
  const mid = p.seek(Math.floor(p.frames / 2)).slice();
  p.seek(p.frames - 1);
  expect(p.seek(Math.floor(p.frames / 2))).toEqual(mid);
});
test('out-of-range frames are clamped', () => { /* seek(-1) === seek(0), seek(frames + 5) === seek(frames - 1) */ });
```

```ts
// viewport.test.ts
test('fitView scales the whole map into the view and centres it', () => {
  const s = fitView({ width: 160, height: 81 }, { width: 800, height: 400 });
  expect(s.scale).toBeCloseTo(400 / 81);
  expect(s.offsetX).toBeCloseTo((800 - 160 * s.scale) / 2);
  expect(s.offsetY).toBeCloseTo(0);
});
test('zoomAt keeps the map point under the cursor fixed', () => {
  const s0 = { scale: 2, offsetX: 10, offsetY: 20 };
  const s1 = zoomAt(s0, 1.5, 300, 200);
  expect((300 - s1.offsetX) / s1.scale).toBeCloseTo((300 - s0.offsetX) / s0.scale);
  expect((200 - s1.offsetY) / s1.scale).toBeCloseTo((200 - s0.offsetY) / s0.scale);
});
test('zoom is clamped to ZOOM_LIMITS', () => { /* zoomAt(scale 60, ×2) → 64; zoomAt(scale 0.3, ×0.5) → 0.25 */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run --project site`
Expected: FAIL, Module fehlen.

- [ ] **Step 3: Implementieren**

- `composeRgba` startet mit `toRgba({ width, height, cells: options.cells ?? dungeon.cells })` und mischt dann Raumfarben (35 %) und Entity-Pixel darüber.
- `createStepPlayer`: Vorwärts-Seek wendet die Frames inkrementell an, Rückwärts-Seek spielt ab Frame 0 neu.
- `attachViewport`: Wheel → `zoomAt` (Faktor `1.1 ** -sign(deltaY)`), Pointer-Drag → `panBy`, `imageSmoothingEnabled = false`, ein `ResizeObserver` setzt die Canvas-Größe auf `clientWidth × devicePixelRatio`.

- [ ] **Step 4: Tests laufen lassen**

Run: `pnpm vitest run --project site && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src site/test
git commit -m "feat(site): room/entity overlay, step player and zoom/pan viewport"
```

---

### Task 4: Playground (Startseite)

**Files:**
- Create: `site/components/Workbench.vue`, `site/components/DungeonView.vue`, `site/components/DownloadMenu.vue`, `site/components/Playground.vue`, `site/src/save.ts`
- Modify: `site/index.md`, `site/.vitepress/theme/index.ts` (registriert `Playground`), `site/scripts/e2e.mjs`

**Interfaces:**
- Consumes: alles aus Task 2 und 3; `createDungeon` aus `dungeonmaker-js`
- Produces:
  - `save.ts`: `saveFile(file: DownloadFile): void` (Blob, Object-URL, `<a download>`, danach `revokeObjectURL`) und `copyText(text: string): Promise<boolean>` (`false`, wenn die Clipboard-API fehlt oder ablehnt).
  - `Workbench.vue`: Props `source: SiteSource | null`, `auto: boolean` (bei `true` generiert jede Änderung sofort, bei `false` nur ein Klick auf »Generate«). Das Bedienfeld enthält:
    - Seed-Eingabe (`1 … 4294967295`), »Reroll«
    - Layer: `rooms`-Checkbox, `entities`-Select `off | list | baked`, `steps`-Checkbox
    - `DungeonView`, `DownloadMenu`, Generierungszeit, Fehlerzeile
  - Test-Hooks am Element `[data-testid="dungeon"]`:
    - `data-state`: `idle | generating | ready | error`
    - `data-hash` = `fnv1a32(dungeon.cells)`
    - `data-seed`
  - Weitere Test-Hooks: `[data-testid="elapsed"]` (Text `<n> ms`), `[data-testid="error"]`, `[data-testid="player"]` mit `input[data-testid="frame"]` und `data-frame-hash`, Buttons `[data-download="<kind>"]`, `<code data-testid="cli-command">`, `select[data-testid="runner"]`, `select[data-testid="png-scale"]`, `[data-testid="reroll"]`, `[data-testid="seed"]`.

- [ ] **Step 1: Failing E2E-Checks anhängen**

In `site/scripts/e2e.mjs`:
- `playground renders design3A seed 42`: `data-state="ready"`, `data-hash="99cc67de"`, `elapsed` passt auf `/^\d+ ms$/`.
- `every download matches the CLI byte for byte`:
  1. `rooms` an, `entities` auf `list`, `png-scale` auf `2` setzen und `ready` abwarten.
  2. Den Text von `cli-command` lesen, die ersten drei Tokens abschneiden.
  3. `node packages/dungeonmaker-js/dist/node/cli.js <rest>` in einem Temp-Verzeichnis ausführen.
  4. Für `json`, `png`, `tmj`, `tileset`, `txt` und `bin` per `page.waitForEvent('download')` laden und mit der gleichnamigen CLI-Datei byte-genau vergleichen.
- `reroll draws a new seed and dungeon`: `data-seed` ≠ `42`, der Wert im Seed-Feld gleicht `data-seed`, `data-hash` ändert sich.
- `the steps player replays to the final cells`: `steps` an, den Slider auf `max` setzen (`fill` plus `input`-Event), dann gilt `data-frame-hash === data-hash`.
- `new requests stop the player and drop stale results` (Review Focus 3):
  1. `steps` an, Play drücken, zweimal direkt hintereinander »Reroll« klicken.
  2. Nach `ready`: `data-seed` gleicht dem Seed-Feld.
  3. Der Player steht bei Frame 0 und spielt nicht.
  4. `data-hash` gleicht dem Hash, den das Script über `loadCore` aus `dist/core.js` für diesen Seed mit `toDesignText(design3A)` selbst berechnet.

- [ ] **Step 2: Checks laufen lassen, Fehlschlag prüfen**

Run: `pnpm site:build && pnpm site:e2e`
Expected: FAIL, `[data-testid="dungeon"]` fehlt.

- [ ] **Step 3: Komponenten implementieren**

- `Playground.vue`: Preset-Select über `PRESET_NAMES` (Default `design3A`), darunter `Workbench` mit `auto`.
- `Workbench`: generiert über `takeLatest(createDungeon)`, misst die Zeit mit `performance.now()` und `resolveSource`. Ein Fehler setzt `data-state="error"` und zeigt `error.name: error.message`; der letzte gute Dungeon bleibt mit seinen Downloads stehen. Jede neue Generierung stoppt den Player.
- `DungeonView`: zeichnet `composeRgba` über eine `OffscreenCanvas`/`ImageBitmap` in den Viewport. Bei einem neuen Dungeon ruft es `fit`. Der Player (Play/Pause, Slider, Tempo 1×/4×/16×) läuft per `requestAnimationFrame` und malt `seek(frame)` als `cells`-Override.
- `DownloadMenu`: Einträge nach `downloadKinds`, PNG-Skalierung, Runner-Select (`localStorage`), »Copy CLI command« mit sichtbarem `<code>`.
- `index.md` bettet `<ClientOnly><Playground /></ClientOnly>` ein, darüber ein Satz Pitch mit Link auf `/guide/getting-started`. Der Link kommt erst in Task 8 dazu, weil tote Links den Build brechen.

- [ ] **Step 4: Checks laufen lassen**

Run: `pnpm site:build && pnpm site:e2e && pnpm lint`
Expected: alle Checks `ok`.

- [ ] **Step 5: Commit**

```bash
git add site
git commit -m "feat(site): playground with layers, step player, downloads and CLI command"
```

---

### Task 5: Design-Editor

**Files:**
- Create: `site/src/pointer.ts`, `site/src/design-lint.ts`, `site/src/legacy.ts`, `site/src/editor.ts`, `site/components/DesignEditor.vue`, `site/editor.md`
- Test: `site/test/pointer.test.ts`, `site/test/design-lint.test.ts`, `site/test/legacy.test.ts`
- Modify: `site/.vitepress/config.ts` (Nav `Editor`), `site/.vitepress/theme/index.ts`, `site/scripts/e2e.mjs`

**Interfaces:**
- Consumes:
  - `validateDesign`, `DesignConfigSchema` bzw. die Datei `design.schema.json`
  - `toDesignText`, `parseDesignText`, `DesignValidationError`, `DesignIssue`
  - `designFileText` (Task 2), `Workbench` (Task 4)
- Produces:

```ts
// pointer.ts: RFC 6901, Werte-Bereiche in einem JSON-Text; '' = Wurzel
export function pointerRanges(text: string): Map<string, { from: number; to: number }>; // wirft SyntaxError bei kaputtem JSON
export function rangeFor(ranges: Map<string, { from: number; to: number }>, path: string): { from: number; to: number }; // nächster existierender Vorfahre

// design-lint.ts
export interface LintIssue { path: string; message: string; from: number; to: number }
export interface LintResult { design?: DesignConfig; issues: readonly LintIssue[] }
export function lintDesign(text: string): LintResult; // design nur ohne issues

// legacy.ts
export function importLegacy(text: string): { json: string } | { error: string }; // BOM und CRLF wie readDesignFile

// editor.ts
export interface EditorHandle { getText(): string; setText(text: string): void; dispose(): void }
export function createDesignEditor(parent: HTMLElement, options: { doc: string; onLint(result: LintResult): void }): EditorHandle;
```

Test-Hooks: `[data-testid="lint-count"]`, `[data-testid="generate"]`, `[data-testid="legacy-open"]`, `textarea[data-testid="legacy-text"]`, `[data-testid="legacy-import"]`, `[data-testid="legacy-error"]`.

- [ ] **Step 1: Failing tests schreiben**

```ts
// pointer.test.ts
test('pointers address value ranges, with ~0/~1 escaping', () => {
  const text = '{"map": {"width": 80}, "a~b/c": [1, 2]}';
  const r = pointerRanges(text);
  expect(text.slice(r.get('/map/width')!.from, r.get('/map/width')!.to)).toBe('80');
  expect(text.slice(r.get('/a~0b~1c/1')!.from, r.get('/a~0b~1c/1')!.to)).toBe('2');
  expect(r.get('')).toEqual({ from: 0, to: text.length });
});
test('rangeFor falls back to the nearest existing ancestor', () => { /* '/map/height' → Bereich von '/map' */ });
```

```ts
// design-lint.test.ts
test('a preset lints clean and yields the design', () => {
  const r = lintDesign(designFileText(presets.design3A));
  expect(r.issues).toEqual([]);
  expect(r.design?.map.width).toBe(160);
});
test('schema errors point at the offending value', () => {
  const text = designFileText(presets.designEmpty).replace('"width": 80', '"width": "x"');
  const [issue] = lintDesign(text).issues;
  expect(issue?.path).toBe('/map/width');
  expect(text.slice(issue!.from, issue!.to)).toBe('"x"');
});
test('semantic errors from toDesignText are reported too', () => {
  const design = extendDesign(presets.design3A, { map: { width: 10, height: 10 } });
  const r = lintDesign(designFileText(design));
  expect(r.design).toBeUndefined();
  expect(r.issues.length).toBeGreaterThan(0);
});
test('broken JSON is one issue over the whole text', () => {
  expect(lintDesign('{"map": ').issues).toEqual([expect.objectContaining({ path: '', from: 0, to: 8 })]);
});
```

```ts
// legacy.test.ts (Review Focus 5)
const text = readFileSync(new URL('../../native/vendor/dungeonmaker-2.05/design3A', import.meta.url), 'utf8');
test('legacy text becomes the design JSON of the preset', () => {
  const r = importLegacy(text);
  expect('json' in r && JSON.parse(r.json)).toEqual({ $schema: DESIGN_SCHEMA_ID, ...presets.design3A });
});
test('BOM and CRLF give the same JSON as LF', () => {
  expect(importLegacy(`﻿${text.replace(/\n/g, '\r\n')}`)).toEqual(importLegacy(text));
});
test('text the parser rejects returns an error message', () => {
  expect(importLegacy('not a design')).toEqual({ error: expect.any(String) });
});
```

E2E-Checks in `e2e.mjs`:
- `legacy import fills the editor`: Dialog öffnen, `design3A`-Text mit BOM und CRLF einfügen, importieren. Danach gilt `lint-count` = `0`, »Generate« ist aktiv, und `cli-command` enthält `--design ./design.json`.
- `invalid edits block generate`: Den Editor-Text per `setText` (über `window.__dmEditor`, nur gesetzt bei `import.meta.env.DEV` oder dem Query-Parameter `?test`) auf `width: "x"` setzen. Danach ist `lint-count` > 0 und »Generate« deaktiviert; nach der Korrektur ist es wieder aktiv.
- `a bridge rejection shows an error and recovers` (Review Focus 2):
  1. Design: `designEmpty` mit Karte 3×3, `rectangles: []`, leeren Seed-Listen. Meldet `toDesignText` dafür eine weitere Prüfung, werden die minimal nötigen Felder angepasst, bis der Lint grün ist.
  2. `entities` auf `list`, »Generate«: `data-state="error"`, `[data-testid="error"]` nicht leer.
  3. `entities` auf `off`, »Generate«: `data-state="ready"`.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run --project site`
Expected: FAIL, die Module fehlen.

- [ ] **Step 3: Implementieren**

- `pointerRanges`: eigener kleiner JSON-Scanner, keine Dependency.
- `lintDesign`: `JSON.parse`, dann `validateDesign`, dann `toDesignText` in `try`. Die Pfade der `DesignIssue`s werden über `rangeFor` verortet.
- `importLegacy`: `text.replace(/^﻿/, '').replace(/\r\n/g, '\n')`, dann `parseDesignText`, dann `designFileText`.
- `createDesignEditor`: `basicSetup`, `json()`, `jsonCompletion()`, `jsonSchemaHover()`, `stateExtensions(schema)` aus `codemirror-json-schema`. Weichen die Namen in 0.8.1 ab, gelten die dort dokumentierten Entsprechungen. Dazu `linter(…, { delay: 300 })` mit `lintDesign`. `onLint` meldet jedes Ergebnis an die Komponente.
- `DesignEditor.vue`: Editor links, `Workbench` mit `auto=false` rechts (bzw. darunter auf schmalen Viewports). Dazu der Legacy-Dialog und `localStorage` für den Text.

- [ ] **Step 4: Tests und Checks laufen lassen**

Run: `pnpm vitest run --project site && pnpm typecheck && pnpm lint && pnpm site:build && pnpm site:e2e`
Expected: PASS, alle E2E-Checks `ok`.

- [ ] **Step 5: Commit**

```bash
git add site
git commit -m "feat(site): design editor with schema completion, package lint and legacy import"
```

---

### Task 6: Config-Referenz, Dateiformat-Felder und Cell-Legende aus den Schemas

**Files:**
- Create: `site/scripts/reference.mjs` (reine Funktionen), `site/scripts/generate-reference.mjs` (schreibt die Dateien), `site/reference/dungeon-format.md`, `site/guide/orientation.md`
- Test: `site/test/reference.test.ts`
- Modify: `site/package.json` (`"generate": "node scripts/generate-reference.mjs"`, `dev`/`build` rufen zuerst `generate` auf), `site/.vitepress/config.ts` (Nav `Reference`, Sidebar `/reference/`)

**Interfaces:**
- Consumes:
  - `design.schema.json` und `dungeon.schema.json` (über die Package-Exports)
  - `Cell` (`dungeonmaker-js`), `DEFAULT_PALETTE`, `ASCII_CHARS` (`/render`), `ROWS_ALPHABET`, `toDungeonFile` (`/export`); die Legenden-Namen liest das Script aus `toDungeonFile(…).legend`
- Produces:

```js
/** @typedef {{ path: string, type: string, constraints: string, required: boolean, omitted: string, description: string, upstream: string }} FieldRow */
export function schemaRows(schema) /* FieldRow[]: jedes Blatt und jedes Objekt; Pfade wie map.width, rectangles[].from.x */;
export const OMITTED: Readonly<Record<string, string>>; // Bedeutung fehlender optionaler Felder
export function fieldTable(rows) /* Markdown-Tabelle: Field | Type | Constraints | Default | Description | Upstream */;
export function cellLegendTable() /* Markdown: Value | Cell | JSON legend | ASCII | rows char | Colour */;
```

Regeln für `schemaRows`:
- Die Spalte `Default` zeigt `required` oder `optional (omitted: <OMITTED[path]>)`.
- `upstream` ist der abgetrennte Schlusssatz `Upstream: …` der Beschreibung (Konvention aus `src/schema/model.ts`), ohne das Präfix `Upstream: ` und ohne den Schlusspunkt. Die Beschreibung erscheint ohne diesen Satz.
- Fehlt der Satz, erbt die Zeile das Kürzel des nächsten Vorfahren, der eins hat. Beispiel: `rectangles[].from.x` erbt `R sX sY` von `rectangles[].from`. Koordinaten, Raumzahlen und Raumgrößen-Wahrscheinlichkeiten haben im Schema kein eigenes Kürzel.
- Arrays aus Primitiven werden in eine Zeile gefaltet (Typ `integer[]`, Constraints der Items). Nur Objekte in Arrays bekommen eigene Zeilen (`rectangles[].from.x`).

`OMITTED` hat für `design.schema.json` diese Einträge:
- `$schema` → `ignored`
- `rectangles` → `no rectangles`
- `population` → `no entities`
- `crawlers.seeds`, `crawlers.pairs`, `tunnelers.seeds` → `none`

- [ ] **Step 1: Failing tests schreiben**

```ts
import designSchema from 'dungeonmaker-js/design.schema.json';
test('every field of the design schema has a row with its upstream record', () => {
  const rows = schemaRows(designSchema);
  expect(rows.find((r) => r.path === 'map.width')).toMatchObject({ type: 'integer', required: true, upstream: 'D dimY' });
  expect(rows.find((r) => r.path === 'rectangles[].from.x')).toMatchObject({ upstream: 'R sX sY' });
  expect(rows.find((r) => r.path === 'spawnDelay.crawler')).toMatchObject({ type: 'integer[]', upstream: 'BC' });
  expect(rows.some((r) => r.path.startsWith('spawnDelay.crawler['))).toBe(false);
  // Only $schema and the population containers lack a record; every population leaf has one.
  const missing = rows.filter((r) => r.upstream === '');
  expect(missing.every((r) => r.path === '$schema' || (r.path.startsWith('population') && r.type === 'object'))).toBe(true);
});
test('every optional field explains what omitting it means', () => {
  for (const row of schemaRows(designSchema).filter((r) => !r.required)) {
    expect(OMITTED[row.path], row.path).toBeDefined();
  }
});
test('the cell legend lists all 20 cells with the dungeon-file names', () => {
  const table = cellLegendTable();
  expect(table.split('\n').filter((l) => /^\| \d+ \|/.test(l))).toHaveLength(20);
  expect(table).toContain('| 0 | Open | `open` |');
  expect(table).toContain('| 19 | Column | `column` |');
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run --project site`
Expected: FAIL.

- [ ] **Step 3: Implementieren und Seiten schreiben**

- `generate-reference.mjs` schreibt drei Dateien:
  - `reference/config.md`: Einleitung mit `$schema`-Snippet, Hinweis auf `validateDesign` und die CLI `validate`, danach je Top-Level-Abschnitt (`map`, `rectangles`, `spawnDelay`, `crawlers`, `tunnelers`, `rooms`, `behaviour`, `population`) eine `fieldTable`.
  - `reference/_dungeon-fields.md`: `fieldTable(schemaRows(dungeonSchema))`.
  - `guide/_cell-legend.md`: die Cell-Legende.
- `dungeon-format.md` ist handgeschrieben:
  - Zweck, Beispiel-Datei (aus dem README-Abschnitt »Export formats«)
  - Encodings `base64 | rows | array`, Little-Endian für Layer
  - `source`-Regeln (§9.4)
  - `<!--@include: ./_dungeon-fields.md-->`
  - Lizenzsatz: »This specification and `dungeon.schema.json` are released under CC0-1.0.«
- `orientation.md`: Norden oben, `x` = Spalte, `y` = Zeile, `index = y * width + x`, Himmelsrichtungen. Dazu `<!--@include: ./_cell-legend.md-->` und `toTiles`-Kollaps.

- [ ] **Step 4: Tests und Build laufen lassen**

Run: `pnpm vitest run --project site && pnpm site:build`
Expected: PASS, Build ohne tote Links. `site/.vitepress/dist/reference/config.html` enthält `map.width` und `D dimY`.

- [ ] **Step 5: Commit**

```bash
git add site
git commit -m "feat(site): config reference, dungeon file format and cell legend generated from the schemas"
```

---

### Task 7: API-Referenz mit TypeDoc

**Files:**
- Create: `site/typedoc.json`, `site/tsconfig.typedoc.json`
- Modify:
  - `packages/dungeonmaker-js/src/{index,core,schema,presets,render,export}.ts` und `src/node/index.ts`: Datei-Kommentar mit `@module`
  - ggf. reine Typ-Exporte in diesen Entry-Dateien
  - `site/package.json` (`generate` hängt `&& typedoc` an)
  - `site/.vitepress/config.ts` (Nav-Eintrag `API` unter Reference)
  - `site/scripts/e2e.mjs`

**Interfaces:**
- Produces: `site/api/index.md` plus eine Seite pro Modul und `site/api/typedoc-sidebar.json`, beides von `typedoc-vitepress-theme`. Die Config aus Task 1 liest die Sidebar schon.

`typedoc.json` (verbindliche Werte):

```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["../packages/dungeonmaker-js/src/index.ts", "../packages/dungeonmaker-js/src/core.ts", "../packages/dungeonmaker-js/src/schema.ts", "../packages/dungeonmaker-js/src/presets.ts", "../packages/dungeonmaker-js/src/render.ts", "../packages/dungeonmaker-js/src/export.ts", "../packages/dungeonmaker-js/src/node/index.ts"],
  "tsconfig": "./tsconfig.typedoc.json",
  "plugin": ["typedoc-plugin-markdown", "typedoc-vitepress-theme"],
  "out": "./api",
  "docsRoot": ".",
  "readme": "none",
  "excludePrivate": true,
  "excludeInternal": true,
  "treatWarningsAsErrors": true,
  "validation": { "notExported": true, "invalidLink": true, "notDocumented": false }
}
```

`tsconfig.typedoc.json` erweitert `../packages/dungeonmaker-js/tsconfig.build.json` mit `noEmit: true` und `types: ["node"]`.

- [ ] **Step 1: Failing E2E-Check anhängen**

`api reference covers every typed entry`: Unter `${base}api/` existiert für jedes der Module `dungeonmaker-js`, `dungeonmaker-js/core`, `/schema`, `/presets`, `/render`, `/export` und `/node` ein Link. Die Seite von `dungeonmaker-js` nennt `createDungeon`, die von `/export` nennt `toDungeonJson`.

- [ ] **Step 2: Fehlschlag prüfen**

Run: `pnpm site:build && pnpm site:e2e`
Expected: FAIL, `/api/` fehlt.

- [ ] **Step 3: TypeDoc einrichten und Warnungen beheben**

- Die `@module`-Tags setzen.
- `pnpm --filter dungeonmaker-js-site exec typedoc` so lange laufen lassen, bis 0 Warnungen bleiben.
- Erlaubte Fixes: ein Typ-Export (`export type { … }`) in der passenden Entry-Datei, ein reparierter `{@link}` oder ein `intentionallyNotExported`-Eintrag mit Begründung als Kommentar in `typedoc.json` (JSONC).
- Laufzeit-Exporte ändern sich nicht. `pnpm check:package` und `pnpm size` bleiben grün.

- [ ] **Step 4: Prüfen**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm check:package && pnpm size && pnpm site:build && pnpm site:e2e`
Expected: alles grün.

- [ ] **Step 5: Commit**

```bash
git add site packages/dungeonmaker-js/src
git commit -m "docs(site): TypeDoc API reference for all typed entries"
```

---

### Task 8: Doku-Seiten (Getting Started, Guides, License)

**Files:**
- Create:
  - `site/guide/getting-started.md`, `site/guide/client.md`, `site/guide/layers.md`, `site/guide/render-export.md`, `site/guide/cli.md`, `site/guide/offline.md`, `site/guide/design-concepts.md`
  - `site/license.md`
- Test: `site/test/docs.test.ts`
- Modify: `site/.vitepress/config.ts` (Nav `Guide`, Sidebar `/guide/` in der Reihenfolge der Festlegungen, Footer mit Lizenzsatz), `site/index.md` (Link auf Getting Started)

**Inhalt der Seiten** (die Quelle ist das heutige Package-README, die Abschnitte ziehen um):

| Seite | Inhalt |
|---|---|
| `getting-started` | Was die Library ist, Herkunft und Credits (§9.6: »unofficial WebAssembly port of DungeonMaker 2.05 by Peter Henningsen«, Link SourceForge). Install als `::: code-group` pnpm/npm/yarn/bun. `## Quick start (browser)` (derselbe Codeblock wie im README), `## Quick start (CLI)`, Bundler-Hinweise und CSP (README »Bundlers«, »Content Security Policy«), ein Link in den Playground |
| `client` | README »Worker client« und »Errors« |
| `layers` | README »Output layers« inkl. Warnungen (Entities sind Demo-Code, `steps` kann groß werden) |
| `render-export` | README »Rendering« und »Export formats«, Link auf `/reference/dungeon-format` |
| `cli` | README »Command line«; die Beispiele als `::: code-group` mit `pnpm dlx`, `npx`, `yarn dlx`, `bunx` |
| `offline` | »Generate offline, ship data« (§9.4): Ansteckung bei Web-Bundles, das Rezept per CLI und `generateToFiles`, die drei Regeln für Exportdateien, Hinweis »not legal advice« |
| `design-concepts` | Crawler, Tunneler und Roomies, Generationen, Spawn-Verzögerung, Labyrinth- und Dungeon-Bereich, in eigenen Worten nach `DM2_Manual/` (mit Quellenangabe). Jeder Begriff verlinkt auf den Abschnitt der Config-Referenz |
| `license` | GPL-3.0-or-later im Klartext, was das für Nutzer heißt (§9.4, konservative Faustregel), Corresponding Source per Tag `v<version>`, CC0 für das Dateiformat, Credits an Peter Henningsen und Aaron Dalton |

- [ ] **Step 1: Failing tests schreiben**

```ts
// docs.test.ts
const firstJsBlock = (md: string, heading: string) =>
  md.slice(md.indexOf(heading)).match(/```js\n([\s\S]*?)```/)?.[1];
test('the getting-started browser snippet is the README quick start that bundler:smoke runs', () => {
  const readme = read('../packages/dungeonmaker-js/README.md');
  const page = read('guide/getting-started.md');
  expect(firstJsBlock(page, '## Quick start (browser)')).toBe(firstJsBlock(readme, '## Quick start (browser)'));
});
test('every code group offers pnpm, npm, yarn and bun, pnpm first', () => {
  for (const [file, md] of guidePages()) {
    for (const group of md.match(/::: code-group[\s\S]*?\n:::/g) ?? []) {
      const labels = [...group.matchAll(/```\w+ \[(\w+)\]/g)].map((m) => m[1]);
      expect(labels, file).toEqual(['pnpm', 'npm', 'yarn', 'bun']);
    }
  }
});
test('install commands on the page are the ones the demo uses', () => {
  const page = read('guide/getting-started.md');
  for (const runner of RUNNERS) expect(page).toContain(installCommand(runner));
});
test('the license page names the upstream author, the license and the CC0 format', () => {
  const page = read('license.md');
  for (const s of ['Peter Henningsen', 'GPL-3.0-or-later', 'CC0-1.0', 'v<version>']) expect(page).toContain(s);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run --project site`
Expected: FAIL, die Seiten fehlen.

- [ ] **Step 3: Seiten schreiben** (Englisch, nach der Tabelle oben; Codebeispiele unverändert aus dem README)

- [ ] **Step 4: Tests und Build laufen lassen**

Run: `pnpm vitest run --project site && pnpm site:build && pnpm site:e2e`
Expected: PASS, kein toter Link.

- [ ] **Step 5: Commit**

```bash
git add site
git commit -m "docs(site): getting started, guides and license page"
```

---

### Task 9: Deployment per `pages.yml`

**Files:**
- Create: `.github/workflows/pages.yml`
- Test: `scripts/test/workflows.test.mjs` (erweitern)
- Modify: `RELEASING.md` (Schritt D.11 »Pages« ersetzen, neuer Abschnitt »Site deployment«)

**Interfaces:**
- Produces: Workflow `pages` mit den Jobs `build` und `deploy`. Trigger: `push` auf `master` mit `paths` `site/**`, `packages/dungeonmaker-js/**`, `pnpm-lock.yaml`, `.github/workflows/pages.yml`; dazu `workflow_dispatch`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('pages.yml builds the site and uploads the VitePress output', () => {
  const { jobs } = load('pages.yml');
  expect(jobs.build.steps.some((s) => s.run === 'pnpm site:build')).toBe(true);
  const upload = jobs.build.steps.find((s) => s.uses?.startsWith('actions/upload-pages-artifact@'));
  expect(upload?.with?.path).toBe('site/.vitepress/dist');
});
test('pages.yml deploys only from master with minimal permissions', () => {
  const wf = load('pages.yml');
  expect(wf.on.push.branches).toEqual(['master']);
  expect(wf.on).toHaveProperty('workflow_dispatch');
  expect(wf.permissions).toEqual({ contents: 'read' });
  expect(wf.concurrency).toEqual({ group: 'pages', 'cancel-in-progress': false });
  const { deploy } = wf.jobs;
  expect(deploy.needs).toBe('build');
  expect(deploy.if).toBe("github.ref == 'refs/heads/master'");
  expect(deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  expect(deploy.environment.name).toBe('github-pages');
  expect(deploy.steps.some((s) => s.uses?.startsWith('actions/deploy-pages@'))).toBe(true);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run --project scripts`
Expected: FAIL, `pages.yml` fehlt.

- [ ] **Step 3: Workflow und Doku schreiben**

- `build`: `actions/checkout@v7`, `jdx/mise-action@v5`, `pnpm install --frozen-lockfile`, `pnpm site:build`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`.
- `deploy`: `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`, `actions/deploy-pages@v5` mit `id: deployment`.
- `RELEASING.md`, Abschnitt »Site deployment« mit diesen Owner-Schritten:
  1. Settings → Pages → Source »GitHub Actions«.
  2. Actions → `pages` → »Run workflow« auf `master`.
  3. Die URL prüfen.
  4. Der Branch `gh-pages` wird danach nicht mehr gepflegt und auch nicht gelöscht; der Tag `legacy-2014-demo` bewahrt ihn.

- [ ] **Step 4: Tests laufen lassen**

Run: `pnpm vitest run --project scripts && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/pages.yml scripts/test/workflows.test.mjs RELEASING.md
git commit -m "ci: deploy the site to GitHub Pages"
```

---

### Task 10: READMEs, CHANGELOG und Compliance-Check

**Files:**
- Create: `packages/dungeonmaker-js/CHANGELOG.md`, `scripts/compliance-check.mjs`
- Test: `scripts/test/compliance-check.test.mjs`, `scripts/test/readme.test.mjs`
- Modify:
  - `packages/dungeonmaker-js/README.md` (kürzen)
  - `README.md` (Root, neu fassen)
  - `packages/dungeonmaker-js/package.json` (`files` + `CHANGELOG.md`, `homepage` = `https://spearwolf.github.io/dungeonmaker.js/`)
  - `package.json` (Root-Script `"compliance": "node scripts/compliance-check.mjs"`)
  - `.github/workflows/ci.yml` (Job `check`: `pnpm compliance` nach `pnpm pack:smoke`)
  - `RELEASING.md` (»A release, day to day«: CHANGELOG-Eintrag `## [<version>] - <date>` ist Pflicht und wird geprüft)

**Interfaces:**
- Produces:

```js
/** files: Pfad im Tarball (ohne Präfix 'package/') → Inhalt als string */
export function checkCompliance({ files, version }) /* string[] Probleme, leer = ok */;
```

`checkCompliance` prüft diese Punkte (je Verstoß eine Meldung, die die Datei nennt):
1. `LICENSE` enthält `GNU GENERAL PUBLIC LICENSE` und `Version 3, 29 June 2007`.
2. `NOTICE` enthält `Peter Henningsen` und `GPL-3.0-or-later`.
3. Die ersten drei Zeilen von `wasm/dungeonmaker.js` enthalten `/*! dungeonmaker-js | GPL-3.0-or-later | includes DungeonMaker 2.05`.
4. In `package.json` gilt `license === 'GPL-3.0-or-later'`, `repository.url === 'git+https://github.com/spearwolf/dungeonmaker.js.git'`, `repository.directory === 'packages/dungeonmaker-js'` und `version === version`.
5. `README.md` enthält `Corresponding source`, `` `v<version>` `` und `https://github.com/spearwolf/dungeonmaker.js`.
6. `CHANGELOG.md` enthält `## [<version>]`.
7. `dungeon.schema.json` enthält `CC0-1.0`.
8. Kein Pfad beginnt mit `src/` oder `test/` oder endet auf `.cpp`, `.h` oder `.map` (§8.3).

`main()` packt per `pnpm --filter dungeonmaker-js pack` in ein Temp-Verzeichnis, entpackt mit `tar -xzf`, liest alle Textdateien und bricht mit Exit 1 und den Meldungen ab.

- [ ] **Step 1: Failing tests schreiben**

```js
// compliance-check.test.mjs
const ok = () => new Map(Object.entries({
  LICENSE: 'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007',
  NOTICE: 'Peter Henningsen … GPL-3.0-or-later',
  'wasm/dungeonmaker.js': '// SPDX…\n/*! dungeonmaker-js | GPL-3.0-or-later | includes DungeonMaker 2.05 (c) … */\n',
  'package.json': JSON.stringify({ version: '1.0.0', license: 'GPL-3.0-or-later', repository: { url: 'git+https://github.com/spearwolf/dungeonmaker.js.git', directory: 'packages/dungeonmaker-js' } }),
  'README.md': 'Corresponding source … `v<version>` … https://github.com/spearwolf/dungeonmaker.js',
  'CHANGELOG.md': '## [1.0.0] - 2026-11-01',
  'dungeon.schema.json': '"SPDX-License-Identifier: CC0-1.0."',
}));
test('a compliant tarball passes', () => expect(checkCompliance({ files: ok(), version: '1.0.0' })).toEqual([]));
test.each([
  ['LICENSE', (f) => f.delete('LICENSE')],
  ['wasm/dungeonmaker.js', (f) => f.set('wasm/dungeonmaker.js', 'async function x(){}')],
  ['CHANGELOG.md', (f) => f.set('CHANGELOG.md', '## [0.0.2]')],
  ['src/index.ts', (f) => f.set('src/index.ts', '')],
  ['package.json', (f) => f.set('package.json', JSON.stringify({ version: '1.0.0', license: 'MIT' }))],
])('a violation in %s is reported by name', (name, breakIt) => {
  const files = ok();
  breakIt(files);
  expect(checkCompliance({ files, version: '1.0.0' }).join('\n')).toContain(name);
});
```

```js
// readme.test.mjs
test('the package README is short and keeps the sections the smoke tests run', () => {
  const md = read('packages/dungeonmaker-js/README.md');
  expect(md.split('\n').length).toBeLessThanOrEqual(120);
  for (const s of ['## Quick start (browser)', '## JSON designs and presets', 'https://spearwolf.github.io/dungeonmaker.js/', 'pnpm dlx dungeonmaker-js generate', 'unofficial', 'Corresponding source']) {
    expect(md).toContain(s);
  }
});
test('the root README points to the site and the package', () => { /* Site-URL, packages/dungeonmaker-js, ≤ 80 Zeilen */ });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run --project scripts`
Expected: FAIL.

- [ ] **Step 3: Script, READMEs und CHANGELOG schreiben**

- **Package-README** (Englisch), in dieser Reihenfolge:
  1. Pitch mit »unofficial … by Peter Henningsen«
  2. Link zur Site
  3. Install (pnpm, npm/yarn/bun in einer Zeile)
  4. `## Quick start (browser)` (Codeblock unverändert)
  5. `## Quick start (CLI)`
  6. `## JSON designs and presets` (Codeblock unverändert)
  7. `## Documentation`: Links auf die Guides
  8. `## License` (Absätze aus dem heutigen README, inkl. Corresponding Source)
- **Root-README:** Pitch, Links (Site, npm, Package-README), `## Development` (Kommandos aus `CLAUDE.md`: lint, typecheck, test, build, `site:dev`, native Tests und Build), Legacy-Hinweis auf die Tags, Lizenz.
- **CHANGELOG:**
  - `## [Unreleased]` mit den Inhalten der Phasen 2–5 (Abschnitte `Added`, `Changed`)
  - `## [0.0.2] - 2026-10-31`: die Release-Pipeline
  - `## [0.0.1] - 2026-10-31`: Platzhalter-Release, `core`-Entry

- [ ] **Step 4: Prüfen**

Run: `pnpm lint && pnpm test && pnpm build && pnpm pack:smoke && pnpm bundler:smoke && pnpm compliance`
Expected: alles grün. `pnpm compliance` meldet nichts, weil der Tarball `CHANGELOG.md` mit `## [0.0.2]` trägt.

- [ ] **Step 5: Commit**

```bash
git add README.md packages/dungeonmaker-js/README.md packages/dungeonmaker-js/CHANGELOG.md packages/dungeonmaker-js/package.json package.json scripts .github/workflows/ci.yml RELEASING.md
git commit -m "docs: short READMEs, CHANGELOG and a tarball compliance check before every publish"
```

---

### Task 11: `CLAUDE.md`, Gesamtprüfung und Merge

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md` (nur in §10 »Später« den Eintrag »Source Map des Wasm als Release-Asset« ergänzen)

- [ ] **Step 1: `CLAUDE.md` anpassen**

- Status: Phase 5 ist umgesetzt, Release `1.0.0` steht aus.
- Layout: `site/` mit `src/` (Logik, Node-getestet), `components/` (Vue, dünn), `scripts/` (Referenz-Generator, E2E), Liste der generierten Dateien.
- Commands: `pnpm site:dev`, `pnpm site:build`, `pnpm site:e2e`, `pnpm compliance`. Root-`build` baut nur das Package.
- Der Satz über die alte Demo auf `gh-pages` wird auf »bis zur Umstellung durch den Owner« reduziert.
- Neue Gotchas:
  - `site/` benutzt TypeScript 6.0.3 wegen TypeDoc.
  - Downloads der Demo müssen byte-gleich zur CLI bleiben (`site/test/downloads.test.ts`).
  - Die README-Abschnitte `## Quick start (browser)` und `## JSON designs and presets` werden von den Smoke-Tests ausgeführt.

- [ ] **Step 2: Gesamtprüfung**

Run: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm size && pnpm check:package && pnpm pack:smoke && pnpm compliance && pnpm --filter dungeonmaker-js test:browser && pnpm bundler:smoke && pnpm site:build && pnpm site:e2e && sh native/test/run.sh`
Expected: alles grün. `git status` zeigt keine generierten Dateien (sie sind ignoriert), und `git diff master -- packages/dungeonmaker-js/wasm packages/dungeonmaker-js/test/golden native` ist leer.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md
git commit -m "docs: CLAUDE.md for the site, release still pending"
```

- [ ] **Step 4: Branch abschließen**

Mit `superpowers:finishing-a-development-branch`. Erst wenn CI auf dem Branch grün ist, wird nach `master` gemergt.

---

### Task 12: Release `1.0.0` und Site live (Owner-Freigabe nötig)

**Files:**
- Modify: `packages/dungeonmaker-js/package.json`, `packages/dungeonmaker-js/src/version.ts` (über den npm-Lifecycle `version`), `packages/dungeonmaker-js/CHANGELOG.md`, `CLAUDE.md` (Status)

- [ ] **Step 1: Site live schalten (Owner)**

Den Owner bitten, die Schritte aus `RELEASING.md` »Site deployment« auszuführen. Danach läuft der E2E-Check gegen die echte Site:

Run: `E2E_BASE_URL=https://spearwolf.github.io/dungeonmaker.js/ pnpm site:e2e`
Expected: alle Checks `ok`. Der Byte-Vergleich mit der CLI benutzt die lokale `dist/`; das ist korrekt, weil Site und lokales Package aus demselben `master` stammen.

- [ ] **Step 2: Bump vorbereiten**

```bash
pnpm --filter dungeonmaker-js exec npm version 1.0.0 --no-git-tag-version
```

`## [Unreleased]` in `CHANGELOG.md` wird zu `## [1.0.0] - <heutiges Datum>`.
Run: `pnpm build && pnpm test && pnpm compliance`
Expected: grün, `src/version.ts` enthält `'1.0.0'`.

- [ ] **Step 3: Commit, dann Freigabe einholen**

```bash
git add packages/dungeonmaker-js/package.json packages/dungeonmaker-js/src/version.ts packages/dungeonmaker-js/CHANGELOG.md
git commit -m "release: dungeonmaker-js 1.0.0"
```

Vor dem Push den Owner ausdrücklich fragen. Ein npm-Release lässt sich nicht zurücknehmen, und die Versionsnummer ist danach für immer vergeben.

- [ ] **Step 4: Push und Release beobachten**

Run: `git push origin master && gh run watch "$(gh run list --workflow release --limit 1 --json databaseId --jq '.[0].databaseId')"`
Expected:
- Die Jobs `check`, `ci`, `publish` und `tag` sind grün.
- `pnpm view dungeonmaker-js version` zeigt `1.0.0`.
- `gh release view v1.0.0` listet `dungeonmaker-js-1.0.0.tgz` und `source.tar.gz`.
- npmjs.com zeigt die Provenance.

- [ ] **Step 5: M5 prüfen**

- In einem leeren Scratchpad-Verzeichnis: `pnpm dlx dungeonmaker-js@1.0.0 generate --preset design3A --seed 42 --format png` erzeugt `design3A-42.png`.
- In einem frischen Vite-Projekt (`pnpm create vite@8 dm-check --template vanilla`) nur nach `/guide/getting-started` vorgehen und die Zeit von der Projektanlage bis zum ersten gerenderten Dungeon in `pnpm dev` stoppen.

Expected: beides gelingt; das Vite-Projekt bleibt unter fünf Minuten. Jede Abweichung von der Doku wird als Doku-Fix auf einem neuen Branch nachgezogen.

- [ ] **Step 6: Status nachziehen**

In `CLAUDE.md` gilt der Status jetzt als »1.0.0 released, site live«; der Satz über `gh-pages` entfällt.

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md after the 1.0.0 release"
```
