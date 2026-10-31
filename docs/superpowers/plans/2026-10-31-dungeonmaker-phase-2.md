# dungeonmaker-js Phase 2 (Design-Config) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Designs werden als lesbares JSON (`DesignConfig`) beschrieben, verlustfrei aus dem Legacy-Textformat importiert (`parseDesignText`) und in TypeScript in Designtext übersetzt (`toDesignText`), mit TypeBox als einziger Quelle für Typen, `design.schema.json` und `validateDesign()`, plus den elf Upstream-Designs als Presets.

**Architecture:** JSON ist die API, der Designtext bleibt das Wire-Format; `Config::AcceptDesign` im Wasm ist weiterhin die einzige Stelle, die `Config` befüllt. Parser und Serializer bilden das Textformat exakt so ab, wie `AcceptDesign` (mit Patch 0002) es liest; bewiesen wird das durch einen byte-genauen Round-Trip gegen die nativen Golden-Hashes. Die TypeBox-Runtime hängt nur am Entry `./schema`; alle anderen Module importieren aus dem Modell ausschließlich Typen.

**Tech Stack:** TypeScript 7 (`tsc`-Emit, ESM only), `typebox@1.4.3` (Paket `typebox`, nicht `@sinclair/typebox`), Vitest 5, Biome 2, pnpm 12, Node 26.

**Spec:** `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md` (Phase 2 aus §10; Modell §6, Package-Exports §8.3, Lizenzregeln §9.4). Vorgänger: `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-0-1.md`.

## Global Constraints

- JSON → Designtext passiert in TypeScript; kein JSON-Parser in C++, `native/` und `packages/dungeonmaker-js/wasm/` bleiben in dieser Phase unverändert (§6.1).
- `packages/dungeonmaker-js/test/golden/native-fnv.json` wird nicht angefasst. Ein Round-Trip, der einen Golden-Hash verfehlt, ist ein Fehler im Parser oder Serializer, nie im Golden-File.
- **Parser-Invariante:** Was `parseDesignText` akzeptiert, ergibt nach `toDesignText` dieselben Zellen wie der Originaltext für jeden Seed. Was es nicht verlustfrei abbilden kann, lehnt es mit `DesignValidationError` ab. Es darf strenger sein als `AcceptDesign`, nie anders.
- Koordinaten im JSON in Bildschirmkonvention (`x` = Spalte nach rechts, `y` = Zeile nach unten, Norden oben); getauscht wird ausschließlich in `src/config/axes.ts`. Himmelsrichtungen bleiben unverändert (§6.2).
- Arrays im JSON enthalten nie den Listen-Terminator des Textformats; der Serializer hängt ihn an (§6.2). Was jenseits des Array-Endes gilt, steht pro Feld im Abschnitt »Das JSON-Modell«.
- Nicht-Wirkendes fehlt im Modell: `showMovie`, `storeMovie`, `randSeed` und das `op`-Feld von Crawler-Paaren (§6.2). Der Serializer schreibt dafür `0 0 0` bzw. `1`.
- TypeBox ist die einzige Quelle für Typen und Schema (`Static<typeof DesignConfigSchema>`); keine handgeschriebenen Parallel-Interfaces (§2 Anti-Ziele, §6.3).
- Die TypeBox-Runtime wird nur von `src/schema/**` importiert. `src/config/**` und `src/index.ts` nutzen `import type` aus `src/schema/model.ts`. Kein `typebox/compile` (erzeugt Code per `new Function`, bricht unter strikter CSP).
- Fehler aus `parseDesignText`, `toDesignText` und `validateDesign` sind ausschließlich `DesignValidationError` bzw. `DesignIssue`-Listen; nie `TypeError`, nie ein Wasm-Abort (§4, §10 P2.6).
- `DesignIssue.path` ist ein JSON Pointer (RFC 6901), z. B. `/crawlers/seeds/0/location`. Fehler im Designtext tragen `path: ''` und beginnen mit `line <n>: `.
- ESM only, `tsc`-Emit ohne Bundling, `sideEffects: false`, Package-Lizenz `GPL-3.0-or-later`; eigene Quelldateien (auch generierte) tragen `SPDX-License-Identifier: GPL-3.0-or-later` in den ersten drei Zeilen (§8.2, §9.3).
- Presets stammen aus der GPL-Distribution und tragen im Header die Herkunft (`native/vendor/dungeonmaker-2.05/<name>`, © Peter Henningsen) (§9.3, §9.4).
- README auf Englisch (§8.5). Toolchain-Aufrufe über `mise x -- …`, wenn `pnpm`/`node` nicht im `PATH` liegen.

## Review Focus

1. **Legacy-Dateien aus anderen Editoren** (CRLF, UTF-8-BOM, Tabs, Record-Werte über mehrere Zeilen, Kommentar hinter einem vollständigen Record): `AcceptDesign` liest token- statt zeilenweise. Erwartet: dasselbe `DesignConfig` wie aus der Originaldatei. Test in Task 2 (`reflow`) und Task 3 (Hash gegen Golden).
2. **Terminator-Wert mitten in einem JSON-Array** (`corridorWidth: [15, 0, 7]`, `joinPreference: [0, -1]`, `perThousandWallSquares: [0, 99]`, `anteroomProbability: [20, 100]`): Der Text würde die Liste still kürzen, der Dungeon sähe anders aus. Erwartet: `DesignValidationError` mit Pfad auf das Element. Test in Task 4.
3. **Legacy-Crawler mit widersprüchlichen Richtungen** (`WS … NO SO …`, `WP2 … NO SO …`): `AcceptDesign` verwirft sie still. Bleiben sie im JSON, weicht der Round-Trip ab. Erwartet: verworfen, Zellen identisch zum Originaltext. Test in Task 3.
4. **Gleitkomma im Designtext** (`aspectRatio: 1/3`): Ein Serializer mit `toFixed()` verfälscht den Wert. Erwartet: kürzeste exakte Darstellung (`0.3333333333333333`), gleiche Zellen wie handgeschriebener Text. Test in Task 3.
5. **Aliasing zwischen Preset und Ableitung** (`extendDesign(presets.design5, …)` und danach das Ergebnis mutieren): Geteilte Arrays verändern das Modul-Preset für alle späteren Aufrufe. Erwartet: Basis und Patch bleiben unberührt. Test in Task 6.

## Festlegungen dieses Plans (zum Gegenlesen vor der Ausführung)

- **Listen jenseits des Endes:** Die Spec-Regel »der letzte Wert wiederholt sich« (§6.2) stimmt nur für `S C AC AT J ZU ZD` (Accessoren mit `.back()`). Upstream liefert jenseits des Endes bei `F` den Wert 100, bei `GS`/`GB` »100 % groß« und bei `K` »keine Crawler«. Das Modell übernimmt die Upstream-Semantik und dokumentiert sie pro Feld; eine Vereinheitlichung würde die Generierung verändern.
- **Flache Arrays statt `{ byGeneration: […] }`:** Die Skizze in §6.2 mischt beides. Hier gilt einheitlich `crawlers.corridorWidth: number[]`; der Index (Generation bzw. Tunnelbreite) steht in der Schema-Beschreibung. Das hält `extendDesign`-Patches kurz.
- **Pflicht-Records im Parser:** `D BC BR BT S C AC AT J ZU ZD` (wie die Bridge) plus `T M N PR PT PU`, deren Upstream-Defaults (alles 0) im Modell nicht sinnvoll abbildbar sind. Optional, weil ein leeres Array dasselbe bedeutet: `F GS GB K` sowie `R WS WP U E1 E2 H1 H2 I1 I2`. Doppelte Einzel-Records lehnt der Parser ab (Upstream hängt Listen dann still an).
- **Upstream-Normalisierungen übernimmt der Parser:** Clamping von `PR`/`PT`/`PU` auf 0…100, `PU`-Generationsverzögerung `< 1` → 1, `aspectRatio` außerhalb `(0, 1)` → 0.6, `anteroomGenerationSpeedUp ≤ 0` → 1. Verworfen wie bei `AcceptDesign` bzw. `SetRect`: `WS` mit widersprüchlichen Richtungen, das ganze Paar bei widersprüchlichem `WP2`, Rechtecke mit `from > to`. Das JSON bleibt so im Wertebereich des Schemas und bedeutet dasselbe.
- **Semantische Regeln** (immer aktiv, in `toDesignText`): die Liste aus §6.3 plus die Upstream-Asserts, die beim Planen gefunden wurden (Startrichtung kardinal wegen `assert` in `FrontFree`, Positionen innerhalb der Karte wegen `SetMap`, Rechtecke innerhalb der Karte). Keine spekulativen Regeln (etwa eine Ordnung der Raumgrößen): Alle elf Vendor-Designs erfüllen die Regeln, beim Planen per Skript geprüft.
- **Entry Points:** `.` (`dist/index.js`) entsteht schon jetzt mit `Cell`, Fehlerklassen, Typen, `parseDesignText`, `toDesignText`, `extendDesign`; Phase 3 ergänzt dort den Client. Dazu `./schema`, `./presets`, `./design.schema.json`.
- **`design.schema.json` liegt im Package-Root**, nicht in `dist/` (Abweichung von §8.3): Nur so löst die `$schema`-URL `https://unpkg.com/dungeonmaker-js/design.schema.json` aus §6.2 auf. Die Datei wird generiert, committet und per Test gegen das TypeBox-Modell auf Drift geprüft.
- **Presets als generierte TS-Module** (`src/presets/<name>.ts`, je ein Named Export) statt JSON-Dateien: kein Import-Attribut nötig, typisiert, einzeln tree-shakeable. `import * as presets from 'dungeonmaker-js/presets'` ergibt die Schreibweise `presets.design3A` aus der Spec.
- **Schema-Dialekt:** JSON Schema 2020-12, `$id` = die unpkg-URL, `additionalProperties: false` auf jedem Objekt (fängt Tippfehler wie `widht`), die Wurzel erlaubt zusätzlich ein optionales `$schema`-String-Feld.
- **`typebox` als Laufzeit-Dependency mit `^1.4.3`** (MIT, ohne eigene Dependencies, erschienen 2026-10-22); das Lockfile pinnt die genaue Version.
- **`population` ist optional** und wird in dieser Phase nur geparst, validiert und serialisiert. Wirkung entfaltet es erst mit `output.entities` in Phase 4 (§7.2).

## Das JSON-Modell

Verbindlich für alle Tasks. Spalte »Upstream« nennt Record und Feld in Textreihenfolge, »jenseits« die Bedeutung von Indizes hinter dem Array-Ende. »%« heißt Ganzzahl 0…100. Alle Ganzzahlen liegen zusätzlich im `int32`-Bereich.

**Hilfstypen**

| Typ | Form |
|---|---|
| `Point` | `{ x: int ≥ 0, y: int ≥ 0 }` — `x` Spalte, `y` Zeile; Upstream schreibt `zeile spalte` |
| `Direction` | `'N' \| 'NE' \| 'E' \| 'SE' \| 'S' \| 'SW' \| 'W' \| 'NW'` ↔ `NO NE EA SE SO SW WE NW` |
| `CardinalDirection` | `'N' \| 'E' \| 'S' \| 'W'` |
| `CellName` | `open closed guaranteedOpen guaranteedClosed nonJoinOpen nonJoinClosed nonJoinGuaranteedOpen nonJoinGuaranteedClosed insideRoomOpen insideTunnelOpen insideAnteroomOpen horizontalDoor verticalDoor mob1 mob2 mob3 treasure1 treasure2 treasure3 column` ↔ `OPEN CLOSED G_OPEN G_CLOSED NJ_OPEN NJ_CLOSED NJ_G_OPEN NJ_G_CLOSED IR_OPEN IT_OPEN IA_OPEN H_DOOR V_DOOR MOB1 MOB2 MOB3 TREAS1 TREAS2 TREAS3 COLUMN` (Reihenfolge = `Cell`) |
| `Genes` | `{ straightSingleSpawn, straightDoubleSpawn, turnSingleSpawn, turnDoubleSpawn, changeDirection }`, alle % ↔ `sSSP sDSP tSSP tDSP cDP` |
| `RoomSizeProbability` | `{ small, medium, large }`, alle %, Summe 100, `large ≤ 99` |
| `CrawlerSeed` (`WS`) | `{ location: Point, direction: CardinalDirection, intendedDirection: Direction \| 'any', dormancy: int ≥ 0, maxAge: int ≥ 0, generation: int ≥ 0, stepLength: int ≥ 1, open: boolean, corridorWidth: int ≥ 0, genes: Genes }` ↔ `locX locY dir intDir dorm maxAge gen sL op cW` + Gene; `'any'` ↔ `XX` |
| `CrawlerPairMember` (`WP1`/`WP2`) | `CrawlerSeed` ohne `open`; Upstream würfelt `op` neu, der Serializer schreibt `1` |
| `TunnelerSeed` (`U`) | `{ location, direction: CardinalDirection, intendedDirection: Direction, dormancy, maxAge, generation, stepLength: int ≥ 1, tunnelWidth: int ≥ 0, genes: TunnelerGenes }` |
| `TunnelerGenes` | `{ straightDoubleSpawn, turnDoubleSpawn, changeDirection, makeRoomsRight, makeRoomsLeft, joinPreference }`, alle % ↔ `sDSP tDSP cDP mRRP mRLP jP` |

**`DesignConfig`** (fett = optional, sonst Pflicht)

| JSON-Pfad | Typ | Upstream | jenseits |
|---|---|---|---|
| **`$schema`** | string, wird ignoriert | — | |
| `map.width` · `map.height` | int 3…4096 | `D` dimY · dimX | |
| `map.background` | `'open' \| 'closed'` | `D` background | |
| `map.joinDistance` · `map.tunnelJoinDistance` | int ≥ 0 | `D` joinDist · tunnelJoinDist | |
| `map.openings` | `Direction[]` (darf leer sein) | `D` openings, Ende `XX` | |
| **`rectangles`** | `{ from: Point, to: Point, cell: CellName }[]`, spätere überschreiben frühere | `R` sX sY eX eY type | |
| `spawnDelay.crawler` · `.roomie` · `.tunneler` | % × genau 11, Summe 100 | `BC` · `BR` · `BT` | |
| `crawlers.stepLength` | int ≥ 1, ≥ 1 Eintrag, Index = Generation | `S`, Ende `0` | letzter Wert |
| `crawlers.corridorWidth` | int ≥ 1, ≥ 1 Eintrag | `C`, Ende `0` | letzter Wert |
| `crawlers.maxAge` | int ≥ 1, ≥ 1 Eintrag | `AC`, Ende `0` | letzter Wert |
| `crawlers.random.perThousandWallSquares` | int 0…98, Index = Generation | `K`, Ende `99` | keine Crawler |
| `crawlers.random.genes` | `Genes` | `PR` | |
| `crawlers.inTunnels.enabled` | boolean | `M` crawlersInTunnels (≠ 0) | |
| `crawlers.inTunnels.inAnterooms` | boolean | `N` crawlersInAnterooms | |
| `crawlers.inTunnels.seedCount` | int ≥ 0 | `N` seedCrawlersInTunnels | |
| `crawlers.inTunnels.generation` | int ≥ −1 (−1 = nach allen anderen Buildern) | `N` tunnelCrawlerGeneration | |
| `crawlers.inTunnels.maxAge` · `.stepLength` | int ≥ 0 · int ≥ 1 | `PT` maxAge · sL | |
| `crawlers.inTunnels.genes` · `.closedProbability` | `Genes` · % | `PT` Gene · closedProb | |
| **`crawlers.seeds`** | `CrawlerSeed[]` | `WS` | |
| **`crawlers.pairs`** | `{ first: CrawlerPairMember, second: CrawlerPairMember }[]` | `WP1` + `WP2` | |
| `tunnelers.sizeUpProbability` · `.sizeDownProbability` | %, ≥ 1 Eintrag | `ZU` · `ZD`, Ende `-1` | letzter Wert |
| `tunnelers.anteroomProbability` | int 0…99, Index = Tunnelbreite | `F`, Ende `100` | 100 |
| `tunnelers.joinPreference` | %, ≥ 1 Eintrag | `J`, Ende `-1` | letzter Wert |
| `tunnelers.maxAge` | int ≥ 1, ≥ 1 Eintrag | `AT`, Ende `0` | letzter Wert |
| `tunnelers.sizeUpGenerationDelay` | int ≥ 0 | `M` sizeUpGenDelay | |
| `tunnelers.columns` | boolean | `M` columnsInTunnels (≠ 0) | |
| `tunnelers.anteroomGenerationSpeedUp` | int ≥ 1 | `M` genSpeedUpOnAnteRoom | |
| `tunnelers.lastChance` | `{ makeRoomsLeft, makeRoomsRight, changeDirection, straightDoubleSpawn, turnDoubleSpawn }` % + `generationDelay: int ≥ 1` | `PU` in genau dieser Reihenfolge | |
| **`tunnelers.seeds`** | `TunnelerSeed[]` | `U` | |
| `rooms.size` | `{ min, medium, large, max }` int ≥ 0 | `T` 1–4 | |
| `rooms.count.labyrinth` · `.dungeon` | `{ small, medium, large }` int ≥ 0 | `T` 5–7 · 8–10 | |
| `rooms.sizeProbability.sideways` · `.branching` | `RoomSizeProbability[]`, Index = Tunnelbreite | `GS` · `GB`, Ende `0 0 100` | `{ 0, 0, 100 }` |
| `rooms.aspectRatio` | number, `0 < r < 1` | `M` roomAspectRatio | |
| `behaviour.mutator` · `.patience` | int ≥ 0 | `M` mutator · patience | |
| `behaviour.noHeadingProbability` | % | `M` noHeadingProb | |
| **`population`** | s. u. | `E1 E2 H1 H2 I1 I2` | |

`population = { mobs: { labyrinth: { rooms: Group, open: { byLevel } }, dungeon: { rooms: Group, open: { anteroomProbability: %, byLevel } } }, treasure: { labyrinth: Group, dungeon: Group } }` mit `Group = { groupSize: int ≥ 0, groupSizeVariance: int ≥ 0, byLevel: int ≥ 0 [] }`. Zuordnung: `E1` = mobs.labyrinth.rooms, `E2` = mobs.labyrinth.open, `H1` = mobs.dungeon.rooms, `H2` = mobs.dungeon.open (erster Wert anteroomProbability), `I1` = treasure.labyrinth, `I2` = treasure.dungeon. Listen enden upstream mit einer negativen Zahl; der Serializer schreibt `-1`.

**Kanonischer Designtext** (Ausgabe von `toDesignText`; Tokens durch genau ein Leerzeichen getrennt, jede Zeile endet mit `\n`):

```
XX generated by dungeonmaker-js
D <height> <width> <BG> <joinDistance> <tunnelJoinDistance> <openings…>
XX
R <from.y> <from.x> <to.y> <to.x> <CELL>          je Rechteck, in Array-Reihenfolge
BC … · BR … · BT …                                  je 11 Werte
ZU … -1 · ZD … -1 · F … 100 · J … -1
T <10 Werte>
GS <s m l>… 0 0 100 · GB <s m l>… 0 0 100
S … 0 · C … 0 · AC … 0 · AT … 0
M <mutator> <noHeading> <patience> <sizeUpGenDelay> <columns 0|1> <inTunnels 0|1> <aspectRatio> <speedUp>
N <seedCount> <generation> 0 0 0 <inAnterooms 0|1>
K … 99
PR <5 Gene> · PT <maxAge> <stepLength> <5 Gene> <closedProbability> · PU <6 Werte>
WS … · WP1 … / WP2 … (direkt aufeinander) · U …
E1 <gs> <var> … -1 · E2 … -1 · H1 <gs> <var> … -1 · H2 <anteroomProb> … -1 · I1 … -1 · I2 … -1   nur mit population
```

Ganzzahlen werden mit `String(n)` geschrieben, `aspectRatio` ebenfalls mit `String(r)` (kürzeste Darstellung, die `>> double` exakt zurückliest). Booleans als `0`/`1`. Leere `F`/`GS`/`GB`/`K`-Arrays ergeben nur den Terminator (`F 100`, `GS 0 0 100`, `K 99`).

## File Structure

```
packages/dungeonmaker-js/
├─ package.json                  # + dependencies.typebox, exports . ./schema ./presets ./design.schema.json, files
├─ design.schema.json            # generiert aus DesignConfigSchema, committet
├─ README.md                     # + JSON-Design-Beispiel
├─ src/index.ts                  # Entry `.`
├─ src/schema.ts                 # Entry `./schema`
├─ src/presets.ts                # Entry `./presets` (Re-Exports)
├─ src/presets/<name>.ts         # 11 generierte Presets
├─ src/schema/model.ts           # TypeBox-Modell, DesignConfig & Co. (Static)
├─ src/schema/validate.ts        # validateDesign
├─ src/config/tokens.ts          # Richtungen, Zellnamen ↔ Upstream-Tokens
├─ src/config/axes.ts            # der einzige Achsentausch
├─ src/config/parse.ts           # parseDesignText
├─ src/config/serialize.ts       # toDesignText
├─ src/config/check.ts           # checkDesign (semantische Regeln)
├─ src/config/extend.ts          # extendDesign
└─ test/
   ├─ helpers.ts                 # + reflow(), vendorConfig()
   ├─ fixtures/broken-designs.ts # Sammlung kaputter Configs
   ├─ config-tokens.test.ts · schema-model.test.ts · parse.test.ts · roundtrip.test.ts
   └─ check.test.ts · validate.test.ts · presets.test.ts · extend.test.ts
scripts/generate-design-artifacts.mjs   # schreibt design.schema.json und src/presets/*.ts
scripts/pack-smoke.mjs                  # + Smoke für ., ./schema, ./presets, ./design.schema.json
package.json (root)                     # check:package: attw schließt ./design.schema.json aus
CLAUDE.md                               # Status Phase 2
```

---

### Task 1: Tokens, Achsen und TypeBox-Modell

**Files:**
- Modify: `packages/dungeonmaker-js/package.json` (Dependency)
- Create: `packages/dungeonmaker-js/src/config/tokens.ts`, `src/config/axes.ts`, `src/schema/model.ts`
- Test: `packages/dungeonmaker-js/test/config-tokens.test.ts`, `test/schema-model.test.ts`

**Interfaces:**
- Consumes: `Cell` aus `src/cell.ts`.
- Produces (`src/config/tokens.ts`): `DIRECTIONS` (`readonly ['N','NE','E','SE','S','SW','W','NW']`), `type Direction`, `CARDINAL_DIRECTIONS` (`['N','E','S','W']`), `type CardinalDirection`, `DIRECTION_TOKENS: Readonly<Record<Direction, string>>`, `ANY_DIRECTION = 'any'`, `ANY_DIRECTION_TOKEN = 'XX'`, `BACKGROUNDS` (`['open','closed']`), `type Background`, `CELL_NAMES` (20 Einträge, Reihenfolge wie `Cell`), `type CellName`, `CELL_TOKENS: Readonly<Record<CellName, string>>`.
- Produces (`src/config/axes.ts`): `pointFromLibrary(row: number, col: number): { x: number; y: number }`, `pointToLibrary(p: { x: number; y: number }): [row: number, col: number]`, `sizeFromLibrary(dimX: number, dimY: number): { width: number; height: number }`, `sizeToLibrary(size: { width: number; height: number }): [dimX: number, dimY: number]`.
- Produces (`src/schema/model.ts`): `DESIGN_SCHEMA_ID = 'https://unpkg.com/dungeonmaker-js/design.schema.json'`, `DesignConfigSchema` sowie `PointSchema`, `GenesSchema`, `CrawlerSeedSchema`, `CrawlerPairMemberSchema`, `TunnelerGenesSchema`, `TunnelerSeedSchema`, `RoomSizeProbabilitySchema`, `PopulationSchema`; Typen `DesignConfig`, `Point`, `Genes`, `CrawlerSeed`, `CrawlerPairMember`, `TunnelerGenes`, `TunnelerSeed`, `RoomSizeProbability`, `Population`, `Rectangle`, alle als `Static<typeof …Schema>`.

- [ ] **Step 1: Dependency hinzufügen**

Run: `pnpm --filter dungeonmaker-js add typebox@^1.4.3`
Expected: `packages/dungeonmaker-js/package.json` hat `"dependencies": { "typebox": "^1.4.3" }`, die Root-`package.json` bleibt unverändert, `pnpm-lock.yaml` löst `typebox` auf `1.4.3` auf.

- [ ] **Step 2: Failing Tests schreiben**

`test/config-tokens.test.ts`:

```ts
test('cell names follow the Cell numbering', () => {
  expect(CELL_NAMES.map((n) => n[0]?.toUpperCase() + n.slice(1))).toEqual(Object.keys(Cell));
});
test('cell tokens are the upstream SquareData names', () => {
  expect(CELL_NAMES.map((n) => CELL_TOKENS[n])).toEqual([
    'OPEN', 'CLOSED', 'G_OPEN', 'G_CLOSED', 'NJ_OPEN', 'NJ_CLOSED', 'NJ_G_OPEN', 'NJ_G_CLOSED',
    'IR_OPEN', 'IT_OPEN', 'IA_OPEN', 'H_DOOR', 'V_DOOR', 'MOB1', 'MOB2', 'MOB3',
    'TREAS1', 'TREAS2', 'TREAS3', 'COLUMN',
  ]);
});
test('direction tokens', () => {
  expect(DIRECTIONS.map((d) => DIRECTION_TOKENS[d])).toEqual(['NO', 'NE', 'EA', 'SE', 'SO', 'SW', 'WE', 'NW']);
});
test('axes swap row/column exactly once', () => {
  expect(pointFromLibrary(86, 44)).toEqual({ x: 44, y: 86 });
  expect(pointToLibrary({ x: 44, y: 86 })).toEqual([86, 44]);
  expect(sizeFromLibrary(80, 200)).toEqual({ width: 200, height: 80 });
  expect(sizeToLibrary({ width: 200, height: 80 })).toEqual([80, 200]);
});
```

`test/schema-model.test.ts`:

```ts
import Value from 'typebox/value';

test('enum types stay literal unions', () => {
  expectTypeOf<DesignConfig['map']['background']>().toEqualTypeOf<'open' | 'closed'>();
  expectTypeOf<CrawlerSeed['direction']>().toEqualTypeOf<'N' | 'E' | 'S' | 'W'>();
  expectTypeOf<Rectangle['cell']>().toEqualTypeOf<CellName>();
});
test('schema metadata', () => {
  expect(DesignConfigSchema.$id).toBe(DESIGN_SCHEMA_ID);
  expect(DesignConfigSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
});
test('objects reject unknown properties', () => {
  expect(Value.Check(PointSchema, { x: 1, y: 2 })).toBe(true);
  expect(Value.Check(PointSchema, { x: 1, y: 2, z: 3 })).toBe(false);
  expect(Value.Check(PointSchema, { x: -1, y: 0 })).toBe(false);
});
test('room size probabilities cap large below the GS/GB terminator', () => {
  expect(Value.Check(RoomSizeProbabilitySchema, { small: 0, medium: 1, large: 99 })).toBe(true);
  expect(Value.Check(RoomSizeProbabilitySchema, { small: 0, medium: 0, large: 100 })).toBe(false);
});
test('every property is documented', () => {
  // walk DesignConfigSchema: every entry of every `properties` map has a non-empty `description`
});
```

Den Walk im letzten Test ausschreiben (rekursiv über `properties`, `items`, `anyOf`).

- [ ] **Step 3: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/config-tokens.test.ts packages/dungeonmaker-js/test/schema-model.test.ts && pnpm typecheck`
Expected: FAIL, Module `../src/config/tokens.js` und `../src/schema/model.js` fehlen.

- [ ] **Step 4: `tokens.ts` und `axes.ts` implementieren**

Werte exakt aus dem Abschnitt »Das JSON-Modell«. `axes.ts` bekommt einen TSDoc-Kopf, der die Upstream-Konvention (`Map[x * dimY + y]`, `x` = Zeile) erklärt; es ist die einzige Datei mit Achsentausch.

- [ ] **Step 5: `model.ts` implementieren**

Jedes Objekt `Type.Object(props, { additionalProperties: false })`, Enums per `Type.Enum` aus den Arrays in `tokens.ts`, Ganzzahlen `Type.Integer` mit den Grenzen aus der Modelltabelle (plus `minimum: -2147483648` / `maximum: 2147483647`, wo die Tabelle keine engere Grenze nennt), optionale Felder per `Type.Optional`. Die Wurzel trägt `$id`, `$schema`, `title: 'DungeonMaker design'`. Jede Property bekommt eine englische `description`, die Bedeutung, Index-Semantik, »beyond the end«-Verhalten und am Ende `Upstream: <Record> <Feld>` nennt (Grundlage der Config Reference in Phase 5). Liefert `Type.Enum` mit den `readonly`-Tupeln keine Literal-Unions, auf eine Form ausweichen, die den Typtest in Step 2 besteht.

- [ ] **Step 6: Tests laufen lassen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/config-tokens.test.ts packages/dungeonmaker-js/test/schema-model.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/dungeonmaker-js/package.json pnpm-lock.yaml packages/dungeonmaker-js/src/config packages/dungeonmaker-js/src/schema packages/dungeonmaker-js/test/config-tokens.test.ts packages/dungeonmaker-js/test/schema-model.test.ts
git commit -m "feat(config): TypeBox design model, upstream tokens and axis mapping"
```

---

### Task 2: `parseDesignText`

**Files:**
- Create: `packages/dungeonmaker-js/src/config/parse.ts`
- Modify: `packages/dungeonmaker-js/test/helpers.ts`
- Test: `packages/dungeonmaker-js/test/parse.test.ts`

**Interfaces:**
- Consumes: Task 1 (`tokens.ts`, `axes.ts`, `import type` aus `model.ts`), `DesignValidationError` aus `src/errors.ts`.
- Produces: `parseDesignText(text: string): DesignConfig`. Das Ergebnis setzt `rectangles`, `crawlers.seeds`, `crawlers.pairs` und `tunnelers.seeds` immer (ggf. `[]`) und `population` genau dann, wenn mindestens einer der Records `E1 E2 H1 H2 I1 I2` vorkommt (fehlende Teile: `groupSize`/`groupSizeVariance`/`anteroomProbability` 0, `byLevel: []`).
- Produces (`test/helpers.ts`): `reflow(text: string): string`, `vendorConfig(name: string): DesignConfig` (= `parseDesignText(readDesign(name))`).

Parse-Regeln (Wahrheit: `Config::AcceptDesign` mit Patch 0002; der Parser ist token-, nicht zeilenbasiert):

- Tokens sind maximale Folgen von Nicht-Whitespace im Sinn von JS `\s` (umfasst `\r`, Tab, BOM), jeweils mit 1-basierter Zeilennummer.
- An Record-Position: ein Token, das mit `XX` beginnt, verwirft den Rest seiner Zeile; ein anderes Token, das mit `X` beginnt, ist ein Fehler (upstream `assert`). Sonst muss das Token exakt einer der Tags `D R BC BR BT ZU ZD F J T GS GB S C AC AT M N K PR PT PU WS WP1 U E1 E2 H1 H2 I1 I2` sein (nur Großbuchstaben); `WP2` ist nur direkt nach den Werten von `WP1` gültig, sonst Fehler.
- Werte folgen als nächste Tokens, auch über Zeilenumbrüche. `XX` an Wert-Position ist ein Fehler, außer in der Richtungsliste von `D`: Dort beendet `XX` die Liste und verwirft den Rest seiner Zeile.
- Ganzzahl: `/^[+-]?\d+$/` im `int32`-Bereich. `aspectRatio`: `/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/`, Wert per `Number()`. `M` columns/inTunnels: Ganzzahl, `≠ 0` → `true`. `N` showMovie/storeMovie/inAnterooms: Ganzzahl `0` oder `1`. `N` randSeed: Ganzzahl mit Betrag ≤ 4294967295, Wert verworfen.
- Listen lesen bis zum Terminator der Modelltabelle; der Terminator landet nicht im Array. `GS`/`GB`: Tripel bis `large == 100`; jedes Tripel nicht negativ mit Summe 100, sonst Fehler (wie upstream). `BC`/`BR`/`BT`: genau 11 Werte, Summe wird nicht geprüft.
- Richtungen: Startrichtung (`WS`, `WP`, `U`) muss kardinal sein, sonst Fehler; `XX` als Zielrichtung → `'any'` bei Crawlern, Fehler bei `U`. `WS`-`op` muss `0` oder `1` sein. `WS` mit widersprüchlichen Richtungen (Tabelle `Config::ValidateDirections`) wird verworfen, ebenso das ganze Paar bei widersprüchlichem `WP2`; widersprüchliches `WP1` ist ein Fehler.
- `R` mit `sX > eX` oder `sY > eY` wird verworfen; `D`-Hintergrund nur `OPEN`/`CLOSED`.
- Normalisierung wie upstream: `PR`, `PT` (nur die fünf Gene) und `PU` (die fünf Wahrscheinlichkeiten) auf 0…100 klemmen, `PU`-generationDelay `< 1` → 1, `aspectRatio` `≤ 0` oder `≥ 1` → 0.6, `anteroomGenerationSpeedUp ≤ 0` → 1.
- Fehlender Wert am Textende: `line <n>: <TAG> record is incomplete` (Zeile des Tags). Einzel-Records doppelt: `line <n>: duplicate <TAG> record`. Wiederholbar sind nur `R WS WP1/WP2 U`. Fehlende Pflicht-Records (`D BC BR BT S C AC AT J ZU ZD T M N PR PT PU`): ein Issue `missing <TAG> record` pro fehlendem Record. Alle anderen Fehler: genau ein Issue für das erste Problem.

- [ ] **Step 1: Helfer ergänzen**

`reflow(text)`: stellt `﻿` voran, verbindet Zeilen mit `\r\n`, lässt Kommentarzeilen und Leerzeilen unverändert und bricht jede Record-Zeile hinter dem Tag um, mit den Werten durch Tabs getrennt auf der Folgezeile.

- [ ] **Step 2: Failing Tests schreiben**

`test/parse.test.ts`, Erwartungen aus den Vendor-Dateien:

```ts
test.each(DESIGNS)('%s parses', (name) => expect(() => vendorConfig(name)).not.toThrow());

test('design: map, lists without terminators, records', () => {
  const d = vendorConfig('design');
  expect(d.map).toEqual({ width: 200, height: 80, background: 'closed', joinDistance: 12, tunnelJoinDistance: 18, openings: ['W'] });
  expect(d.spawnDelay.crawler).toEqual([0, 0, 50, 0, 50, 0, 0, 0, 0, 0, 0]);
  expect(d.crawlers.stepLength).toEqual([3, 3, 3, 3, 3, 3]);
  expect(d.crawlers.corridorWidth).toEqual([15, 15, 7, 7, 3, 3, 2, 2, 1]);
  expect(d.crawlers.random).toEqual({ perThousandWallSquares: [0], genes: { straightSingleSpawn: 0, straightDoubleSpawn: 20, turnSingleSpawn: 0, turnDoubleSpawn: 80, changeDirection: 20 } });
  expect(d.crawlers.inTunnels).toEqual({ enabled: false, inAnterooms: false, seedCount: 0, generation: -1, maxAge: 20, stepLength: 3, genes: { straightSingleSpawn: 0, straightDoubleSpawn: 0, turnSingleSpawn: 0, turnDoubleSpawn: 0, changeDirection: 0 }, closedProbability: 100 });
  expect(d.tunnelers.sizeUpProbability).toEqual([0, 10, 10, 10, 20, 30, 40]);
  expect(d.tunnelers.anteroomProbability).toEqual([20, 20, 50, 0, 0]);
  expect(d.tunnelers.joinPreference).toEqual([0, 0, 10, 100, 100]);
  expect(d.tunnelers.lastChance).toEqual({ makeRoomsLeft: 80, makeRoomsRight: 80, changeDirection: 30, straightDoubleSpawn: 0, turnDoubleSpawn: 30, generationDelay: 4 });
  expect([d.tunnelers.sizeUpGenerationDelay, d.tunnelers.columns, d.tunnelers.anteroomGenerationSpeedUp]).toEqual([1, false, 2]);
  expect(d.tunnelers.seeds).toEqual([{ location: { x: 2, y: 40 }, direction: 'E', intendedDirection: 'E', dormancy: 0, maxAge: 16, generation: 0, stepLength: 5, tunnelWidth: 1, genes: { straightDoubleSpawn: 25, turnDoubleSpawn: 50, changeDirection: 30, makeRoomsRight: 100, makeRoomsLeft: 100, joinPreference: 100 } }]);
  expect(d.rooms).toEqual({
    size: { min: 20, medium: 50, large: 100, max: 300 },
    count: { labyrinth: { small: 20, medium: 5, large: 1 }, dungeon: { small: 100, medium: 20, large: 2 } },
    sizeProbability: {
      sideways: [{ small: 100, medium: 0, large: 0 }, { small: 100, medium: 0, large: 0 }, { small: 70, medium: 30, large: 0 }, { small: 50, medium: 50, large: 0 }, { small: 0, medium: 50, large: 50 }],
      branching: [{ small: 100, medium: 0, large: 0 }, { small: 50, medium: 50, large: 0 }, { small: 0, medium: 30, large: 70 }],
    },
    aspectRatio: 0.6,
  });
  expect(d.behaviour).toEqual({ mutator: 20, noHeadingProbability: 40, patience: 90 });
  expect(d.population?.mobs.dungeon).toEqual({ rooms: { groupSize: 4, groupSizeVariance: 2, byLevel: [50, 20, 50, 5, 2] }, open: { anteroomProbability: 50, byLevel: [0, 30, 0, 20, 2] } });
  expect(d.population?.mobs.labyrinth.open.byLevel).toEqual([]);
  expect(d.population?.treasure.dungeon).toEqual({ groupSize: 0, groupSizeVariance: 2, byLevel: [3, 3, 2, 2, 1] });
});

test('design3A: rectangles swap to screen coordinates', () => {
  const d = vendorConfig('design3A');
  expect(d.map).toMatchObject({ width: 160, height: 81, openings: ['E', 'W'] });
  expect(d.rectangles?.[0]).toEqual({ from: { x: 76, y: 36 }, to: { x: 84, y: 44 }, cell: 'open' });
});

test('design5: crawler seeds and pairs', () => {
  const d = vendorConfig('design5');
  expect(d.crawlers.seeds?.[0]).toEqual({ location: { x: 70, y: 103 }, direction: 'N', intendedDirection: 'N', dormancy: 0, maxAge: 40, generation: 8, stepLength: 3, open: true, corridorWidth: 1, genes: { straightSingleSpawn: 0, straightDoubleSpawn: 30, turnSingleSpawn: 0, turnDoubleSpawn: 60, changeDirection: 40 } });
  expect(d.crawlers.pairs?.length).toBe(2);
  expect(d.crawlers.pairs?.[0]?.first).toMatchObject({ location: { x: 70, y: 15 }, direction: 'E', corridorWidth: 7 });
  expect(d.crawlers.pairs?.[0]?.second).toMatchObject({ location: { x: 70, y: 15 }, direction: 'W' });
  expect(d.crawlers.pairs?.[0]?.first).not.toHaveProperty('open');
});

test.each(DESIGNS)('%s: CRLF, BOM, tabs and wrapped records parse identically', (name) => {
  expect(parseDesignText(reflow(readDesign(name)))).toEqual(vendorConfig(name));
});

test('comments after a complete record and after the D openings', () => {
  const text = readDesign('design').replace(/^T .*$/m, '$& XX trailing comment').replace(/^D .*$/m, '$& XX rest of the line');
  expect(parseDesignText(text)).toEqual(vendorConfig('design'));
});

test('upstream normalisations', () => {
  const text = readDesign('design')
    .replace(/^PR .*$/m, 'PR -5 150 0 80 20')
    .replace(/^M .*$/m, 'M 20 40 90 1 0 0 1.5 0')
    .replace(/^PU .*$/m, 'PU 80 80 30 0 30 0');
  const d = parseDesignText(text);
  expect(d.crawlers.random.genes).toMatchObject({ straightSingleSpawn: 0, straightDoubleSpawn: 100 });
  expect([d.rooms.aspectRatio, d.tunnelers.anteroomGenerationSpeedUp, d.tunnelers.lastChance.generationDelay]).toEqual([0.6, 1, 1]);
});

test('dropped like AcceptDesign: inconsistent WS, inconsistent WP2 pair, inverted R', () => {
  const base = vendorConfig('design5');
  const text = `${readDesign('design5')}
WS 50 50 NO SO 0 20 0 3 1 1 0 30 0 60 40
WP1 50 50 NO NO 0 20 0 3 2 7 0 30 0 50 40
WP2 50 50 NO SO 0 20 0 3 2 7 0 30 0 50 40
R 10 10 5 5 OPEN
`;
  const d = parseDesignText(text);
  expect([d.crawlers.seeds?.length, d.crawlers.pairs?.length, d.rectangles?.length]).toEqual([base.crawlers.seeds?.length, base.crawlers.pairs?.length, base.rectangles?.length]);
});

test('missing records', () => {
  expect(rejected('D 50 50 CLOSED 12 18\nXX\n')).toEqual(expect.arrayContaining(['missing BC record', 'missing T record', 'missing PU record']));
  expect(rejected(dropRecord(readDesign('design'), 'T'))).toEqual(['missing T record']);
});
```

`rejected(text)` ist ein lokaler Helfer, der `parseDesignText` aufruft, einen `DesignValidationError` erwartet und `issues.map((i) => i.message)` zurückgibt. Weitere Fehlerfälle als `test.each` mit Text und Regex auf die einzige Meldung (alle Issues mit `path: ''`):

| Eingabe | Meldung |
|---|---|
| `${design}\nBC 0 0 50 0 50 0 0 0 0 0 0\n` | `/^line \d+: duplicate BC record/` |
| `${design}\nQ 1 2\n` | `/^line \d+: unknown record "Q"/` |
| `X comment\n${design}` | `/^line 1: .*XX/` |
| `dropRecord(design,'S') + '\nS 3 3\n'` | `/^line \d+: S record is incomplete/` |
| `design` mit `N 0 -1 2 0 1 0` | `/^line \d+: .*0 or 1/` |
| `${design5}\nWS 103 70 NO NO 0 40 8 3 2 1 0 30 0 60 40\n` | `/^line \d+: .*0 or 1/` |
| `${design5}\nWP1 15 70 EA EA 0 20 0 3 2 7 0 30 0 50 40\nXX\nWP2 15 70 WE WE 0 20 0 3 2 7 0 30 0 50 40\n` | `/^line \d+: WP1 must be followed by WP2/` |
| `${design}\nU 40 2 NE NE 0 16 0 5 1 25 50 30 100 100 100\n` | `/^line \d+: .*direction/` |
| `${design}\nR 1 2 3 x OPEN\n` | `/^line \d+: expected an integer/` |
| `${design}\nR 1 2 2147483648 4 OPEN\n` | `/^line \d+: expected an integer/` |
| `design` mit `GS 100 0 0 50 40 0 0 0 100` | `/^line \d+: .*100/` |

- [ ] **Step 3: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/parse.test.ts`
Expected: FAIL, `parseDesignText` fehlt.

- [ ] **Step 4: `parseDesignText(text: string): DesignConfig` in `src/config/parse.ts` implementieren**

Ein Token-Cursor mit `next()`, `int()`, `number()`, `direction()` usw., je Record eine Lesefunktion. Fehler werfen sofort `new DesignValidationError([{ path: '', message: \`line ${n}: …\` }])`; die Pflicht-Record-Prüfung am Ende sammelt alle fehlenden. Koordinaten und Kartengröße ausschließlich über `axes.ts`.

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/parse.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dungeonmaker-js/src/config/parse.ts packages/dungeonmaker-js/test/helpers.ts packages/dungeonmaker-js/test/parse.test.ts
git commit -m "feat(config): parseDesignText with AcceptDesign semantics"
```

---

### Task 3: `toDesignText` und byte-genauer Round-Trip

**Files:**
- Create: `packages/dungeonmaker-js/src/config/serialize.ts`
- Test: `packages/dungeonmaker-js/test/roundtrip.test.ts`

**Interfaces:**
- Consumes: Task 1 (`tokens.ts`, `axes.ts`, Typen), Task 2 (`parseDesignText`, `vendorConfig`, `reflow`), `loadCore` aus `src/core.ts`, `DESIGNS`, `SEEDS`, `golden`, `fnv1a32`, `cellAt`, `dropRecord`, `readDesign` aus `test/helpers.ts`.
- Produces: `toDesignText(config: DesignConfig): string`. Task 4 schaltet `checkDesign` davor.

- [ ] **Step 1: Failing Tests schreiben**

```ts
let core: DungeonMakerCore;
beforeAll(async () => { core = await loadCore(); });
const hash = (text: string, seed = 42) => fnv1a32(core.generate(text, seed).cells);

describe.each(DESIGNS)('%s', (name) => {
  test.each(SEEDS)('seed %i: JSON round trip matches the native golden hash', (seed) => {
    expect(hash(toDesignText(vendorConfig(name)), seed)).toBe(golden[`${name}:${seed}`]);
  });
  test('parse after toDesignText is idempotent', () => {
    expect(parseDesignText(toDesignText(vendorConfig(name)))).toEqual(vendorConfig(name));
  });
});

test.each(['F', 'GB', 'GS', 'K', 'U'])('design2 without %s: empty list equals a missing record', (tag) => {
  const d = parseDesignText(dropRecord(readDesign('design2'), tag));
  expect(hash(toDesignText(d))).toBe(golden[`design2[-${tag}]:42`]);
});

test('reflowed legacy text generates the golden dungeon', () => {
  expect(hash(reflow(readDesign('design5')))).toBe(golden['design5:42']);
});

test('crawlers AcceptDesign ignores stay ignored', () => {
  const text = `${readDesign('design5')}
WS 50 50 NO SO 0 20 0 3 1 1 0 30 0 60 40
WP1 50 50 NO NO 0 20 0 3 2 7 0 30 0 50 40
WP2 50 50 NO SO 0 20 0 3 2 7 0 30 0 50 40
`;
  expect(hash(toDesignText(parseDesignText(text)))).toBe(hash(text));
});

test('canonical layout', () => {
  const text = toDesignText(vendorConfig('design'));
  expect(text.split('\n').slice(0, 3)).toEqual(['XX generated by dungeonmaker-js', 'D 80 200 CLOSED 12 18 WE', 'XX']);
  expect(text).toMatch(/^S 3 3 3 3 3 3 0$/m);
  expect(text).toMatch(/^F 20 20 50 0 0 100$/m);
  expect(text).toMatch(/^GB 100 0 0 50 50 0 0 30 70 0 0 100$/m);
  expect(text).toMatch(/^N 0 -1 0 0 0 0$/m);
  expect(text).toMatch(/^K 0 99$/m);
  expect(text.endsWith('\n')).toBe(true);
});

test('aspectRatio keeps its exact value', () => {
  const base = vendorConfig('design');
  const text = toDesignText({ ...base, rooms: { ...base.rooms, aspectRatio: 1 / 3 } });
  expect(text).toMatch(/^M 20 40 90 1 0 0 0\.3333333333333333 2$/m);
  const handWritten = readDesign('design').replace(/^(M(?:\s+\S+){6}\s+)0\.6/m, '$10.3333333333333333');
  expect(hash(text)).toBe(hash(handWritten));
});

test('rectangles land in screen coordinates on a non-square map', () => {
  const d = vendorConfig('designEmpty');
  d.map.width = 120;
  d.map.height = 60;
  d.rectangles = [{ from: { x: 100, y: 10 }, to: { x: 109, y: 14 }, cell: 'guaranteedClosed' }];
  const r = core.generate(toDesignText(d), 42);
  expect([r.width, r.height]).toEqual([120, 60]);
  for (let y = 10; y <= 14; y++) for (let x = 100; x <= 109; x++) expect(cellAt(r, x, y)).toBe(Cell.GuaranteedClosed);
});

test('a design without population omits E/H/I', () => {
  const { population: _, ...rest } = vendorConfig('design');
  expect(toDesignText(rest)).not.toMatch(/^(E1|E2|H1|H2|I1|I2) /m);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/roundtrip.test.ts`
Expected: FAIL, `toDesignText` fehlt.

- [ ] **Step 3: `toDesignText(config: DesignConfig): string` in `src/config/serialize.ts` implementieren**

Ausgabe exakt nach »Kanonischer Designtext«. Jeder ausgegebene Wert läuft durch kleine Emit-Helfer, die den JSON-Pfad kennen: `int(path, v)` (Ganzzahl im `int32`-Bereich), `num(path, v)` (endlich), `bool(path, v)`, `token(path, v, table)` (Startrichtungen nur über die vier Kardinal-Tokens, Crawler-`intendedDirection` über `DIRECTION_TOKENS` plus `'any'` → `XX`, Tunneler-`intendedDirection` ohne `'any'`), `list(path, v, terminator)` (Array, kein Element gleich dem Terminator, bei `E/H/I` kein negatives Element) und `triples(path, v)` (`large ≠ 100`). Verstöße sammeln sie als `DesignIssue`; am Ende wirft `toDesignText` einen `DesignValidationError` mit allen Issues, sonst gibt es den Text zurück. Ein `TypeError` während des Durchlaufs (fehlendes Teilobjekt) wird zu `DesignValidationError([{ path: '', message: 'not a DesignConfig: <message>' }])`.

- [ ] **Step 4: Tests laufen lassen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/roundtrip.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS, 55 Golden-Vergleiche plus 5 Varianten grün.

- [ ] **Step 5: Commit**

```bash
git add packages/dungeonmaker-js/src/config/serialize.ts packages/dungeonmaker-js/test/roundtrip.test.ts
git commit -m "feat(config): toDesignText with byte-exact round trip against native goldens"
```

---

### Task 4: Semantische Prüfung und kaputte Fixtures

**Files:**
- Create: `packages/dungeonmaker-js/src/config/check.ts`, `packages/dungeonmaker-js/test/fixtures/broken-designs.ts`
- Modify: `packages/dungeonmaker-js/src/config/serialize.ts`
- Test: `packages/dungeonmaker-js/test/check.test.ts`

**Interfaces:**
- Consumes: Task 3 (`toDesignText`), Task 2 (`vendorConfig`), `DIRECTIONS`/`CARDINAL_DIRECTIONS` aus Task 1.
- Produces: `checkDesign(config: DesignConfig): DesignIssue[]` (intern, nicht exportiert aus einem Entry). `toDesignText` ruft es nach einem fehlerfreien Emit-Durchlauf auf und wirft bei Issues. Fixtures: `interface BrokenDesign { name: string; stage: 'check' | 'schema'; path?: string; mutate(d: DesignConfig): void }`, `BROKEN_DESIGNS: readonly BrokenDesign[]` (angewandt auf eine frische Kopie von `vendorConfig('design5')`, 140 × 140).

Regeln von `checkDesign` (Pfad in Klammern):

1. `map.width`/`map.height` in 3…4096 (`/map/width`, `/map/height`).
2. `spawnDelay.*` genau 11 Einträge und Summe 100 (`/spawnDelay/<key>`).
3. Pflichtlisten nicht leer: `crawlers.stepLength`, `.corridorWidth`, `.maxAge`, `tunnelers.maxAge`, `.joinPreference`, `.sizeUpProbability`, `.sizeDownProbability` (Pfad der Liste).
4. Für jede Generation `g < max(len(sizeUp), len(sizeDown))`: `sizeUp[min(g, last)] + sizeDown[min(g, last)] ≤ 100` (`/tunnelers/sizeUpProbability/<g>`).
5. `GS`/`GB`-Einträge: nicht negativ, Summe 100 (`/rooms/sizeProbability/<sideways|branching>/<i>`).
6. Rechtecke: `0 ≤ from ≤ to` je Achse und `to.x < width`, `to.y < height` (`/rectangles/<i>`).
7. Positionen von Crawler-Seeds, beiden Paar-Mitgliedern und Tunneler-Seeds innerhalb der Karte (`…/location`).
8. Crawler (Seeds und Paar-Mitglieder): `intendedDirection` ist `'any'` oder mit `direction` verträglich nach der Tabelle aus `Config::ValidateDirections` (`…/intendedDirection`). Ziel `N` erlaubt Start `W NW N NE E`, `E` erlaubt `N NE E SE S`, `S` erlaubt `W SW S SE E`, `W` erlaubt `N NW W SW S`, `NW` erlaubt `N W`, `SW` erlaubt `S W`, `NE` erlaubt `N E`, `SE` erlaubt `S E`.

- [ ] **Step 1: Fixtures schreiben**

`stage: 'check'` heißt: `toDesignText` wirft mit diesem Pfad. `stage: 'schema'` heißt: nur `validateDesign` (Task 5) meldet ihn, für die Generierung ist der Wert unschädlich. Kein `path` heißt: nur der Fehlertyp wird geprüft.

| name | stage | mutate | path |
|---|---|---|---|
| map too wide | check | `map.width = 5000` | `/map/width` |
| width not a number | check | `map.width = 'wide'` | `/map/width` |
| unknown background | check | `map.background = 'lava'` | `/map/background` |
| spawn delay too short | check | `spawnDelay.crawler = [100, 0, 0, 0, 0, 0, 0, 0, 0, 0]` | `/spawnDelay/crawler` |
| spawn delay sum | check | `spawnDelay.roomie = [90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]` | `/spawnDelay/roomie` |
| corridor width terminator | check | `crawlers.corridorWidth = [15, 0, 7]` | `/crawlers/corridorWidth/1` |
| join preference terminator | check | `tunnelers.joinPreference = [0, -1, 5]` | `/tunnelers/joinPreference/1` |
| random crawler terminator | check | `crawlers.random.perThousandWallSquares = [0, 99]` | `/crawlers/random/perThousandWallSquares/1` |
| anteroom terminator | check | `tunnelers.anteroomProbability = [20, 100, 0]` | `/tunnelers/anteroomProbability/1` |
| room size sum | check | `rooms.sizeProbability.sideways[0] = { small: 50, medium: 0, large: 0 }` | `/rooms/sizeProbability/sideways/0` |
| size up plus down | check | `tunnelers.sizeUpProbability = [60]; tunnelers.sizeDownProbability = [50]` | `/tunnelers/sizeUpProbability/0` |
| rectangle outside | check | `rectangles[0].to.x = 140` | `/rectangles/0` |
| crawler outside | check | `crawlers.seeds[0].location = { x: 500, y: 500 }` | `/crawlers/seeds/0/location` |
| diagonal start | check | `crawlers.seeds[0].direction = 'NE'` | `/crawlers/seeds/0/direction` |
| inconsistent directions | check | `crawlers.seeds[0].direction = 'N'; crawlers.seeds[0].intendedDirection = 'S'` | `/crawlers/seeds/0/intendedDirection` |
| tunneler outside | check | `tunnelers.seeds[0].location = { x: 50, y: 140 }` | `/tunnelers/seeds/0/location` |
| missing rooms | check | `delete d.rooms` | — |
| noHeading above 100 | schema | `behaviour.noHeadingProbability = 150` | `/behaviour/noHeadingProbability` |
| aspect ratio 1.5 | schema | `rooms.aspectRatio = 1.5` | `/rooms/aspectRatio` |
| negative gene | schema | `crawlers.random.genes.changeDirection = -5` | `/crawlers/random/genes/changeDirection` |
| typo | schema | `(d.map as Record<string, unknown>).widht = 120` | `/map/widht` |

Wo eine Mutation den Typ verletzt, castet sie lokal (`(d.map as { width: unknown }).width = 'wide'`).

- [ ] **Step 2: Failing Tests schreiben**

```ts
test.each(DESIGNS)('%s satisfies all semantic rules', (name) => {
  expect(checkDesign(vendorConfig(name))).toEqual([]);
});

test.each(BROKEN_DESIGNS.filter((b) => b.stage === 'check'))('$name: toDesignText rejects, never throws anything else', (broken) => {
  const d = structuredClone(vendorConfig('design5'));
  broken.mutate(d);
  const e = caught(() => toDesignText(d));
  expect(e).toBeInstanceOf(DesignValidationError);
  if (broken.path !== undefined) expect((e as DesignValidationError).issues.map((i) => i.path)).toContain(broken.path);
});

test.each([null, undefined, 42, 'design', {}, { map: {} }])('garbage %j is a DesignValidationError', (value) => {
  expect(caught(() => toDesignText(value as unknown as DesignConfig))).toBeInstanceOf(DesignValidationError);
});

test('size up/down rule follows the repeated last value', () => {
  const d = vendorConfig('design');
  d.tunnelers.sizeUpProbability = [0, 50];
  d.tunnelers.sizeDownProbability = [0, 0, 60];
  expect(checkDesign(d).map((i) => i.path)).toEqual(['/tunnelers/sizeUpProbability/2']);
});
```

`caught` wie in `test/core-errors.test.ts` (in `test/helpers.ts` verschieben und von dort importieren).

- [ ] **Step 3: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/check.test.ts`
Expected: FAIL, `checkDesign` fehlt; die Terminator-Fixtures bestehen bereits über die Emit-Helfer aus Task 3.

- [ ] **Step 4: `checkDesign(config: DesignConfig): DesignIssue[]` in `src/config/check.ts` implementieren und in `toDesignText` einhängen**

Reihenfolge in `toDesignText`: Emit-Durchlauf (Typ- und Terminator-Issues) → bei Issues werfen → `checkDesign` → bei Issues werfen → Text zurückgeben. `checkDesign` meldet alle Verstöße, nicht nur den ersten.

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm vitest run packages/dungeonmaker-js/test && pnpm typecheck && pnpm lint`
Expected: PASS, inklusive Round-Trip aus Task 3.

- [ ] **Step 6: Commit**

```bash
git add packages/dungeonmaker-js/src/config packages/dungeonmaker-js/test
git commit -m "feat(config): semantic design checks with JSON pointer issues"
```

---

### Task 5: `validateDesign`, Entry `./schema` und `design.schema.json`

**Files:**
- Create: `packages/dungeonmaker-js/src/schema/validate.ts`, `src/schema.ts`, `scripts/generate-design-artifacts.mjs`, `packages/dungeonmaker-js/design.schema.json` (generiert)
- Modify: `packages/dungeonmaker-js/package.json` (Script `generate`)
- Test: `packages/dungeonmaker-js/test/validate.test.ts`

**Interfaces:**
- Consumes: `DesignConfigSchema` (Task 1), `checkDesign` (Task 4), `BROKEN_DESIGNS` (Task 4), `Value` aus `typebox/value`.
- Produces: `validateDesign(value: unknown): DesignIssue[]`; Entry `src/schema.ts` exportiert `validateDesign`, `DesignConfigSchema`, `DESIGN_SCHEMA_ID` und `type DesignConfig`. Script `scripts/generate-design-artifacts.mjs` (in Task 6 um Presets erweitert); Package-Script `"generate": "pnpm run build && node ../../scripts/generate-design-artifacts.mjs"`.

Verhalten von `validateDesign`: erst `Value.Errors(DesignConfigSchema, value)`; gibt es strukturelle Fehler, nur diese zurückgeben, sonst `checkDesign(value)`. Abbildung der TypeBox-Fehler: höchstens ein Issue pro Pfad (das erste); `required` → Pfad der fehlenden Property, Meldung `missing required property`; eine überzählige Property → ihr Pfad (`/map/widht`), Meldung `unknown property`; sonst `instancePath` und `message` von TypeBox.

- [ ] **Step 1: Failing Tests schreiben**

```ts
test.each(DESIGNS)('%s is valid', (name) => expect(validateDesign(vendorConfig(name))).toEqual([]));

test('$schema is allowed at the root', () => {
  expect(validateDesign({ ...vendorConfig('design'), $schema: DESIGN_SCHEMA_ID })).toEqual([]);
});

test.each(BROKEN_DESIGNS)('$name is rejected', (broken) => {
  const d = structuredClone(vendorConfig('design5'));
  broken.mutate(d);
  const issues = validateDesign(d);
  expect(issues.length).toBeGreaterThan(0);
  if (broken.path !== undefined) expect(issues.map((i) => i.path)).toContain(broken.path);
});

test('missing object and non-objects', () => {
  const { rooms: _, ...noRooms } = vendorConfig('design');
  expect(validateDesign(noRooms)).toEqual([{ path: '/rooms', message: 'missing required property' }]);
  expect(validateDesign('design')[0]?.path).toBe('');
});

test('one issue per path', () => {
  const d = structuredClone(vendorConfig('design')) as unknown as { map: { background: string } };
  d.map.background = 'lava';
  expect(validateDesign(d).filter((i) => i.path === '/map/background')).toHaveLength(1);
});

test('design.schema.json is generated from the model', () => {
  const file = JSON.parse(readFileSync(new URL('../design.schema.json', import.meta.url), 'utf8'));
  expect(file).toEqual(JSON.parse(JSON.stringify(DesignConfigSchema)));
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/validate.test.ts`
Expected: FAIL, `validateDesign` und `design.schema.json` fehlen.

- [ ] **Step 3: `validateDesign` und `src/schema.ts` implementieren**

- [ ] **Step 4: Generator-Script schreiben und ausführen**

`scripts/generate-design-artifacts.mjs` (SPDX-Header) importiert `DesignConfigSchema` aus `packages/dungeonmaker-js/dist/schema.js`, schreibt `JSON.stringify(schema, null, 2) + '\n'` nach `packages/dungeonmaker-js/design.schema.json` und formatiert alle geschriebenen Dateien mit `pnpm exec biome format --write <files>`.

Run: `pnpm --filter dungeonmaker-js generate && git status --porcelain packages/dungeonmaker-js/design.schema.json`
Expected: `?? packages/dungeonmaker-js/design.schema.json`; ein zweiter Lauf ändert die Datei nicht mehr.

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm vitest run packages/dungeonmaker-js/test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dungeonmaker-js/src/schema packages/dungeonmaker-js/src/schema.ts packages/dungeonmaker-js/design.schema.json packages/dungeonmaker-js/package.json packages/dungeonmaker-js/test/validate.test.ts scripts/generate-design-artifacts.mjs
git commit -m "feat(schema): validateDesign and generated design.schema.json"
```

---

### Task 6: Presets und `extendDesign`

**Files:**
- Create: `packages/dungeonmaker-js/src/presets/<name>.ts` (11, generiert), `src/presets.ts`, `src/config/extend.ts`
- Modify: `scripts/generate-design-artifacts.mjs`
- Test: `packages/dungeonmaker-js/test/presets.test.ts`, `test/extend.test.ts`

**Interfaces:**
- Consumes: `parseDesignText` (Task 2), `toDesignText` (Task 3), `validateDesign` (Task 5), Generator aus Task 5.
- Produces: Named Exports `design`, `design2`, `design3A`, `design3WithTunnelers`, `design4A`, `design5`, `design6`, `design7`, `designEmpty`, `designEmpty2`, `designOld1` (je `DesignConfig`) aus `src/presets.ts`; `type DesignPatch` (rekursiv partiell, Arrays werden als Ganzes ersetzt) und `extendDesign(base: DesignConfig, patch: DesignPatch): DesignConfig` aus `src/config/extend.ts`.

Kopf jeder Preset-Datei:

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// Generated by scripts/generate-design-artifacts.mjs from native/vendor/dungeonmaker-2.05/<name>
// (DungeonMaker 2.05 sample design, © Peter Henningsen). Do not edit by hand.
import type { DesignConfig } from '../schema/model.js';

export const <name>: DesignConfig = { … };
```

- [ ] **Step 1: Failing Tests schreiben**

`test/presets.test.ts`:

```ts
import * as presets from '../src/presets.js';

test('one preset per vendor design', () => expect(Object.keys(presets).sort()).toEqual([...DESIGNS].sort()));
test.each(DESIGNS)('%s matches its vendor file', (name) => expect(presets[name]).toEqual(vendorConfig(name)));
test.each(DESIGNS)('%s is schema-valid', (name) => expect(validateDesign(presets[name])).toEqual([]));
test('design3A generates the golden dungeon', async () => {
  const core = await loadCore();
  expect(fnv1a32(core.generate(toDesignText(presets.design3A), 42).cells)).toBe(golden['design3A:42']);
});
```

`test/extend.test.ts`:

```ts
test('deep merge, arrays replace', () => {
  const d = extendDesign(design5, { map: { width: 120 }, crawlers: { corridorWidth: [3] } });
  expect([d.map.width, d.map.height]).toEqual([120, 140]);
  expect(d.crawlers.corridorWidth).toEqual([3]);
  expect(d.crawlers.stepLength).toEqual([4]);
});
test('undefined in a patch keeps the base value', () => {
  expect(extendDesign(design5, { map: { width: undefined } }).map.width).toBe(140);
});
test('result shares nothing with base or patch', () => {
  const patch = { crawlers: { corridorWidth: [3] } };
  const d = extendDesign(design5, patch);
  d.crawlers.stepLength.push(9);
  if (d.rectangles?.[0]) d.rectangles[0].from.x = 0;
  patch.crawlers.corridorWidth.push(1);
  expect(design5.crawlers.stepLength).toEqual([4]);
  expect(design5.rectangles?.[0]?.from.x).toBe(1);
  expect(d.crawlers.corridorWidth).toEqual([3]);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `pnpm vitest run packages/dungeonmaker-js/test/presets.test.ts packages/dungeonmaker-js/test/extend.test.ts`
Expected: FAIL, Module fehlen.

- [ ] **Step 3: `extendDesign` implementieren**

`structuredClone(base)`, dann rekursiv: Plain Objects werden gemergt, Arrays und Primitive aus dem Patch ersetzen (Arrays per `structuredClone`), `undefined` wird übersprungen. Die Funktion validiert nicht; das erledigt `toDesignText`.

- [ ] **Step 4: Generator erweitern und Presets erzeugen**

Der Generator importiert zusätzlich `parseDesignText` aus `packages/dungeonmaker-js/dist/config/parse.js` (der Entry `.` entsteht erst in Task 7). Er liest jede der elf Vendor-Dateien, schreibt `src/presets/<name>.ts` mit dem Kopf oben und `JSON.stringify(config, null, 2)` als Wert und formatiert mit Biome. Erst danach `src/presets.ts` mit elf Re-Exports anlegen (der Build braucht die Dateien).

Run: `pnpm --filter dungeonmaker-js generate`
Expected: elf neue Dateien unter `src/presets/`, `design.schema.json` unverändert; ein zweiter Lauf erzeugt keinen Diff.

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm vitest run packages/dungeonmaker-js/test && pnpm typecheck && pnpm lint`
Expected: PASS (`pnpm lint` umfasst die SPDX-Prüfung der generierten Dateien).

- [ ] **Step 6: Commit**

```bash
git add packages/dungeonmaker-js/src/presets packages/dungeonmaker-js/src/presets.ts packages/dungeonmaker-js/src/config/extend.ts packages/dungeonmaker-js/test/presets.test.ts packages/dungeonmaker-js/test/extend.test.ts scripts/generate-design-artifacts.mjs
git commit -m "feat(presets): the eleven upstream designs as JSON presets, extendDesign"
```

---

### Task 7: Öffentliche Entries, Packaging und Doku

**Files:**
- Create: `packages/dungeonmaker-js/src/index.ts`
- Modify: `packages/dungeonmaker-js/package.json`, `package.json` (root), `scripts/pack-smoke.mjs`, `packages/dungeonmaker-js/README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: alles aus Task 1–6.
- Produces: Entry `.` mit `Cell`, `DesignValidationError`, `GenerationError`, `type DesignIssue`, `parseDesignText`, `toDesignText`, `extendDesign`, `type DesignPatch`, den Typen `Direction`, `CardinalDirection`, `CellName` (aus `./config/tokens.js`) und `DesignConfig`, `Point`, `Genes`, `CrawlerSeed`, `CrawlerPairMember`, `TunnelerSeed`, `TunnelerGenes`, `RoomSizeProbability`, `Population`, `Rectangle` (aus `./schema/model.js`), alle Typen per `export type`. Phase 3 ergänzt hier den Client.

- [ ] **Step 1: `src/index.ts` anlegen**

Nur Re-Exports. Modell-Typen ausschließlich per `export type … from './schema/model.js'`, damit `dist/index.js` keinen Import von `typebox` enthält.

- [ ] **Step 2: Package-Metadaten**

`exports` in `packages/dungeonmaker-js/package.json` (Reihenfolge wie unten, `./core`, `./dungeonmaker.wasm`, `./package.json` bleiben):

```jsonc
".":                    { "types": "./dist/index.d.ts",   "default": "./dist/index.js" },
"./schema":             { "types": "./dist/schema.d.ts",  "default": "./dist/schema.js" },
"./presets":            { "types": "./dist/presets.d.ts", "default": "./dist/presets.js" },
"./design.schema.json": "./design.schema.json",
```

`files` um `"design.schema.json"` ergänzen. In der Root-`package.json` hängt `check:package` an `--exclude-entrypoints ./dungeonmaker.wasm` zusätzlich `./design.schema.json` an.

- [ ] **Step 3: Pack-Smoke erweitern**

`scripts/pack-smoke.mjs`: Das Smoke-Modul importiert zusätzlich `toDesignText` aus `dungeonmaker-js`, `design3A` aus `dungeonmaker-js/presets` und `validateDesign` aus `dungeonmaker-js/schema`. Es verlangt `validateDesign(design3A).length === 0`, denselben Hash `99cc67de` für `core.generate(toDesignText(design3A), 42)` wie für den Vendor-Text, und dass `import.meta.resolve('dungeonmaker-js/design.schema.json')` auf eine Datei zeigt, deren `$id` `https://unpkg.com/dungeonmaker-js/design.schema.json` ist.

- [ ] **Step 4: Bundle-Grenze prüfen**

Run: `pnpm build && grep -lE "from ['\"]typebox" packages/dungeonmaker-js/dist/index.js packages/dungeonmaker-js/dist/config/*.js packages/dungeonmaker-js/dist/presets.js packages/dungeonmaker-js/dist/presets/*.js; echo "exit $?"`
Expected: keine Dateiliste, `exit 1` (nur `dist/schema*` darf `typebox` importieren).

- [ ] **Step 5: README und CLAUDE.md**

README (Englisch): Status-Hinweis auf »0.x: core, JSON designs, presets, schema«; ein zweites Beispiel mit `import * as presets from 'dungeonmaker-js/presets'`, `extendDesign`, `toDesignText` und `loadCore`; ein Satz zu `$schema: "https://unpkg.com/dungeonmaker-js/design.schema.json"` für Editor-Autocomplete und zu `parseDesignText` für alte Designdateien. `CLAUDE.md`: Status-Absatz auf Phase 2 (Plan-Pfad dieses Dokuments, neue Entries), Layout um `src/config/`, `src/schema/`, `src/presets/` und den Generator ergänzen, Hinweis auf `pnpm --filter dungeonmaker-js generate` unter »Commands«.

- [ ] **Step 6: Vollständige Verifikation**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm size && pnpm check:package && pnpm pack:smoke`
Expected: alles grün, `pack smoke ok: 99cc67de`. `git diff --exit-code -- packages/dungeonmaker-js/wasm packages/dungeonmaker-js/test/golden native` meldet nichts.

- [ ] **Step 7: Commit**

```bash
git add packages/dungeonmaker-js/src/index.ts packages/dungeonmaker-js/package.json package.json scripts/pack-smoke.mjs packages/dungeonmaker-js/README.md CLAUDE.md
git commit -m "feat: main entry with design config API, schema and presets exports"
```

**M2 erreicht, wenn:** alle elf Legacy-Designs × 5 Seeds den byte-genauen Round-Trip bestehen, `validateDesign` alle Presets akzeptiert und jede Fixture aus `BROKEN_DESIGNS` mit JSON-Pfad ablehnt, und das gepackte Tarball die neuen Entries in einem leeren Projekt bedient.
