# dungeonmaker-js Phase 0 + 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den 2014er-Altbestand sichern und abräumen, ein pnpm-Workspace-Fundament mit Lizenz-Compliance aufbauen und den DungeonMaker-Kern als deterministisches WebAssembly-Modul mit `core`-Entry in Node lauffähig machen, inklusive CI-Absicherung und automatischer Release-Pipeline bis `dungeonmaker-js@0.0.2`.

**Architecture:** Der unveränderte Vendor-Code wird über eine Unity-TU mit eigenem PCG32 statt libc-`rand()` kompiliert, eine schmale C-ABI-Bridge liefert `uint8_t`-Zellen north-up. Emscripten läuft in einem per Digest gepinnten Container, das Ergebnis wird committet und in CI auf Drift geprüft. Ein nativer Referenz-Build derselben TU erzeugt Golden-Hashes, gegen die das Wasm in Vitest geprüft wird.

**Tech Stack:** C++17, Emscripten 6.0.13 (`emscripten/emsdk`-Image), Node 26 LTS, pnpm 12, TypeScript 7 (`tsc`-Emit, ESM only), Vitest 5, Biome 2, GitHub Actions, npm Trusted Publishing.

**Spec:** `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md` (Phase 0 und Phase 1 aus §10; Architektur §3, Kern §5, Repo/CI/Release §8, Lizenz §9)

## Global Constraints

- Package-Name `dungeonmaker-js`, kein Scope; Lizenz im Package `GPL-3.0-or-later` (§8.3, §9.2).
- ESM only, Target ES2022, TypeScript `strict`, Emit mit `tsc`, kein Bundling (§8.2).
- pnpm überall; npm direkt nur beim OIDC-Publish in CI (§8.2, §8.6).
- Node und pnpm sind in `mise.toml` gepinnt, `packageManager` in der Root-`package.json` nennt dieselbe pnpm-Version. Es gibt nur eine Versionsquelle (§8.2).
- Vendor-Code unter `native/vendor/dungeonmaker-2.05/` bleibt byte-gleich zum Tarball; Änderungen nur über Unity-TU, Bridge oder `native/patches/` (§2 Nicht-Ziele, §9.3).
- `assert` bleibt aktiv: niemals `-DNDEBUG` (§5.4).
- Seeds sind ganze Zahlen in `1 … 4294967295`; Seed `0` ist ungültig (§5.3).
- Zellen: `Uint8Array`, row-major, `index = y * width + x`, Norden oben; `width` = Library-`dimY`, `height` = Library-`dimX` (§5.2, §11).
- Determinismus-Garantie: gleicher Designtext + gleicher Seed + gleiche Major-Version = byte-identische Zellen, auch im nativen Build derselben TU (§5.3).
- `packages/dungeonmaker-js/wasm/` ist Build-Output und wird committet; `.gitattributes`: `packages/dungeonmaker-js/wasm/** linguist-generated binary` (§8.1).
- Tags `v<version>` gehören allein den npm-Releases; Altbestand heißt `legacy-2014` und `legacy-2014-demo` (§8.1).
- `repository.url` exakt `git+https://github.com/spearwolf/dungeonmaker.js.git`, `repository.directory` = `packages/dungeonmaker-js` (§8.6).
- Workflow-Datei heißt `release.yml`, Environment `npm`, kein `NPM_TOKEN` (§8.6).
- Eigene Quelldateien tragen `SPDX-License-Identifier: GPL-3.0-or-later` (§9.3).
- README und `RELEASING.md` auf Englisch (§8.5).
- Nach außen wirkende Schritte (git push, npm publish, GitHub-/npm-Settings) laufen nur nach ausdrücklicher Freigabe des Owners.

## Review Focus

1. **Abgeschnittener D-Record** (`"D 50 50 CLOSED 12 18 NO"` ohne nachfolgendes `XX`): Der Original-Parser liest dann endlos Richtungen und wächst im Speicher, nativ beobachtet mit 10 Mio. Ausgabezeilen in 5 s. Erwartet: `DesignValidationError`, kein Hänger. Test in Task 7 (nativ) und Task 10 (Wasm).
2. **Leeres oder unvollständiges Design** (`""`, nur Kommentare, fehlender `BC`-Record): Nativ endet das in `assert(BabyDelayProbsForGenerationC.size() == 11)`. Erwartet: `DesignValidationError` mit Record-Name, Core bleibt benutzbar. Test in Task 7 und Task 10.
3. **Nicht-ASCII-Designtext** (Kommentar mit Umlauten und Emoji): Wer den Puffer mit `text.length` statt `lengthBytesUTF8` alloziert, schreibt über das Pufferende. Erwartet: gleicher Hash wie ohne Kommentar. Test in Task 10.
4. **Große Karte mit Memory Growth** (1024×1024, `INITIAL_MEMORY` 4 MB): Eine vor dem Aufruf gecachte `HEAPU8`-View liefert danach Müll. Erwartet: Hash gleich dem nativen Wert `6dd3d41c`. Test in Task 9.
5. **Seed-Grenzen** (`0`, `-1`, `1.5`, `2**32`, `NaN`; dazu `4294967295` als gültiger Maximalwert): Erwartet wird ein `RangeError` vor jedem Wasm-Aufruf bzw. beim Maximalwert der native Golden-Hash, damit uint32 nicht als int32 verstümmelt wird. Test in Task 9.

## Festlegungen dieses Plans (zum Gegenlesen vor der Ausführung)

Die Spec lässt einige Punkte offen oder setzt Vorschläge; dieser Plan legt sie so fest:

- **Cell-Nummerierung = Library-Enum `SquareData`** (§5.2 [Vorschlag]): `OPEN 0, CLOSED 1, G_OPEN 2, G_CLOSED 3, NJ_OPEN 4, NJ_CLOSED 5, NJ_G_OPEN 6, NJ_G_CLOSED 7, IR_OPEN 8, IT_OPEN 9, IA_OPEN 10, H_DOOR 11, V_DOOR 12, MOB1–3 13–15, TREAS1–3 16–18, COLUMN 19`.
- **GPL-3.0-or-later** für Package und `LICENSE` (§9.2 [Vorschlag]).
- **PRNG = PCG32** (XSH-RR, Multiplikator `6364136223846793005`, Inkrement `1442695040888963407`), `rand()` liefert die oberen 31 Bit. Beim Planen nativ gegen alle 11 Designs × 5 Seeds mit aktiven Asserts durchgelaufen, ohne Abort.
- **Pins:** Image `emscripten/emsdk:6.0.13@sha256:fb7864e398acfda863dfcea78b8bc8adad359fa60c6a0bbeb845931de64aa68a`, Node `26.13.0`, pnpm `12.17.0`, TypeScript `7.0.2`, Vitest `5.0.5`, Biome `2.6.4`, `actions/checkout@v7`, `jdx/mise-action@v5`.
- **Das Package liefert `wasm/` direkt aus** statt es nach `dist/` zu kopieren. Das committete Artefakt ist damit exakt das ausgelieferte. Der öffentliche Subpath bleibt `dungeonmaker-js/dungeonmaker.wasm` und zeigt auf `./wasm/dungeonmaker.wasm`. Abweichung von §8.3, nur im Ziel-Pfad.
- **Bridge-Sicherheitsnetz** (§5.4): Neben `AcceptDesign` prüft die Bridge billige Vorbedingungen des Vendor-Codes (Task 7). Die volle semantische Validierung bleibt Phase 2.
- **Core nach Abort:** `generate()` bleibt synchron. Nach einem Wasm-Abort ist die Core-Instanz verbraucht; neu instanziiert wird mit `loadCore({ wasmModule })` aus dem gecachten `WebAssembly.Module`. Die automatische Neuinstanziierung ist Sache des Workers (Phase 3).
- **Wasm-Source-Map als Release-Asset** entfällt in P1 und wandert in den Compliance-Check von P5. Grund: `-gsource-map` verändert das Wasm-Binary und verkompliziert den Drift-Check.
- **`CLAUDE.md` wird schon in P0 minimal angepasst**, weil sie sonst Agenten in P1 auf gelöschte Dateien schickt. Die vollständige Überarbeitung bleibt P5.
- **`engines.node` = `>=22`** (älteste noch gepflegte LTS-Linie).
- Hinweis für P4: `PlonkDownStuff()`/`PutPlonkOnMap()` stehen in `DungeonMaker.h` bereits unter `public:` (Zeile 543 f.). Der in §7.2 angekündigte Sichtbarkeits-Patch ist vermutlich unnötig. `SortRooms()` nutzt `std::sort` mit möglichen Gleichständen; die Reihenfolge kann zwischen libstdc++ und libc++ abweichen. Für P1 irrelevant, weil `SortRooms` nur aus `PlonkDownStuff` aufgerufen wird.

## File Structure

```
/
├─ package.json · pnpm-workspace.yaml · pnpm-lock.yaml · mise.toml
├─ tsconfig.base.json · biome.json · vitest.config.mjs   # Root: Vitest-Projects packages/* + scripts
├─ LICENSE (GPL-3.0-Volltext) · NOTICE · README.md (Interim) · RELEASING.md · CLAUDE.md
├─ .gitignore · .gitattributes
├─ .github/workflows/ci.yml · release.yml
├─ scripts/
│  ├─ check-spdx.mjs          # SPDX-Header-Prüfung (lint)
│  ├─ copy-legal.mjs          # prepack: LICENSE/NOTICE ins Package kopieren
│  ├─ check-size.mjs          # gzip-Größenbudget
│  ├─ pack-smoke.mjs          # gepacktes Tarball in leerem Projekt testen
│  ├─ release-check.mjs       # Entscheidung publish / dist-tag
│  └─ test/*.test.mjs
├─ native/
│  ├─ vendor/README.md        # Herkunft, Tarball-Hash, Whitelist
│  ├─ vendor/dungeonmaker-2.05/   # unverändert
│  ├─ patches/README.md       # Patch-Header-Vorlage (noch keine Patches)
│  ├─ src/prng.h · dungeonmaker_unity.cpp · bridge.h · bridge.cpp · license-banner.js
│  ├─ test/prng_test.cpp · bridge_test.cpp · native_hashes.cpp · run.sh
│  └─ build.sh                # Container-Build → packages/dungeonmaker-js/wasm/
└─ packages/dungeonmaker-js/
   ├─ package.json · tsconfig.json · tsconfig.build.json · vitest.config.ts
   ├─ README.md · size-budget.json
   ├─ wasm/dungeonmaker.js · dungeonmaker.wasm · BUILD-INFO.json   # generiert, committet
   ├─ src/core.ts             # Entry ./core (nur Re-Exports)
   ├─ src/cell.ts · errors.ts
   ├─ src/core/glue.ts        # Typen + Import der Emscripten-Glue
   ├─ src/core/core.ts        # loadCore, DungeonMakerCore
   ├─ src/core/diagnostics.ts # gedeckelter Zeilensammler
   └─ test/helpers.ts · cell.test.ts · core.test.ts · core-errors.test.ts · diagnostics.test.ts
      test/golden/native-fnv.json
```

---

# Phase 0 — Sichern & Fundament

### Task 1: Legacy taggen

**Files:** keine (nur Git-Refs)

**Interfaces:**
- Produces: annotierte Tags `legacy-2014` (auf dem `master`-HEAD vor Task 2) und `legacy-2014-demo` (auf `origin/gh-pages`, heute `f4b48766d6a09a23aa859e3daa283ec068f65449`).

- [ ] **Step 1: Ausgangszustand prüfen**

Run: `git status --porcelain && git branch --show-current && git fetch origin gh-pages`
Expected: keine Ausgabe von `status`, Branch `master`.

- [ ] **Step 2: Tags setzen**

```bash
git tag -a legacy-2014 -m "master before the 2026 modernization (asm.js build, dist/)" HEAD
git tag -a legacy-2014-demo -m "last gh-pages demo of the 2014 asm.js build" origin/gh-pages
```

- [ ] **Step 3: Verifizieren**

Run: `git rev-parse 'legacy-2014-demo^{commit}' origin/gh-pages && git rev-parse 'legacy-2014^{commit}' HEAD`
Expected: je zweimal derselbe Hash.

- [ ] **Step 4: Tags pushen — erst nach Freigabe durch den Owner**

Run: `git push origin legacy-2014 legacy-2014-demo`

---

### Task 2: Vendor-Import und Altbestand räumen

**Files:**
- Create: `native/vendor/dungeonmaker-2.05/` (Whitelist unten), `native/vendor/README.md`
- Delete: `index.html`, `index.html.mem`, `index.js`, `createdungeon.cpp`, `createdungeon.cwrap.js`, `createdungeon.html`, `createdungeon.js`, `createdungeon_main.js`, `createdungeon_worker.cwrap.js`, `createdungeon_worker.html`, `createdungeon_worker.js`, `pre.js`, `build.sh`, `dist/`, `dungeonmaker-2.05.tar.gz`, `preview.png`, die elf Root-Designdateien `design`, `design2`, `design3A`, `design3WithTunnelers`, `design4A`, `design5`, `design6`, `design7`, `designEmpty`, `designEmpty2`, `designOld1`
- Modify: `.gitignore` (komplett ersetzen), `README.md` (Interim), `CLAUDE.md`

**Interfaces:**
- Produces: Designs liegen unter `native/vendor/dungeonmaker-2.05/<name>`. Alle späteren Tests lesen sie von dort.

- [ ] **Step 1: Tarball prüfen und Whitelist kopieren**

Run: `sha256sum dungeonmaker-2.05.tar.gz`
Expected: `3c613a5aca38ed9633189e82596f96a8288f76fac84687db049ef6a5615ec4df`

Whitelist (40 Dateien): `DungeonMaker.cpp`, `DungeonMaker.h`, die elf Designs, `DM2_Manual/` komplett (21 Dateien), `AUTHORS`, `ChangeLog`, `COPYING` (upstream 0 Byte, bleibt so), `NEWS`, `README`, `VERSION`. Nicht übernommen: Autotools-Dateien, `Makefile*`, `autom4te.cache/`, `main.cpp`, `interactive/`.

- [ ] **Step 2: Byte-Gleichheit beweisen**

Run: in ein Scratch-Verzeichnis entpacken, dann je Whitelist-Datei `cmp` gegen `native/vendor/dungeonmaker-2.05/`, außerdem jede Root-Designdatei gegen ihr Vendor-Pendant; `git ls-files native/vendor/dungeonmaker-2.05 | wc -l` nach dem `git add`.
Expected: kein `cmp`-Unterschied; Zähler `40`.

- [ ] **Step 3: `native/vendor/README.md` schreiben**

Inhalt: Upstream-URL `http://dungeonmaker.sourceforge.net`, Tarball-Name und SHA-256 aus Step 1, Whitelist und Ausschlüsse. Außerdem drei Upstream-Eigenheiten, die bewusst unverändert bleiben: `VERSION` sagt `2.04`, `COPYING` ist leer (siehe Root-`LICENSE`), `AUTHORS` nennt Peter Henningsen und Aaron Dalton.

- [ ] **Step 4: Altbestand entfernen und `.gitignore` ersetzen**

`git rm -r` auf die Delete-Liste. Die neue `.gitignore` enthält `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `native/.emcache/`, `.DS_Store`. Die alten Einträge `dungeonmaker` und `dungeonmaker.js` fallen weg, denn der zweite würde später `wasm/dungeonmaker.js` verschlucken.

- [ ] **Step 5: Interim-README (Englisch)**

Ein Absatz Status (»being rebuilt as an npm package; see `docs/superpowers/specs/…`«), Verweis auf die Tags `legacy-2014`/`legacy-2014-demo`, die Kennzeichnung als inoffizielle Portierung von DungeonMaker 2.05 von Peter Henningsen samt Upstream-Link, Lizenzzeile. Die volle README folgt in P5.

- [ ] **Step 6: `CLAUDE.md` an das neue Layout anpassen**

Die Abschnitte »What this is«, »Build & run«, »Build pipeline« und die JS-Front-End-Teile von »Architecture« ersetzen durch: Verweis auf die Spec, das neue Layout (`native/`, `packages/dungeonmaker-js/`), den Hinweis »Plan: `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-0-1.md`«. Erhalten bleiben, auf Vendor-Pfade umgeschrieben, die Gotchas zu Achsen (`Map[x * dimY + y]`), Seed `0` → `time(NULL)` und `exit(1)` in `Init_fromFile`/`Init_fromText`. Alles über `dist/`, `createdungeon*`, `pre.js` und die Legacy-Farbtabellen fliegt raus.

- [ ] **Step 7: Verifizieren**

Run: `git ls-files | grep -E '^(index\.|createdungeon|pre\.js|build\.sh|dist/|dungeonmaker-2\.05\.tar\.gz|preview\.png|design)'`
Expected: keine Ausgabe.

- [ ] **Step 8: Commit**

```bash
git commit -m "chore: archive 2014 build, vendor DungeonMaker 2.05 sources"
```

---

### Task 3: Workspace und Tooling

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `mise.toml`, `tsconfig.base.json`, `biome.json`, `vitest.config.mjs`, `packages/dungeonmaker-js/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}`, `packages/dungeonmaker-js/src/cell.ts`, `packages/dungeonmaker-js/test/cell.test.ts`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `Cell` (const object) und `type Cell` aus `src/cell.ts`; Root-Scripts `lint`, `typecheck`, `test`, `build`, `format`; Package-Scripts `typecheck`, `build`, `test`.

- [ ] **Step 1: Versionen pinnen**

`mise.toml`: `[tools] node = "26.13.0"`, `pnpm = "12.17.0"`. Root-`package.json`: `"private": true`, `"type": "module"`, `"packageManager": "pnpm@12.17.0"`. Löst `mise install` pnpm `12.17.0` nicht auf, nimm die Version aus `mise latest pnpm` und setz sie an **beiden** Stellen.

Run: `mise install && node --version && pnpm --version`
Expected: `v26.13.0` und die gepinnte pnpm-Version.

- [ ] **Step 2: Workspace und Dev-Dependencies**

`pnpm-workspace.yaml`: `packages: ['packages/*']`. Root-devDependencies exakt gepinnt: `typescript@7.0.2`, `vitest@5.0.5`, `@biomejs/biome@2.6.4`, `@types/node` (neueste 26.x).
Root-Scripts: `lint` = `biome ci .`, `format` = `biome format --write .`, `typecheck` = `pnpm -r typecheck`, `test` = `vitest run`, `build` = `pnpm -r build`.
`vitest.config.mjs`: `test.projects: ['packages/*', 'scripts']`, `test.globals: true`. Das Package-`vitest.config.ts` setzt ebenfalls `globals: true`, das Package-`tsconfig.json` ergänzt `"types": ["node", "vitest/globals"]`. Alle Test-Snippets dieses Plans verlassen sich darauf (kein `import { test, expect }`).

- [ ] **Step 3: TypeScript-Konfiguration**

`tsconfig.base.json`: `target ES2022`, `module`/`moduleResolution` `NodeNext`, `lib ["ES2022"]`, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`, `declaration`, keine Source Maps.
Package-`tsconfig.json` (Typecheck, `noEmit`): extends base, `lib ["ES2022","DOM"]`, `types` wie in Step 2, include `src`, `test`.
`tsconfig.build.json`: include nur `src`, `rootDir src`, `outDir dist`, `types []`, damit `src` nicht von `@types/node` abhängt.
Package-Scripts: `typecheck` = `tsc -p tsconfig.json`, `build` = `tsc -p tsconfig.build.json`, `test` = `vitest run`.
Package-`package.json` vorerst: `name dungeonmaker-js`, `version 0.0.0`, `type module`, `license GPL-3.0-or-later`. Die restlichen Felder kommen in Task 11.

- [ ] **Step 4: Biome**

`biome.json`: Formatter mit Spaces, `indentWidth 2`, `lineWidth 100`, JS `quoteStyle single`, `semicolons always`; Linter `recommended`. Ausgenommen sind `native/vendor/**`, `packages/*/wasm/**`, `**/dist/**`, `docs/**`, `pnpm-lock.yaml`.

- [ ] **Step 5: Failing test für `Cell`**

```ts
// test/cell.test.ts
import { Cell } from '../src/cell.js';

test('Cell follows the library SquareData order', () => {
  expect(Cell).toEqual({
    Open: 0, Closed: 1, GuaranteedOpen: 2, GuaranteedClosed: 3,
    NonJoinOpen: 4, NonJoinClosed: 5, NonJoinGuaranteedOpen: 6, NonJoinGuaranteedClosed: 7,
    InsideRoomOpen: 8, InsideTunnelOpen: 9, InsideAnteroomOpen: 10,
    HorizontalDoor: 11, VerticalDoor: 12, Mob1: 13, Mob2: 14, Mob3: 15,
    Treasure1: 16, Treasure2: 17, Treasure3: 18, Column: 19,
  });
});
```

Run: `pnpm --filter dungeonmaker-js test`
Expected: FAIL, Modul `../src/cell.js` fehlt.

- [ ] **Step 6: `src/cell.ts` implementieren**

`export const Cell = { … } as const` mit genau diesen Werten, `export type Cell = (typeof Cell)[keyof typeof Cell]`. SPDX-Kopfzeile.

- [ ] **Step 7: Alles grün**

Run: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`
Expected: alle vier ohne Fehler.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "build: pnpm workspace with TypeScript, Vitest and Biome"
```

---

### Task 4: Lizenz-Fundament

**Files:**
- Create: `LICENSE`, `NOTICE`, `native/patches/README.md`, `scripts/check-spdx.mjs`, `scripts/test/check-spdx.test.mjs`
- Delete: `LICENSE.txt`
- Modify: Root-`package.json` (`lint` ergänzt um `node scripts/check-spdx.mjs`)

**Interfaces:**
- Produces: `findMissingSpdx(files: { path: string; content: string }[]): string[]` (Pfade ohne Header) in `scripts/check-spdx.mjs`. Ohne Argumente prüft das Script als CLI die per `git ls-files` gefundenen Dateien und endet mit Exit-Code 1, wenn welche fehlen.

- [ ] **Step 1: `LICENSE`**

Volltext von `https://www.gnu.org/licenses/gpl-3.0.txt`.
Run: `sha256sum LICENSE`
Expected: `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`

- [ ] **Step 2: `NOTICE`**

Inhalt:
- `dungeonmaker.js — unofficial WebAssembly port of DungeonMaker 2.05`, `Copyright (C) 2015–2026 Wolfger Schramm <wolfger@spearwolf.de>`, verteilt als Ganzes unter GPL-3.0-or-later.
- »This product includes a modified version of DungeonMaker 2.05«, mit der Copyright-Zeile **wörtlich** aus dem Kopf von `native/vendor/dungeonmaker-2.05/DungeonMaker.h`, Mitautor Aaron Dalton laut `AUTHORS` und Upstream-URL.
- Der Satz zur Versionswahl: Upstream nennt »General Public License« ohne Version, nach GPLv2 §9 / GPLv3 §14 ist jede Version wählbar.
- Die Liste der Modifikationen: `native/src/dungeonmaker_unity.cpp` (PRNG-Umleitung), `native/src/bridge.cpp` (C-ABI), Dateien unter `native/patches/`.

- [ ] **Step 3: Patch-Header-Vorlage**

`native/patches/README.md`: Jeder Patch beginnt vor der ersten `---`-Zeile mit den Feldern `Patch:`, `Applies to:` (Pfad unter `native/vendor/dungeonmaker-2.05/`), `What:` (ein Satz), `Why:` (ein Satz plus Spec-Abschnitt), `Date:` (ISO), `SPDX-License-Identifier: GPL-3.0-or-later`. Dazu ein Satz: Patches werden im Build auf eine Kopie angewendet, der Vendor-Ordner bleibt unberührt.

- [ ] **Step 4: Failing test für `findMissingSpdx`**

```js
// scripts/test/check-spdx.test.mjs
import { findMissingSpdx } from '../check-spdx.mjs';
const H = '// SPDX-License-Identifier: GPL-3.0-or-later';
test('accepts header in the first three lines', () => {
  expect(findMissingSpdx([
    { path: 'a.ts', content: `${H}\nexport {};` },
    { path: 'b.sh', content: `#!/bin/sh\n# SPDX-License-Identifier: GPL-3.0-or-later\n` },
  ])).toEqual([]);
});
test('reports files without header or with header below line 3', () => {
  expect(findMissingSpdx([
    { path: 'c.ts', content: 'export {};' },
    { path: 'd.ts', content: `\n\n\n${H}` },
  ])).toEqual(['c.ts', 'd.ts']);
});
```

Run: `pnpm vitest run scripts`
Expected: FAIL, Modul fehlt.

- [ ] **Step 5: `scripts/check-spdx.mjs` implementieren**

Regel: Eine der ersten drei Zeilen enthält `SPDX-License-Identifier: GPL-3.0-or-later`. Die CLI prüft `git ls-files` gefiltert auf `packages/*/src/**`, `packages/*/test/**/*.ts`, `scripts/**/*.mjs`, `native/src/**`, `native/test/**` und `native/build.sh`; `*.json` ist ausgenommen.

- [ ] **Step 6: Grün und Lint erweitert**

Run: `pnpm vitest run scripts && pnpm lint`
Expected: PASS. `lint` meldet keine fehlenden Header, weil `cell.ts` und `cell.test.ts` aus Task 3 bereits einen tragen. Fehlt er dort, nachtragen.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "docs: GPL-3.0 license, NOTICE, SPDX and patch header conventions"
```

---

### Task 5: CI-Skelett (M0)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: Workflow `ci` mit Job `check` und dem Aggregat-Job `ci` (`needs: [check]`). Der Status-Check heißt dadurch dauerhaft `ci`, auch wenn Task 12 weitere Jobs ergänzt (§8.6 Schritt 11).

- [ ] **Step 1: `ci.yml` schreiben**

Trigger `push` und `pull_request`; `permissions: { contents: read }`. Job `check` auf `ubuntu-latest`: `actions/checkout@v7`, `jdx/mise-action@v5`, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`. Job `ci`: `needs: [check]`, ein `run: echo ok`.

- [ ] **Step 2: Lokal verifizieren**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest && pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck`
Expected: actionlint ohne Befund, Rest grün.

- [ ] **Step 3: Commit**

```bash
git add .github && git commit -m "ci: install, lint and typecheck"
```

- [ ] **Step 4: M0 — Push nach Freigabe durch den Owner, Lauf prüfen**

Run: `git push origin master && gh run watch --exit-status`
Expected: Workflow `ci` grün. Damit ist M0 erreicht: Legacy getaggt, Vendor-Code diffbar im Repo, Workspace grün in CI.

---

# Phase 1 — Wasm-Kern

### Task 6: PRNG und Unity-TU

**Files:**
- Create: `native/src/prng.h`, `native/src/dungeonmaker_unity.cpp`, `native/test/prng_test.cpp`, `native/test/run.sh`

**Interfaces:**
- Produces: `static inline void dm_srand(unsigned int seed)` und `static inline int dm_rand(void)` (Wertebereich `0 … 2147483647`) in `prng.h`. Die Unity-TU stellt alle Symbole aus `DungeonMaker.cpp` bereit, mit `rand`/`srand` auf diese Funktionen umgeleitet.
- `native/test/run.sh` läuft vom Repo-Root, nutzt `${CXX:-c++}` mit `-std=c++17 -O2 -fno-exceptions -fno-rtti -I native/src` (niemals `-DNDEBUG`) und baut in ein `mktemp -d`-Verzeichnis.

- [ ] **Step 1: Failing Known-Answer-Test**

`native/test/prng_test.cpp` prüft mit einem kleinen `CHECK`-Makro (Ausgabe plus Exit-Code 1 bei Fehler):
- `dm_srand(42)`: die ersten drei `dm_rand()` sind `962320717, 897835604, 1635433963`
- `dm_srand(1)`: `62156454, 895549723, 706385599`
- erneutes `dm_srand(42)` reproduziert die erste Folge
- 10 000 Ziehungen liegen in `[0, 2147483647]`

`run.sh` kompiliert und startet zunächst nur diesen Test.

Run: `sh native/test/run.sh`
Expected: FAIL, `prng.h` fehlt.

- [ ] **Step 2: `prng.h` implementieren**

Kopf mit SPDX und Modifikationsvermerk (was, warum: §5.3, Datum). Der Algorithmus ist exakt festgelegt, weil Golden-Werte daran hängen:

```cpp
static uint64_t dm_pcg_state = 0;
static inline uint32_t dm_pcg32_next(void) {
  uint64_t old = dm_pcg_state;
  dm_pcg_state = old * 6364136223846793005ULL + 1442695040888963407ULL;
  uint32_t xorshifted = (uint32_t)(((old >> 18u) ^ old) >> 27u);
  uint32_t rot = (uint32_t)(old >> 59u);
  return (xorshifted >> rot) | (xorshifted << ((32u - rot) & 31u));
}
static inline void dm_srand(unsigned int seed) {
  dm_pcg_state = 0; dm_pcg32_next(); dm_pcg_state += (uint64_t)seed; dm_pcg32_next();
}
static inline int dm_rand(void) { return (int)(dm_pcg32_next() >> 1); }
```

- [ ] **Step 3: Test grün**

Run: `sh native/test/run.sh`
Expected: PASS.

- [ ] **Step 4: Unity-TU schreiben**

Kopf wie in Step 2. Reihenfolge ist Pflicht: zuerst **alle** Std-Header, die Vendor-Header und -Quelle einbinden (`<cstdlib> <ctime> <cstdint> <cassert> <cstdio> <iostream> <fstream> <sstream> <algorithm> <string> <list> <vector> <utility>`), dann `prng.h`, dann `#define rand dm_rand` / `#define srand dm_srand`, dann `#include "../vendor/dungeonmaker-2.05/DungeonMaker.cpp"`, danach `#undef`. Grund: Wird `<algorithm>` erst nach dem Makro geladen, bricht libstdc++ mit »`dm_rand` ist kein Element von `std`« ab.

- [ ] **Step 5: Keine libc-`rand` mehr**

`run.sh` ergänzen: Die Unity-TU wird zu einem Objekt kompiliert, danach läuft `nm -u <obj> | grep -wE 'rand|srand'`. Treffer brechen das Script ab.
Run: `sh native/test/run.sh`
Expected: PASS, keine Treffer. Die zwei Upstream-Warnungen zu `NULL`-Vergleichen in `Init_fromFile`/`Init_fromText` sind bekannt und harmlos.

- [ ] **Step 6: Commit**

```bash
git add native && git commit -m "feat(native): PCG32 replaces libc rand via unity translation unit"
```

---

### Task 7: Bridge und nativer Referenz-Harness

**Files:**
- Create: `native/src/bridge.h`, `native/src/bridge.cpp`, `native/test/bridge_test.cpp`, `native/test/native_hashes.cpp`, `packages/dungeonmaker-js/test/golden/native-fnv.json`
- Modify: `native/test/run.sh`

**Interfaces:**
- Produces (C-ABI, `extern "C"`, in `bridge.h`):
  ```c
  int32_t        dm_generate(const char* design_text, uint32_t seed, uint32_t flags); // 0 ok · 1 design error · 2 invalid seed; flags reserviert, 0 übergeben
  uint32_t       dm_width(void);       // Library-dimY
  uint32_t       dm_height(void);      // Library-dimX
  const uint8_t* dm_cells(void);       // width*height Bytes, index = y*width + x, Werte = SquareData; nullptr ohne Ergebnis
  const char*    dm_last_error(void);  // "" nach Erfolg
  void           dm_reset(void);       // gibt Ergebnis-Puffer frei
  ```
- Produces: `native/test/run.sh` mit Modi `--check` (Default: alle nativen Tests plus Diff der Hashes gegen die Golden-Datei) und `--write` (schreibt die Golden-Datei).
- Golden-Format: JSON-Objekt `"<design>:<seed>": "<fnv1a32 als 8 hex, klein>"`. Die Schlüssel sind bytewise sortiert, zwei Spaces Einrückung, abschließender Zeilenumbruch. FNV-1a 32: Offset `2166136261`, Prime `16777619`, über die Zellbytes in Ausgabereihenfolge.

- [ ] **Step 1: Failing Bridge-Tests**

`bridge_test.cpp` liest Designs aus `native/vendor/dungeonmaker-2.05/` und prüft:

| Eingabe | Status | `dm_last_error()` enthält |
|---|---|---|
| `design`, Seed 42 | 0 | `""`; außerdem `dm_width()==200`, `dm_height()==80`, `dm_cells()!=nullptr` |
| `design`, Seed 0 | 2 | `seed must be in 1..4294967295` |
| `""` | 1 | `missing D record` |
| `"D 50 50 CLOSED 12 18 NO"` | 1 | `D record must be followed by an XX line` |
| `design` + `"\nWPX\n"` | 1 | `design text rejected by parser` |
| `design` mit D-Zeile `D 5000 5000 …` | 1 | `map dimensions must be within 3..4096` |
| `design` ohne die Zeile, die mit `BC` beginnt | 1 | `BC record must have 11 entries` |
| `design` ohne die Zeile, die mit `S ` beginnt | 1 | `missing S record` |
| nach `dm_reset()` | — | `dm_width()==0`, `dm_cells()==nullptr` |

Run: `sh native/test/run.sh`
Expected: FAIL, `bridge.h` fehlt.

- [ ] **Step 2: `bridge.cpp` implementieren**

Jeder Aufruf beginnt mit `dm_reset()`. Die Prüfungen laufen in dieser Reihenfolge, die erste verletzte bestimmt Status und Meldung:
1. `seed == 0` → 2.
2. Keine Zeile, deren erstes Nicht-Leerzeichen `D` oder `d` ist → 1, `missing D record`.
3. Nach der letzten solchen Zeile kein whitespace-getrenntes Token `XX` → 1. Grund: Der Parser liest sonst endlos Richtungen.
4. `alifegames::Config::AcceptDesign` liefert `false` → 1.
5. `dX` oder `dY` außerhalb `3 … 4096` → 1.
6. `BDPFGC`/`BDPFGR`/`BDPFGT` nicht genau 11 Einträge → 1 (`BC`/`BR`/`BT` in der Meldung).
7. `SL`, `CW`, `MAC`, `MAT`, `jP`, `sUpP`, `sDownP` leer → 1, `missing <S|C|AC|AT|J|ZU|ZD> record`. Grund: Die Getter rufen `.back()` auf leeren Vektoren auf.

Danach eine frische lokale `Config` und ein frischer lokaler `DungeonMaker`, nie wiederverwendet. Dann `Init_fromConfig(config, seed)` und `generate()`. Die Zellen werden linear in Library-Reihenfolge kopiert (`cells[x * dimY + y] = (uint8_t)GetMap(x, y)`), das ist bereits north-up row-major. `static_assert(alifegames::COLUMN == 19)`.

- [ ] **Step 3: Bridge-Tests grün**

Run: `sh native/test/run.sh`
Expected: PASS.

- [ ] **Step 4: Hash-Harness und Golden-Datei**

`native_hashes.cpp` erzeugt alle Kombinationen aus den elf Designs und den Seeds `1, 2, 3, 42, 4294967295` über die Bridge. Dazu kommt der Schlüssel `design[1024x1024]:42`: `design`, dessen erste D-Zeile die beiden Zahlen durch `1024 1024` ersetzt bekommt. Die Ausgabe läuft über `std::map`.

Run: `sh native/test/run.sh --write && sh native/test/run.sh`
Expected: Datei geschrieben, danach `--check` grün. Die Werte **müssen** dieser beim Planen nativ erzeugten Tabelle entsprechen. Weicht einer ab, ist das ein Befund für superpowers:systematic-debugging. Die Tabelle wird nie an das Ergebnis angepasst.

```json
{
  "design2:1": "52cf4f99", "design2:2": "dc299ec2", "design2:3": "45439ca9", "design2:42": "58d44647", "design2:4294967295": "a37ba0fd",
  "design3A:1": "7c525843", "design3A:2": "dd5a4ef0", "design3A:3": "b96eaf0d", "design3A:42": "99cc67de", "design3A:4294967295": "47cd6f8e",
  "design3WithTunnelers:1": "531caafb", "design3WithTunnelers:2": "d2cef88e", "design3WithTunnelers:3": "98f399ec", "design3WithTunnelers:42": "c9135271", "design3WithTunnelers:4294967295": "6ee4427e",
  "design4A:1": "f1395df6", "design4A:2": "c109fbf1", "design4A:3": "b0b4f24f", "design4A:42": "671f7bf3", "design4A:4294967295": "6eb84d14",
  "design5:1": "b287dd9d", "design5:2": "489461f4", "design5:3": "dfdd429f", "design5:42": "de103242", "design5:4294967295": "f8d86589",
  "design6:1": "a3a544ed", "design6:2": "cae8d868", "design6:3": "bd6b591d", "design6:42": "da7eedf4", "design6:4294967295": "9d783a57",
  "design7:1": "8eb9516a", "design7:2": "9df5bfd4", "design7:3": "6cc6c746", "design7:42": "73b2b9a0", "design7:4294967295": "9f7e012b",
  "design:1": "3409c209", "design:2": "9631a48f", "design:3": "b0b72f0d", "design:42": "5c99a857", "design:4294967295": "bfbe6bc1",
  "designEmpty2:1": "fcc7782a", "designEmpty2:2": "f7014b29", "designEmpty2:3": "914e3036", "designEmpty2:42": "46d9f706", "designEmpty2:4294967295": "c782e47e",
  "designEmpty:1": "6b29a232", "designEmpty:2": "ab8ee346", "designEmpty:3": "fb169eab", "designEmpty:42": "76b15617", "designEmpty:4294967295": "6ab9e2a9",
  "designOld1:1": "ac13017f", "designOld1:2": "307b92ed", "designOld1:3": "5f4aa11e", "designOld1:42": "74879afe", "designOld1:4294967295": "7562ec4d",
  "design[1024x1024]:42": "6dd3d41c"
}
```

(Hier kompakt; die geschriebene Datei steht im Golden-Format, ein Schlüssel pro Zeile.)

- [ ] **Step 5: Commit**

```bash
git add native packages/dungeonmaker-js/test/golden && git commit -m "feat(native): C ABI bridge with safety checks and native golden hashes"
```

---

### Task 8: Container-Build des Wasm

**Files:**
- Create: `native/build.sh`, `native/src/license-banner.js`, `.gitattributes`, `packages/dungeonmaker-js/wasm/dungeonmaker.js`, `packages/dungeonmaker-js/wasm/dungeonmaker.wasm`, `packages/dungeonmaker-js/wasm/BUILD-INFO.json`

**Interfaces:**
- Consumes: `bridge.cpp`, `dungeonmaker_unity.cpp` (Tasks 6–7).
- Produces: ES-Modul `wasm/dungeonmaker.js`, Default-Export `loadDungeonMakerWasm(moduleArg) → Promise<Module>`. Module-Exports: `_dm_generate _dm_width _dm_height _dm_cells _dm_last_error _dm_reset _malloc _free`, Runtime: `HEAPU8 stringToUTF8 lengthBytesUTF8 UTF8ToString`. Akzeptierte Module-Optionen: `locateFile instantiateWasm print printErr`.
- `BUILD-INFO.json`: `{ "emscripten": <erste Zeile von em++ --version>, "image": <IMAGE>, "flags": [...], "nativeSourceHash": "sha256:<hex>" }`, ohne Zeitstempel.

- [ ] **Step 1: `build.sh` schreiben**

- `IMAGE="emscripten/emsdk:6.0.13@sha256:fb7864e398acfda863dfcea78b8bc8adad359fa60c6a0bbeb845931de64aa68a"`
- Runtime: `$DM_CONTAINER_RUNTIME`, sonst `docker`, falls vorhanden, sonst `podman`. User-Mapping bei docker `--user "$(id -u):$(id -g)"`, bei podman `--userns=keep-id`. Repo-Root wird nach `/src` gemountet, `-w /src -e HOME=/tmp -e EM_CACHE=/src/native/.emcache`.
- Flags: die Liste aus §5.1, mit `-sEXPORTED_FUNCTIONS` und `-sEXPORTED_RUNTIME_METHODS` wie im Interfaces-Block. Dazu `-Wno-null-arithmetic -Wno-sometimes-uninitialized -Wno-unused-private-field` (genau die drei Upstream-Warnungen unter clang), `--extern-pre-js native/src/license-banner.js`, Eingaben `native/src/dungeonmaker_unity.cpp native/src/bridge.cpp`, `-o packages/dungeonmaker-js/wasm/dungeonmaker.js`. Lehnt emcc 6.0.13 einen Spec-Flag ab, minimal anpassen und die Änderung in der Commit-Message nennen; `BUILD-INFO.json` hält ohnehin die tatsächlichen Flags fest.
- `nativeSourceHash`: `find native/src native/vendor native/patches native/build.sh -type f | LC_ALL=C sort | xargs sha256sum | sha256sum`. `native/test` fehlt bewusst, weil Tests das Wasm nicht verändern.
- `license-banner.js`: `/*! dungeonmaker-js | GPL-3.0-or-later | includes DungeonMaker 2.05 (c) Peter Henningsen / alifegames | source: https://github.com/spearwolf/dungeonmaker.js */`
- `native/.emcache/` ist seit Task 2 ignoriert.

- [ ] **Step 2: Bauen und Artefakt prüfen**

Run: `sh native/build.sh && head -c 120 packages/dungeonmaker-js/wasm/dungeonmaker.js && node --input-type=module -e "import f from './packages/dungeonmaker-js/wasm/dungeonmaker.js'; const m = await f(); console.log(typeof m._dm_generate, typeof m.UTF8ToString)"`
Expected: Datei beginnt mit `/*! dungeonmaker-js`, Ausgabe `function function`.

- [ ] **Step 3: Reproduzierbarkeit messen**

Run: `sha256sum packages/dungeonmaker-js/wasm/*`, Inhalt von `native/.emcache` löschen, erneut `sh native/build.sh`, wieder `sha256sum`.
Expected: Beide Läufe gleich → bit-reproduzierbar. Das Ergebnis (ja/nein) kommt in die Commit-Message, denn Task 12 wählt danach die Drift-Variante.

- [ ] **Step 4: `.gitattributes` und Commit**

`.gitattributes`: `packages/dungeonmaker-js/wasm/** linguist-generated binary`.

```bash
git add .gitattributes native packages/dungeonmaker-js/wasm && git commit -m "build(native): pinned Emscripten container build of dungeonmaker.wasm"
```

---

### Task 9: `core` — Laden und Generieren

**Files:**
- Create: `packages/dungeonmaker-js/src/core.ts`, `src/core/glue.ts`, `src/core/core.ts`, `src/core/diagnostics.ts`, `src/errors.ts`, `test/helpers.ts`, `test/core.test.ts`, `vitest.config.ts` (`testTimeout: 60_000`)

**Interfaces:**
- Consumes: Glue aus Task 8 und Golden-Datei aus Task 7.
- Produces (`src/core/core.ts`, re-exportiert von `src/core.ts` zusammen mit `Cell` und den Fehlerklassen):
  ```ts
  export interface LoadCoreOptions { wasmUrl?: string | URL; wasmModule?: WebAssembly.Module }
  export interface CoreResult {
    readonly width: number; readonly height: number; readonly seed: number;
    readonly cells: Uint8Array; readonly diagnostics: readonly string[];
  }
  export interface DungeonMakerCore {
    readonly wasmModule: WebAssembly.Module;
    readonly aborted: boolean;
    generate(designText: string, seed: number): CoreResult;
  }
  export function loadCore(options?: LoadCoreOptions): Promise<DungeonMakerCore>;
  ```
- Produces (`src/errors.ts`):
  ```ts
  export interface DesignIssue { readonly path: string; readonly message: string }
  export class DesignValidationError extends Error { readonly issues: readonly DesignIssue[]; readonly diagnostics: readonly string[] }
  export class GenerationError extends Error { readonly diagnostics: readonly string[] }
  ```
  `name` entspricht jeweils dem Klassennamen.
- Produces (`src/core/diagnostics.ts`): `createDiagnostics(limit = 200): { push(line: string): void; take(): string[] }`. Über dem Limit werden Zeilen gezählt, nicht gespeichert; `take()` hängt dann `… <n> more lines suppressed` an und leert den Sammler.
- `test/helpers.ts`: `DESIGNS` (die elf Namen), `SEEDS = [1, 2, 3, 42, 4294967295]`, `readDesign(name): string`, `withDimensions(text, dimX, dimY): string` (ersetzt die beiden Zahlen der ersten D-Zeile), `fnv1a32(bytes: Uint8Array): string`, `cellAt(r: CoreResult, x, y): number`, `golden: Record<string, string>`.

- [ ] **Step 1: Failing Tests (`test/core.test.ts`, gemeinsamer Core per `beforeAll`)**

```ts
test.each(DESIGNS.flatMap((d) => SEEDS.map((s) => [d, s] as const)))(
  'matches the native reference build: %s seed %i', (d, s) => {
    expect(fnv1a32(core.generate(readDesign(d), s).cells)).toBe(golden[`${d}:${s}`]);
  });

test('north-up orientation (NO/SO openings)', () => {
  const r = core.generate(readDesign('design3WithTunnelers'), 7);
  expect([r.width, r.height]).toEqual([100, 140]);
  expect(cellAt(r, 50, 0)).toBe(Cell.GuaranteedOpen);
  expect(cellAt(r, 50, 139)).toBe(Cell.GuaranteedOpen);
  expect(cellAt(r, 0, 70)).toBe(Cell.GuaranteedClosed);
  expect(cellAt(r, 99, 70)).toBe(Cell.GuaranteedClosed);
});

test('north-up orientation (WE/EA openings)', () => {
  const r = core.generate(readDesign('design3A'), 7);
  expect([r.width, r.height]).toEqual([160, 81]);
  expect(cellAt(r, 0, 40)).toBe(Cell.GuaranteedOpen);
  expect(cellAt(r, 159, 40)).toBe(Cell.GuaranteedOpen);
  expect(cellAt(r, 80, 0)).toBe(Cell.GuaranteedClosed);
});
```

Außerdem:
- `'is deterministic across interleaved calls'`: `design3A`/42, dann `design5`/1, dann wieder `design3A`/42; erstes und drittes Ergebnis sind byte-gleich.
- `'returns an exact, detached copy'`: `cells.buffer.byteLength === width * height`; ein weiterer `generate()` verändert das erste Ergebnis nicht; `result.seed === 42`.
- `'rejects invalid seeds before calling wasm'`: `0, -1, 1.5, 2 ** 32, Number.NaN` werfen `RangeError`; danach `core.aborted === false`.
- `'survives memory growth on a 1024x1024 map'`: `fnv1a32(core.generate(withDimensions(readDesign('design'), 1024, 1024), 42).cells)` ist `golden['design[1024x1024]:42']`.

Run: `pnpm --filter dungeonmaker-js test`
Expected: FAIL, `../src/core.js` fehlt.

- [ ] **Step 2: `glue.ts`**

Interface `DungeonMakerWasmModule` mit den Exports aus Task 8 (`HEAPU8: Uint8Array`, Funktionen als `number`-Signaturen). Der Factory-Import lautet `import factory from '../../wasm/dungeonmaker.js'` mit `// @ts-expect-error untyped Emscripten glue`. Der Pfad stimmt aus `src/core/` und aus `dist/core/` gleichermaßen, und `wasm/` bleibt rein generiert. Exportiert wird die typisierte Factory.

- [ ] **Step 3: `loadCore` und `generate` implementieren**

- Default-`wasmUrl`: `new URL('../../wasm/dungeonmaker.wasm', import.meta.url)`. Die Bytes kommen in Node (`globalThis.process?.versions?.node`) per dynamischem `import('node:fs/promises')` und `fileURLToPath`, sonst per `fetch`. Kompiliert wird einmal zu `WebAssembly.Module`, außer `wasmModule` ist gegeben.
- Instanziierung über den Factory-Hook `instantiateWasm(imports, done)` mit dem gecachten Modul; `print`/`printErr` schreiben in den Diagnostics-Sammler.
- `generate`: Seed prüfen (`Number.isInteger`, `1 … 4294967295`, sonst `RangeError`). Puffer mit `lengthBytesUTF8(text) + 1` allozieren, `stringToUTF8` schreiben, `_dm_generate(ptr, seed >>> 0, 0)` aufrufen, `_free`. **Nach** dem Aufruf `module.HEAPU8` frisch lesen, `HEAPU8.slice(ptr, ptr + width*height)` kopieren, `_dm_reset()`. Die Fehlerpfade (Status 1/2, Throw) setzt Task 10 um; bis dahin wirft jeder Status ≠ 0 einen `Error`.

- [ ] **Step 4: Tests grün**

Run: `pnpm --filter dungeonmaker-js test && pnpm typecheck && pnpm lint`
Expected: PASS. Ein Golden-Mismatch ist ein Befund (superpowers:systematic-debugging), kein Grund, die Golden-Datei zu ändern.

- [ ] **Step 5: Commit**

```bash
git add packages/dungeonmaker-js && git commit -m "feat(core): load wasm and generate north-up dungeons in Node"
```

---

### Task 10: `core` — Fehlerpfade und Abort-Recovery

**Files:**
- Modify: `packages/dungeonmaker-js/src/core/core.ts`
- Create: `test/core-errors.test.ts`, `test/diagnostics.test.ts`

**Interfaces:**
- Consumes: Fehlerklassen und `createDiagnostics` aus Task 9; Bridge-Meldungen aus Task 7.
- Produces: Mapping Status 1 → `DesignValidationError([{ path: '', message: UTF8ToString(_dm_last_error()) }], diagnostics)`, Status 2 → `RangeError`, Throw aus dem Wasm → `aborted = true` und `GenerationError(message, diagnostics, { cause })`. Jeder `generate()` nach einem Abort wirft sofort `GenerationError` mit `aborted` in der Meldung.

- [ ] **Step 1: Failing Tests**

`core-errors.test.ts`:

| Test | Eingabe | Erwartung |
|---|---|---|
| `'empty design is a validation error'` | `''`, Seed 1 | `DesignValidationError`, `issues[0].message` matcht `/missing D record/`; `core.aborted === false`; danach liefert `design`/42 den Golden-Hash |
| `'truncated D record does not hang'` | `'D 50 50 CLOSED 12 18 NO'` | `DesignValidationError` `/XX/`, Test-Timeout 5 000 ms |
| `'parser rejection carries library output'` | `design` + `'\nWPX\n'` | `/rejected by parser/`; `diagnostics` enthält eine Zeile mit `Expected WP1` |
| `'missing BC record'` | `design` ohne `BC`-Zeile | `/BC record must have 11 entries/` |
| `'oversized map'` | `withDimensions(design, 5000, 5000)` | `/3\.\.4096/` |
| `'non-ASCII text is marshalled as UTF-8'` | `design`, nach Zeile 1 eingefügt `XX Drachenhöhle 🐉 – ünïcödé` | Hash = `golden['design:42']` |
| `'assert abort becomes GenerationError and is recoverable'` | `design` + `'\nWS   500    500    WE   SW     0     15      2    4   1    7   0     20    0     60    10\n'` | `GenerationError`; Meldung oder `diagnostics` enthält `Assertion`; `core.aborted === true`; nächster Aufruf wirft `GenerationError` `/aborted/`; `loadCore({ wasmModule: core.wasmModule })` liefert für `design`/42 den Golden-Hash |

Der Abort-Test bekommt eine eigene Core-Instanz, damit er die geteilte nicht verbraucht.

`diagnostics.test.ts`: 205 × `push` bei `limit = 200` ergibt 201 Einträge, der letzte ist `… 5 more lines suppressed`; ein zweites `take()` ist leer.

Run: `pnpm --filter dungeonmaker-js test`
Expected: FAIL in den neuen Tests.

- [ ] **Step 2: Mapping implementieren** (Interfaces-Block oben)

Der Eingabepuffer wird nur bei intaktem Modul freigegeben, also nicht nach einem Abort. Ein erneutes `import` der Glue ist nicht nötig, denn Recovery läuft über `loadCore({ wasmModule })`.

- [ ] **Step 3: Grün**

Run: `pnpm --filter dungeonmaker-js test && pnpm typecheck && pnpm lint`
Expected: PASS, der Node-Prozess überlebt den Abort-Test (sonst würde Vitest abbrechen).

- [ ] **Step 4: Commit**

```bash
git add packages/dungeonmaker-js && git commit -m "feat(core): typed errors, bridge safety net and abort recovery"
```

---

### Task 11: Package-Metadaten, Größenbudget, Pack-Smoke

**Files:**
- Modify: `packages/dungeonmaker-js/package.json`, `.gitignore`, Root-`package.json` (devDependencies `publint`, `@arethetypeswrong/cli`)
- Create: `packages/dungeonmaker-js/README.md`, `packages/dungeonmaker-js/size-budget.json`, `scripts/copy-legal.mjs`, `scripts/check-size.mjs`, `scripts/pack-smoke.mjs`

**Interfaces:**
- Produces: `pnpm --filter dungeonmaker-js pack` erzeugt `dungeonmaker-js-0.0.1.tgz`. Root-Scripts `size` = `node scripts/check-size.mjs` und `pack:smoke` = `node scripts/pack-smoke.mjs`; beide enden mit Exit-Code ≠ 0 bei Verstoß.

- [ ] **Step 1: `package.json` des Packages**

`version "0.0.1"`, `description`, `license "GPL-3.0-or-later"`, `author`, `homepage "https://github.com/spearwolf/dungeonmaker.js"`, `bugs`, `repository { "type": "git", "url": "git+https://github.com/spearwolf/dungeonmaker.js.git", "directory": "packages/dungeonmaker-js" }`, `type "module"`, `sideEffects false`, `engines { "node": ">=22" }`, `publishConfig { "access": "public" }` (ohne `provenance`, sonst scheitert der lokale `0.0.1`-Publish).
`exports`: `"./core": { "types": "./dist/core.d.ts", "default": "./dist/core.js" }`, `"./dungeonmaker.wasm": "./wasm/dungeonmaker.wasm"`, `"./package.json": "./package.json"`.
`files`: `dist`, `wasm/dungeonmaker.js`, `wasm/dungeonmaker.wasm`, `wasm/BUILD-INFO.json`, `README.md`, `LICENSE`, `NOTICE`.
Scripts: `prepack` = `node ../../scripts/copy-legal.mjs && pnpm run build`. `.gitignore` bekommt `packages/dungeonmaker-js/LICENSE` und `packages/dungeonmaker-js/NOTICE` (Kopien).

- [ ] **Step 2: Package-README (Englisch)**

Pitch als »unofficial WebAssembly port of DungeonMaker 2.05 by Peter Henningsen« mit Upstream-Link. Status »0.0.x — only `dungeonmaker-js/core`, API not stable«. Ein Node-Beispiel mit `loadCore` + `generate`. Die konservative Lizenz-Faustregel aus §9.4. Zur Quellenpflicht der Satz »Corresponding source for every published version: git tag `v<version>` at https://github.com/spearwolf/dungeonmaker.js« (§9.3, GPLv3 §6(d)).

- [ ] **Step 3: Tarball-Inhalt prüfen**

Run: `pnpm --filter dungeonmaker-js pack --pack-destination "$(mktemp -d)"` und `tar tzf` auf das Ergebnis.
Expected: `package.json`, `README.md`, `LICENSE`, `NOTICE`, `dist/core.js`, `dist/core.d.ts`, `dist/cell.*`, `dist/errors.*`, `dist/core/*`, die drei `wasm/`-Dateien; kein `src/`, kein `test/`, kein `tsconfig*`.

- [ ] **Step 4: publint und attw**

Run: `pnpm exec publint --strict packages/dungeonmaker-js && pnpm --filter dungeonmaker-js exec attw --pack . --profile esm-only`
Expected: keine Fehler. Meckert attw über den Nicht-JS-Subpath `./dungeonmaker.wasm`, wird genau dieser per `--exclude-entrypoints ./dungeonmaker.wasm` ausgenommen.

- [ ] **Step 5: Größenbudget**

`check-size.mjs` misst gzip (Level 9, `node:zlib`) von `wasm/dungeonmaker.wasm` und `wasm/dungeonmaker.js` und vergleicht mit `size-budget.json` (`{ "wasmGzipBytes": n, "glueGzipBytes": m }`). Das Budget ist der Messwert × 1,10, aufgerundet auf das nächste Vielfache von 1 024. Die Messwerte kommen in die Commit-Message (§8.3: »Größenbudget wird in M1 festgelegt«).
Run: `pnpm size`
Expected: PASS.

- [ ] **Step 6: Pack-Smoke**

`pack-smoke.mjs`: pnpm-pack in ein Temp-Verzeichnis, ein zweites Temp-Verzeichnis außerhalb des Repos mit `{ "type": "module", "private": true }`, dort `pnpm add <tgz>`. Ein Skript importiert `dungeonmaker-js/core`, liest `design3A` aus dem Vendor-Pfad des Repos (absoluter Pfad als Argument) und prüft `fnv1a32(cells) === '99cc67de'`.
Run: `pnpm pack:smoke`
Expected: Exit-Code 0.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "build: package metadata, size budget and pack smoke test for 0.0.1"
```

---

### Task 12: CI ausbauen (Tests, nativer Abgleich, Drift-Check)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `native/test/run.sh` (Task 7), `native/build.sh` (Task 8), Root-Scripts `test`, `build`, `size`, `pack:smoke` (Tasks 9–11).
- Produces: Jobs `check`, `native`, `wasm-drift`; Aggregat `ci` mit `needs: [check, native, wasm-drift]`.

- [ ] **Step 1: Jobs ergänzen**

- `check`: zusätzlich `pnpm test`, `pnpm build`, `pnpm size`, publint/attw wie in Task 11, `pnpm pack:smoke`.
- `native`: `sh native/test/run.sh`, gcc liegt auf `ubuntu-latest` bereit. Damit ist die Plattformgarantie aus §5.3 in CI verankert: Nativer Build und Wasm treffen dieselbe Golden-Datei.
- `wasm-drift`: `actions/cache` für `native/.emcache`, Key aus dem Image-Digest, dann `sh native/build.sh`.
  - War Task 8 **bit-reproduzierbar:** `git diff --exit-code -- packages/dungeonmaker-js/wasm`.
  - **Sonst:** `git diff --exit-code -- packages/dungeonmaker-js/wasm/BUILD-INFO.json` (fängt `native/`-Änderungen ohne Rebuild über `nativeSourceHash`), danach `pnpm install --frozen-lockfile && pnpm --filter dungeonmaker-js test` gegen das frisch gebaute Wasm (Verhaltensvergleich über die Golden-Hashes, §8.1).

- [ ] **Step 2: Gegenprobe Drift**

Lokal: eine Kommentarzeile in `native/src/bridge.cpp` ändern, **ohne** neu zu bauen, und den Prüfbefehl des Drift-Jobs nach `sh native/build.sh` ausführen.
Expected: `git diff --exit-code` schlägt fehl. Danach die Änderung zurücknehmen und erneut bauen, bis der Arbeitsbaum sauber ist.

- [ ] **Step 3: Verifizieren und committen**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest`
Expected: kein Befund.

```bash
git add .github && git commit -m "ci: tests, native golden cross-check and wasm drift check"
```

---

### Task 13: Release-Pipeline

**Files:**
- Create: `scripts/release-check.mjs`, `scripts/test/release-check.test.mjs`, `.github/workflows/release.yml`, `RELEASING.md`
- Modify: Root-`package.json` (devDependency `semver`)

**Interfaces:**
- Produces: `decideRelease({ version, published }: { version: string; published: readonly string[] }): { publish: boolean; distTag: 'latest' | 'next' }`. Wirft `Error` mit `/not a valid semver/` oder `/downgrade/`.
- CLI (`node scripts/release-check.mjs`): liest die Version aus `packages/dungeonmaker-js/package.json` und holt `npm view dungeonmaker-js versions --json` (E404 → `[]`, ein einzelner String → `[string]`). Ausgabe nach `$GITHUB_OUTPUT` (ohne die Variable nach stdout): `publish=<true|false>`, `version=<v>`, `dist-tag=<tag>`.

- [ ] **Step 1: Failing Tests**

```js
test.each([
  [{ version: '0.0.1', published: [] }, { publish: true, distTag: 'latest' }],
  [{ version: '0.0.1', published: ['0.0.1'] }, { publish: false, distTag: 'latest' }],
  [{ version: '0.0.2', published: ['0.0.1'] }, { publish: true, distTag: 'latest' }],
  [{ version: '1.2.0-beta.1', published: ['1.1.0'] }, { publish: true, distTag: 'next' }],
])('decideRelease(%o)', (input, expected) => expect(decideRelease(input)).toEqual(expected));
test('downgrade fails', () =>
  expect(() => decideRelease({ version: '0.0.1', published: ['0.0.2'] })).toThrow(/downgrade/));
test('invalid version fails', () =>
  expect(() => decideRelease({ version: 'abc', published: [] })).toThrow(/not a valid semver/));
```

Run: `pnpm vitest run scripts`
Expected: FAIL.

- [ ] **Step 2: `release-check.mjs` implementieren**

Reihenfolge: Semver-Gültigkeit, dann »schon veröffentlicht« → `publish: false`, dann `semver.lte(version, max(published))` → Downgrade-Fehler; Prerelease → `next`.

- [ ] **Step 3: Grün**

Run: `pnpm vitest run scripts`
Expected: PASS.

- [ ] **Step 4: `release.yml` schreiben**

```yaml
name: release            # Dateiname MUSS release.yml bleiben – npm Trusted Publishing prüft ihn
on:
  push: { branches: [master], paths: ['packages/dungeonmaker-js/package.json'] }
  workflow_dispatch:
concurrency: { group: release, cancel-in-progress: false }
permissions: { contents: read }
jobs:
  check:
    runs-on: ubuntu-latest
    outputs:
      publish: ${{ steps.decide.outputs.publish }}
      version: ${{ steps.decide.outputs.version }}
      dist-tag: ${{ steps.decide.outputs.dist-tag }}
    steps:
      - uses: actions/checkout@v7
      - uses: jdx/mise-action@v5
      - run: pnpm install --frozen-lockfile
      - id: decide
        run: node scripts/release-check.mjs
  publish:
    needs: check
    if: needs.check.outputs.publish == 'true'
    runs-on: ubuntu-latest
    environment: npm
    permissions: { contents: write, id-token: write }
    env: { VERSION: '${{ needs.check.outputs.version }}', DIST_TAG: '${{ needs.check.outputs.dist-tag }}' }
    steps:
      - uses: actions/checkout@v7
      - uses: jdx/mise-action@v5
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm size && pnpm pack:smoke
      - run: npm pkg set gitHead="$GITHUB_SHA"
        working-directory: packages/dungeonmaker-js
      - run: pnpm --filter dungeonmaker-js pack --pack-destination out/
      - run: node -e "process.exit(require('semver').gte(process.argv[1],'11.5.1')?0:1)" "$(npm --version)"
      - run: npm publish "out/dungeonmaker-js-$VERSION.tgz" --access public --tag "$DIST_TAG"
      - run: git archive --format=tar.gz --prefix="dungeonmaker.js-v$VERSION/" -o out/source.tar.gz HEAD
      - run: git tag "v$VERSION" && git push origin "v$VERSION"
      - run: gh release create "v$VERSION" --generate-notes out/dungeonmaker-js-$VERSION.tgz out/source.tar.gz
        env: { GH_TOKEN: '${{ github.token }}' }
```

Hinweis zur Reihenfolge: Der Publish läuft vor Tag und Release. Scheitert er, entsteht kein verwaister Tag. `workflow_dispatch` ist der Retry.

- [ ] **Step 5: `RELEASING.md` (Englisch)**

Eine Übertragung von Spec §8.6 »Einrichtung« A–E, »Danach — ein Release im Alltag« und »Fallstricke«. Dazu der Reihenfolge-Hinweis aus Task 14 Step 2: 0.0.1 lokal veröffentlichen, **bevor** der Commit mit `release.yml` gepusht wird.

- [ ] **Step 6: Verifizieren und committen**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest && pnpm lint`
Expected: kein Befund.

```bash
git add -A && git commit -m "ci: automatic npm release on version bump with trusted publishing"
```

---

### Task 14: Namen sichern und Pipeline Ende-zu-Ende beweisen (M1, Owner-Checkpoint)

Jeder Schritt hier wirkt nach außen und läuft nur mit dem Owner. Der Agent bereitet vor, prüft und dokumentiert.

**Files:**
- Modify: `packages/dungeonmaker-js/package.json` (`version` → `0.0.2`, erst in Step 5)

- [ ] **Step 1: Vorbedingungen (Owner, §8.6 A)**

npm-Konto mit 2FA (»Authorization and writes«). Lokal liegt `master` sauber vor, alle Tasks 1–13 sind committet, `pnpm test` ist grün.

- [ ] **Step 2: `0.0.1` lokal veröffentlichen — vor dem Push (Owner, §8.6 B)**

Die Reihenfolge ist zwingend. Würde zuerst gepusht, sähe `release.yml` die unveröffentlichte `0.0.1` und liefe ohne Trusted Publisher rot.

Run (Owner): `npm login`, dann `pnpm --filter dungeonmaker-js publish --access public`, dann `pnpm view dungeonmaker-js version`
Expected: `0.0.1`

- [ ] **Step 3: Push**

Run: `git push origin master && gh run list --workflow release.yml --limit 1`
Expected: `release` läuft, Job `check` meldet `publish=false`, `publish` wird übersprungen; `ci` ist grün.

- [ ] **Step 4: Trusted Publisher und GitHub-Settings (Owner, §8.6 C + D)**

Felder: `spearwolf` / `dungeonmaker.js` / `release.yml` / Environment `npm` / »npm publish« angehakt. In GitHub: Environment `npm` nur für `master`, Workflow-Permissions bleiben auf Default, keine Secrets. Pages bleibt unverändert, bis P5 `pages.yml` liefert. Die Frist beachten: Die Konfiguration verfällt nach 2 Tagen ohne erfolgreichen Lauf, Step 5 folgt deshalb direkt.

- [ ] **Step 5: `0.0.2`-Bump als Ende-zu-Ende-Test**

Run: `pnpm --filter dungeonmaker-js exec npm version patch --no-git-tag-version && git commit -am "release: dungeonmaker-js 0.0.2"`, nach Freigabe `git push origin master && gh run watch --exit-status`
Expected: `release` grün, Tag `v0.0.2` und GitHub-Release mit `dungeonmaker-js-0.0.2.tgz` und `source.tar.gz` existieren.

- [ ] **Step 6: Provenance prüfen**

Run: `npm view dungeonmaker-js@0.0.2 dist.attestations --json`
Expected: nicht leer. npmjs.com zeigt den Provenance-Badge.

- [ ] **Step 7: Tokens abschalten (Owner, §8.6 E)**

»Require two-factor authentication and disallow tokens« für das Package setzen.

**M1 erreicht:** `pnpm --filter dungeonmaker-js test` generiert alle elf Designs deterministisch in Node und trifft den nativen Build bytegenau. Das committete Wasm ist per Drift-Check gegen `native/` abgesichert. `0.0.2` hat allein der Versions-Bump veröffentlicht, mit Provenance.
