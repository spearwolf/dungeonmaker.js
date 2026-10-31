# dungeonmaker-js Phase 4 (Layer, Export & Node-CLI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pnpm dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj` erzeugt in einem leeren Verzeichnis reproduzierbar dieselben Dateien wie der Exporter im Browser. Dazu kommen die Opt-in-Layer `rooms`, `entities` und `steps`, der Entry `render` und der Entry `export`.

**Architecture:** Die Bridge bekommt Ausgabe-Flags und liefert Räume, Entities (`PlonkDownStuff`) und den Bauverlauf (Movie) als flache Tabellen. `core` macht daraus typisierte Layer, Worker und Client reichen sie per Transfer durch. `render` (ASCII, Tiles, RGBA, Canvas) und `export` (Dungeon-JSON, PNG, Tiled, ASCII, Raw) sind reine, plattformneutrale Funktionen auf einem `Dungeon`. Der Entry `node` und die CLI setzen auf `core` + `export` + `node:fs` auf. CLI und Browser benutzen dieselben Exporter, darum sind ihre Dateien byte-gleich.

**Tech Stack:** C++17/Emscripten (gepinnter Container), TypeScript 7 (`tsc`-Emit, ESM only, ES2022), TypeBox (nur Schema-Entry und Generator), Vitest 5 (Node + Browser Mode), Biome 2, pnpm 12, Node 26. Laufzeit-Dependencies kommen keine dazu.

**Spec:** `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md`. Phase 4 steht in §10; verwendet werden außerdem Layer §7.2, Konverter §7.3, Export §7.4, CLI §7.5, Package §8.3, Lizenzregeln für Exportdateien §9.4 und Determinismus §5.3. Vorgänger: `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-3.md`.

## Global Constraints

- **Branch und Version:** Gearbeitet wird auf dem Branch `phase-4-layers-export-cli` von `master`. Die Version wird nicht erhöht, und in dieser Phase wird nichts veröffentlicht.
- **Determinismus-Vertrag:** Ohne angeforderte Layer bleiben die Zellen byte-identisch. In `test/golden/native-fnv.json` kommen nur **neue** Schlüssel dazu; `git diff` zeigt dort ausschließlich hinzugefügte Zeilen. Auch angeforderte Layer `rooms`, `entities: 'list'` und `steps` ändern die Zellen nicht; nur `entities: 'baked'` ändert sie.
- **Native-Code:**
  - `native/vendor/` bleibt byte-gleich; jede Änderung am Upstream-Code ist ein Patch unter `native/patches/` mit Header nach `native/patches/README.md`.
  - Native-Änderungen werden zusammen mit dem neu gebauten `wasm/` committet (`sh native/build.sh`).
  - `sh native/test/run.sh` muss mit GCC **und** clang grün sein. Neuer Code, der `rand()` mehrfach als Argumente eines Aufrufs zieht, zieht zuerst in lokale Variablen.
- **Bundler-Regeln** (gelten für alles unter `src/` außer `src/node/` und `*.d.ts`, plus das Glue):
  - Jedes `import('node:…')` trägt `/* webpackIgnore: true */ /* @vite-ignore */`.
  - Statische `node:`-Imports sind verboten.
  - Kein `new URL(<nicht-literal>, import.meta.url)`.
  - Kein Top-Level-`await` in Modulen, die der Worker lädt.
  - `src/node/` ist ausgenommen, weil `./node` nur die Export-Condition `node` hat (§8.3).
- **TypeBox-Runtime:** nur in `src/schema/`, in `src/schema.ts` und in `src/node/` (CLI `validate`). Alle anderen Module importieren daraus nur mit `import type`.
- **Öffentliche `.d.ts` ohne DOM-Lib:** Das gilt für `dungeonmaker-js`, `/core`, `/export` und `/node`; `pack:smoke` prüft es ohne DOM-Lib und ohne `@types`. Ausnahme ist `/render`: `toImageData`/`drawToCanvas` nennen `ImageData`/`HTMLCanvasElement`, und das README sagt das.
- **Exportdateien (§9.4):**
  - Sie enthalten nur Daten: Karte, Layer, Metadaten und Legende.
  - Upstream-Presets erscheinen nur als `{ "preset": "<name>" }`, auch mit `--embed-design`.
  - Eigene Designs stehen nur als Hash in der Datei, außer bei `embed`.
  - `dungeon.schema.json` steht unter CC0-1.0, alle anderen eigenen Dateien unter GPL-3.0-or-later.
- **CLI:**
  - Exit-Codes: `0` = Erfolg; `1` = Design-, Validierungs-, Generierungs- oder Dateifehler; `2` = Bedienfehler (unbekannter Befehl, fehlende oder widersprüchliche Optionen, ungültige Seeds oder Formate).
  - Zahlenformate: Seeds `1 … 4294967295`, höchstens 10 000 Seeds pro Aufruf.
- **Allgemein:**
  - SPDX-Header `// SPDX-License-Identifier: GPL-3.0-or-later` in den ersten drei Zeilen eigener Quelldateien (`pnpm lint` prüft das).
  - README auf Englisch.
  - Toolchain über `mise x -- …`, wenn `pnpm`/`node` nicht im `PATH` liegen.
  - Verzögerungen in Tests nie über Rechenlast.
  - Designs, die hängen könnten, nur in einem separaten Prozess mit `timeout` proben, nie in Vitest.

## Review Focus

1. **Entities für ein Design ohne `population`** (oder mit lauter Nullen): Erwartet wird `entities: []` und ein unverändertes `cells`, kein Fehler und kein Abort. Test in Task 2.
2. **`steps` für eine große Karte** (`design` auf 1024×1024): Erwartet wird, dass Frame 0 genau `width * height` Einträge hat und das Abspielen aller Frames `cells` ergibt. Die Größenwarnung steht im README. Test in Task 2.
3. **Legacy-Designdatei mit BOM und CRLF** (unter Windows gespeichert): `validate`, `convert` und `generate --design` verhalten sich wie bei derselben Datei mit LF. Test in Task 7.
4. **`--name`-Template ohne `{seed}` bei mehreren Seeds**: Ohne Prüfung würde jede Datei die vorige überschreiben. Erwartet wird Exit-Code 2, bevor irgendetwas generiert oder geschrieben wird. Test in Task 8.
5. **Ungültige Seed-Angaben** (`0..3`, `5..1`, `1..20000`, `abc`, `4294967296`): Erwartet wird Exit-Code 2 mit einer Meldung, die die Eingabe nennt. Nichts wird generiert. Test in Task 7 (Parser) und Task 8 (Exit-Code).

## Festlegungen dieses Plans (zum Gegenlesen vor der Ausführung)

- **`PlonkDownStuff`/`PutPlonkOnMap` sind in 2.05 bereits `public`.** Der in §7.2 angekündigte Sichtbarkeits-Patch entfällt deshalb. Gebraucht wird stattdessen der Patch `0003-deterministic-plonk.patch`, weil:
  - `PlonkDownStuff` `startX` liest, bevor es gesetzt ist. Das kommt zweimal vor, im Abschnitt »MOBs im Offenen« für Labyrinth und Dungeon, und ist undefiniertes Verhalten, das je nach Compiler unterschiedlich ausgeht. Der Fix: `int startX = 1 , startY = 0;`. Damit läuft genau der Zweig, den der Code meint.
  - `SortRooms` `std::sort` nutzt; gleich große Räume landen damit je nach libc++/libstdc++ in anderer Reihenfolge. Der Fix: `std::stable_sort`.

  Beides wirkt nur, wenn Entities angefordert werden. Die Zellen bestehender Aufrufe ändern sich nicht. Die Ziehungsreihenfolge von x/y in `PlonkDownStuff` hat Patch 0001 schon festgelegt.
- **Bridge-ABI:**
  - `dm_generate(text, seed, flags)` bekommt diese Flags: `DM_OUTPUT_ROOMS = 1`, `DM_OUTPUT_ENTITIES_LIST = 2`, `DM_OUTPUT_ENTITIES_BAKED = 4`, `DM_OUTPUT_STEPS = 8`.
  - Neuer Status `3` = ungültige Flags: ein unbekanntes Bit, oder `2|4` zugleich.
  - Die Layer liegen als flache Tabellen vor, in **Bildschirmkoordinaten** (x = Spalte, y = Zeile). Umgerechnet wird nur in der Bridge.
- **Reihenfolge in `dm_generate`:**
  1. parsen
  2. prüfen
  3. ggf. `storeM` setzen
  4. `generate()`
  5. Räume erfassen (vor `PlonkDownStuff`, das `Rooms` umsortiert)
  6. ggf. `PlonkDownStuff()`
  7. bei `baked` `PutPlonkOnMap()`
  8. Zellen kopieren
  9. Entities und Movie kopieren

  Raum-IDs sind `Index + 1` in Erzeugungsreihenfolge; `0` heißt »kein Raum«.
- **Neue Ablehnungen der Bridge** (Status 1 → `DesignValidationError`):
  - `entities` bei einer Karte unter 4×4. Upstream rechnet sonst `rand() % (dim - 3)`, bei 3 also `% 0`.
  - `rooms` bei mehr als 65 535 Räumen, weil die IDs `uint16` sind.
  - `steps` bei einem Design, dessen N-Record `showMovie` und `storeMovie` beide auf 0 hat. Upstream iteriert dann anders, und `steps` würde den Dungeon verändern.
- **Speicher für `steps`:** Ohne das Flag setzt die Bridge `storeM = false`, sofern `showM` gesetzt ist. Das spart den Movie-Speicher; die Zellen bleiben gleich, weil `MakeIteration` nur `showM || storeM` abfragt.
- **Layer-Typen** (TS, Namen aus §7.2):
  - `RoomLayer { roomIds: Uint16Array; rooms: readonly Room[] }` mit `Room { id; area: 'labyrinth' | 'dungeon'; size; bounds: { x; y; width; height } }`.
  - `EntityLayer = readonly Entity[]` mit `Entity { kind: 'mob' | 'treasure'; x; y; level }`. Die Reihenfolge ist: erst alle MOBs, dann alle Schätze, jeweils in Library-Reihenfolge. `level` ist der Index in der `byLevel`-Liste der Population.
  - `StepLayer { offsets: Uint32Array; index: Uint32Array; cell: Uint8Array }`. Frame `k` umfasst `index[offsets[k] … offsets[k+1])`, es gilt `offsets.length = frames + 1`. Frame 0 ist die Startkarte (alle Zellen). `index` ist `y * width + x`.
  - Bei `entities: 'baked'` gibt es kein `entities`-Feld; die MOB- und Schatz-Zellen stehen in `cells`. Die Zuordnung folgt Upstreams `PutPlonkOnMap`: `level < 2` → `Mob1`/`Treasure1`, `< 4` → `Mob2`/`Treasure2`, sonst `Mob3`/`Treasure3`.
- **`OutputOptions`:** Die Form ist `{ rooms?: boolean; entities?: false | 'list' | 'baked'; steps?: boolean }`. Unbekannte Schlüssel oder falsche Werte lösen `TypeError` aus: synchron in `core.generate`, als Rejection in `create()`. Das Protokoll bleibt `v: 1`; `output` und die Layer sind additive, optionale Felder, Worker und Client kommen immer aus demselben Package.
- **Core-Typen ohne DOM (zurückgestellte Entscheidung aus Phase 3):** `LoadCoreOptions.wasmModule` und `DungeonMakerCore.wasmModule` bekommen den neuen exportierten Typ `CompiledWasm = object` statt `WebAssembly.Module`. Damit braucht `dungeonmaker-js/core` keine DOM-Lib mehr, und `pack:smoke` prüft `/core` mit.
- **`render`:**
  - `toAscii` benutzt die Zeichentabelle aus dem alten `toChar()` (Tag `legacy-2014`, `createdungeon.cpp`). Sie ist verlustbehaftet, weil `' '`/`'#'` mehrfach vorkommen.
  - Die Farben von `DEFAULT_PALETTE` stammen aus dem alten `showDungeon`, nach Zellnamen zugeordnet; die Indizes im alten Array waren um eins verschoben.
  - `toTiles` kollabiert auf `Tile = { Floor: 0, Wall: 1, Door: 2, Column: 3, Mob: 4, Treasure: 5 }`.
- **Dungeon-JSON:**
  - `cells.encoding` ist eines von:
    - `base64` (Default)
    - `rows`: verlustfrei, mit eigenem Alphabet `ROWS_ALPHABET` aus 20 Zeichen, das in der Datei steht
    - `array`
  - Mehrbytige Layer werden als Little-Endian-Base64 abgelegt.
  - Die `legend` benutzt die Zellnamen aus `CELL_TOKENS` (`open`, `guaranteedClosed`, …, `column`).
  - `generator` ist `dungeonmaker-js@<version>` aus `src/version.ts`. `build` und der npm-Lifecycle `version` regenerieren die Datei; ein Test vergleicht sie mit `package.json`.
- **PNG:**
  - Farbtyp 3 (indiziert, 8 Bit), `PLTE` mit den 20 Palettenfarben.
  - `IDAT` über `CompressionStream('deflate')`; das ergibt zlib-Format, wie PNG es verlangt.
  - `tEXt`-Chunks `Software` = Generator und `Comment` = `seed=<seed>`.
  - Byte-Gleichheit zwischen Node und den drei Browser-Engines wird getestet. Weicht eine Engine ab, meldet der Implementer `DONE_WITH_CONCERNS` mit Beleg; die Entscheidung trifft dann der Controller.
- **Tiled:**
  - JSON-Map-Format `version: "1.10"`, orthogonal.
  - Kachelebene `cells` mit `gid = cell + 1`.
  - Eingebettetes Tileset `dungeonmaker` mit 20 Kacheln, deren `type` der Zellname ist.
  - Das Tileset-Bild ist `dungeonmaker-tiles.png`, ein PNG-Streifen aus `toTilesetPng`; die CLI schreibt es neben jede `.tmj`.
  - Optional die Objektebenen `rooms` (Rechtecke) und `entities` (Punkte), mit Properties.
  - Ob sich die Datei in Tiled öffnen lässt, prüft der Owner einmal von Hand. Automatisiert sind nur die Pflichtfelder des Formats.
- **Node-API und CLI:**
  - Die CLI-Logik steht in `src/node/commands.ts` (`main(argv, io)`, in-process testbar). `src/node/cli.ts` ist nur der Bin-Starter mit Shebang.
  - Der Default für `--name` ist `{name}-{seed}`. `{name}` ist der Preset-Name, beim `--design` der Dateiname ohne Endungen.
  - Erlaubt sind die Formate `json` (`.dungeon.json`), `png`, `tmj`, `txt` und `bin`.
  - Die PNG-Skalierung ist per Default 1 (ein Pixel pro Zelle), in `toPng` wie in der CLI.
  - Vorhandene Dateien werden überschrieben; die Ausgabe ist reproduzierbar.
- **Größenbudgets:** Wasm- und Client-Budget werden nach dem Messen angehoben, auf den Messwert aufgerundet auf das nächste volle KiB (Wasm) bzw. die nächsten 256 Bytes (Client). Die Begründung steht in der Commit-Message. Phase 3 hatte beim Client nur noch 21 Bytes Luft.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `native/patches/0003-deterministic-plonk.patch` | `startX`-Initialisierung, `stable_sort` in `SortRooms` (Task 1) |
| `native/src/bridge.{h,cpp}` | Flags, Layer-Tabellen, neue Prüfungen (Task 1) |
| `native/build.sh` | neue `EXPORTED_FUNCTIONS` (Task 1) |
| `native/test/bridge_test.cpp`, `native/test/native_hashes.cpp` | Layer-Tests, neue Golden-Schlüssel (Task 1) |
| `packages/dungeonmaker-js/src/layers.ts` | `OutputOptions`, Layer-Typen, `parseOutput`, `outputFlags` (Task 2) |
| `src/core/core.ts`, `src/core/glue.ts`, `src/core.ts` | `generate(text, seed, output?)`, Layer auslesen, `CompiledWasm` (Task 2) |
| `src/protocol.ts`, `src/worker/handler.ts`, `src/dungeon.ts`, `src/client/client.ts`, `src/index.ts` | Layer durchreichen und transferieren (Task 3) |
| `src/render/{ascii,tiles,palette,raster,canvas}.ts`, `src/render.ts` | Entry `dungeonmaker-js/render` (Task 4) |
| `src/version.ts`, `scripts/write-version.mjs` | Generator-Version (Task 5) |
| `src/schema/dungeon-file.ts`, `dungeon.schema.json` | TypeBox-Modell + generiertes Schema der Dungeon-Datei, CC0 (Task 5) |
| `src/export/{base64,dungeon-json,source,text}.ts`, `src/export.ts` | Entry `dungeonmaker-js/export`: JSON, ASCII, Raw, `designSource` (Task 5) |
| `src/export/{png,crc32,tiled}.ts` | PNG-Encoder, Tileset-PNG, Tiled-Map (Task 6) |
| `src/node/{index,seeds,name,design-file,generate}.ts` | Entry `dungeonmaker-js/node` (Task 7) |
| `src/node/{commands,cli}.ts` | CLI (Task 8) |
| `scripts/pack-smoke.mjs` | `pnpm dlx`/`npx`-Smoke, DOM-freie Typen für `/core`, `/export`, `/node` (Task 8) |
| `test/golden/export-sha256.json` | gemeinsame Hashes der Exportdateien für Node-, Browser- und CLI-Tests (Task 5/6/8) |
| `packages/dungeonmaker-js/README.md`, `CLAUDE.md`, `RELEASING.md`, `NOTICE` | Doku (Task 9) |

---

### Task 1: Native — Layer-Flags in der Bridge, deterministisches Plonking

**Files:**
- Create: `native/patches/0003-deterministic-plonk.patch`
- Modify: `native/patches/README.md` (Liste »Current patches«), `native/src/bridge.h`, `native/src/bridge.cpp`, `native/build.sh` (`-sEXPORTED_FUNCTIONS`), `native/test/bridge_test.cpp`, `native/test/native_hashes.cpp`
- Regenerate: `packages/dungeonmaker-js/wasm/*`, `packages/dungeonmaker-js/test/golden/native-fnv.json` (nur neue Schlüssel), `packages/dungeonmaker-js/size-budget.json` (`wasmGzipBytes`)

**Interfaces:**
- Produces (C-ABI, alle in `bridge.h` dokumentiert):
  ```c
  #define DM_OUTPUT_ROOMS          1u
  #define DM_OUTPUT_ENTITIES_LIST  2u
  #define DM_OUTPUT_ENTITIES_BAKED 4u
  #define DM_OUTPUT_STEPS          8u
  /* status 3 = invalid flags (unknown bit, or LIST and BAKED together) */
  uint32_t dm_room_count(void);
  const uint16_t* dm_room_ids(void);      /* width*height; 0 = no room, else creation index + 1 */
  const int32_t* dm_rooms(void);          /* 6 per room: inDungeon, size, minX, minY, maxX, maxY (screen, inclusive) */
  uint32_t dm_entity_count(void);
  const int32_t* dm_entities(void);       /* 4 per entity: kind (0 mob, 1 treasure), x, y, level; mobs first */
  uint32_t dm_step_count(void);           /* frames */
  const uint32_t* dm_step_offsets(void);  /* dm_step_count() + 1 entries */
  const uint32_t* dm_step_indices(void);  /* offsets[count] entries, y*width + x */
  const uint8_t* dm_step_cells(void);     /* offsets[count] entries */
  ```
  Ohne angeforderten Layer liefern die Zähler 0 und die Zeiger `nullptr`. `dm_reset` gibt alle Puffer frei.
- Golden-Schlüssel (neu, je Design aus den elf Vendor-Designs, Seed 42):
  - `"<d>:42+rooms"`: FNV-1a über die Bytes von `dm_room_ids` (LE), dann die Bytes von `dm_rooms`.
  - `"<d>:42+entities"`: FNV-1a über die Bytes von `dm_entities`; leer ergibt `811c9dc5`.
  - `"<d>:42+baked"`: Zellen mit `DM_OUTPUT_ENTITIES_BAKED`.
  - `"<d>:42+steps"`: FNV-1a über Offsets-, dann Indices-, dann Zellen-Bytes.

- [ ] **Step 1: Patch `0003-deterministic-plonk.patch` schreiben.**
  - Header nach `native/patches/README.md`.
  - What: `PlonkDownStuff` initialisiert `startX`/`startY` vor dem ersten Lesen (beide Abschnitte für MOBs im Offenen: `int startX = 1 , startY = 0;`), und `SortRooms` sortiert mit `std::stable_sort`.
  - Why: undefiniertes Verhalten und eine compilerabhängige Reihenfolge gleich großer Räume würden Entities plattformabhängig machen (§5.3, §7.2).
  - Kommentar im Code wie bei 0001: `//patch 0003: …, see native/patches/`.
  - `native/patches/README.md` um den Eintrag ergänzen.

- [ ] **Step 2: Failing native tests in `bridge_test.cpp` schreiben** (Stil wie vorhanden, `CHECK`):
  ```cpp
  const std::string d3 = read_design("design3A");
  CHECK(dm_generate(d3.c_str(), 42, 0) == 0);
  std::vector<uint8_t> plain(dm_cells(), dm_cells() + dm_width() * dm_height());
  for (uint32_t f : {1u, 2u, 8u, 1u | 2u | 8u}) {   // layers that must not change cells
    CHECK(dm_generate(d3.c_str(), 42, f) == 0);
    CHECK(std::equal(plain.begin(), plain.end(), dm_cells()));
  }
  CHECK(dm_generate(d3.c_str(), 42, 2u | 4u) == 3);
  CHECK(dm_generate(d3.c_str(), 42, 16u) == 3);
  CHECK(error_contains("output flags"));
  CHECK(dm_generate(d3.c_str(), 42, 0) == 0);
  CHECK(dm_room_count() == 0 && dm_room_ids() == nullptr && dm_entity_count() == 0 && dm_step_count() == 0);
  CHECK(dm_generate(d3.c_str(), 42, 1u) == 0);
  CHECK(dm_room_count() > 0);
  // every non-zero id is in range and the cell lies inside that room's bounds
  CHECK(dm_generate(d3.c_str(), 42, 8u) == 0);
  CHECK(dm_step_offsets()[0] == 0 && dm_step_offsets()[1] == dm_width() * dm_height());
  // replaying all frames onto a zeroed map yields dm_cells()
  CHECK(dm_generate(with_dimensions(d3, 3, 50).c_str(), 42, 2u) == 1);
  CHECK(error_contains("entities need a map of at least 4x4"));
  CHECK(dm_generate(with_movie_flags(d3, 0, 0).c_str(), 42, 8u) == 1);
  CHECK(error_contains("steps need showMovie or storeMovie"));
  ```
  Dazu gehören:
  - Schleifen für die beiden kommentierten Prüfungen (Bounds, Replay);
  - ein Test, dass Entities-`list` und `baked` dieselben Positionen nutzen und `baked` genau dort andere Zellen hat (Zuordnung `level < 2 / < 4 / sonst`);
  - `with_movie_flags(text, show, store)` in `design_util.h`, das den N-Record ersetzt (dessen Feldreihenfolge steht in `manDesign.txt`).

- [ ] **Step 3: `native_hashes.cpp` erweitern.** Es berechnet die vier neuen Schlüssel je Design (Definition oben, Bytes in Host-Reihenfolge; x86 und Wasm sind beide LE). Danach `sh native/test/run.sh` ausführen. Erwartet: FAIL, weil die Funktionen fehlen.

- [ ] **Step 4: Bridge implementieren.**
  - Flags in `dm_generate`: unbekannte Bits oder `LIST|BAKED` → `fail(3, "invalid output flags …")`.
  - Ablehnungen aus den Festlegungen umsetzen.
  - Erfassungsreihenfolge wie in den Festlegungen. Library-`x` ist die Zeile, also gilt `screenX = yCoord` und `screenY = xCoord`.
  - Movie-Index ist `xCoord * dimY + yCoord`.
  - `dm_reset` leert alle neuen Puffer.
  - `build.sh`: die neun Funktionen an `-sEXPORTED_FUNCTIONS` anhängen.

- [ ] **Step 5: Native Tests grün, Golden ergänzen.**
  - Ausführen: `sh native/test/run.sh --write`.
  - Danach `git diff packages/dungeonmaker-js/test/golden/native-fnv.json`. Erwartet: **nur** hinzugefügte Zeilen (44 neue Schlüssel). Ändert sich ein vorhandener Schlüssel, Stopp: Dann verändert der Patch bestehende Ausgaben.
  - Danach `sh native/test/run.sh`. Erwartet: PASS, inklusive des clang-Vergleichs.

- [ ] **Step 6: Wasm bauen und Größe messen.**
  - `sh native/build.sh`, dann `pnpm build && pnpm size`.
  - Wird `wasmGzipBytes` überschritten, das Budget nach der Regel aus den Festlegungen anheben.
  - `pnpm test` muss grün bleiben, die bestehenden Golden-Hashes eingeschlossen.

- [ ] **Step 7: Commit.**
  ```bash
  git add native packages/dungeonmaker-js/wasm packages/dungeonmaker-js/test/golden/native-fnv.json packages/dungeonmaker-js/size-budget.json
  git commit -m "feat(native): rooms, entities and steps layers behind output flags"
  ```

### Task 2: Core — `generate(text, seed, output?)` mit Layern

**Files:**
- Create: `packages/dungeonmaker-js/src/layers.ts`, `test/core-layers.test.ts`, `test/layers.test.ts`
- Modify: `src/core/core.ts`, `src/core/glue.ts` (Typen der neuen Exporte), `src/core.ts` (Exporte), `test/helpers.ts` (Golden-Zugriff auf neue Schlüssel, `replaySteps`)

**Interfaces:**
- Consumes: C-ABI aus Task 1.
- Produces (`src/layers.ts`):
  ```ts
  export interface OutputOptions { rooms?: boolean; entities?: false | 'list' | 'baked'; steps?: boolean }
  export interface Room { readonly id: number; readonly area: 'labyrinth' | 'dungeon'; readonly size: number;
    readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } }
  export interface RoomLayer { readonly roomIds: Uint16Array; readonly rooms: readonly Room[] }
  export interface Entity { readonly kind: 'mob' | 'treasure'; readonly x: number; readonly y: number; readonly level: number }
  export type EntityLayer = readonly Entity[];
  export interface StepLayer { readonly offsets: Uint32Array; readonly index: Uint32Array; readonly cell: Uint8Array }
  export interface DungeonLayers { rooms?: RoomLayer; entities?: EntityLayer; steps?: StepLayer }
  /** Validates an untrusted value; TypeError naming the offending key. undefined → undefined. */
  export function parseOutput(value: unknown): OutputOptions | undefined;
  export function outputFlags(output: OutputOptions | undefined): number;
  ```
- Produces (`src/core/core.ts`):
  - `export type CompiledWasm = object;`
  - `LoadCoreOptions.wasmModule?: CompiledWasm` und `DungeonMakerCore.wasmModule: CompiledWasm`.
  - `generate(designText: string, seed: number, output?: OutputOptions): CoreResult` mit `CoreResult extends DungeonLayers`.
  - Layer-Felder gibt es nur, wenn sie angefordert wurden; bei `'baked'` gibt es kein `entities`.
  - Status 3 → `RangeError`.
- `src/core.ts` exportiert zusätzlich die Typen `CompiledWasm`, `OutputOptions`, `Room`, `RoomLayer`, `Entity`, `EntityLayer`, `StepLayer`.

- [ ] **Step 1: Failing tests schreiben.**
  `test/layers.test.ts` (prüft `parseOutput` und `outputFlags`):
  ```ts
  expect(outputFlags(undefined)).toBe(0);
  expect(outputFlags({ rooms: true, entities: 'list', steps: true })).toBe(1 | 2 | 8);
  expect(outputFlags({ entities: 'baked' })).toBe(4);
  expect(parseOutput({ entities: false })).toEqual({ entities: false });
  expect(() => parseOutput({ room: true })).toThrow(TypeError);      // unknown key
  expect(() => parseOutput({ entities: 'yes' })).toThrow(/entities/);
  expect(() => parseOutput('rooms')).toThrow(TypeError);
  ```
  `test/core-layers.test.ts`:
  - Golden: Für jedes der elf Designs gilt `fnv(layerBytes) === golden['<d>:42+rooms' | '+entities' | '+baked' | '+steps']`. Die Tabellen werden aus den TS-Objekten in derselben Byte-Form rekonstruiert wie in Task 1: Raumtabelle `[area === 'dungeon' ? 1 : 0, size, x, y, x + width - 1, y + height - 1]`, Entities `[kind === 'treasure' ? 1 : 0, x, y, level]` als `Int32Array`.
  - Layer ändern keine Zellen: `{ rooms: true }`, `{ entities: 'list' }`, `{ steps: true }` und alle drei zusammen ergeben `fnv(cells) === golden['<d>:42']`.
  - Bei `baked` unterscheiden sich die Zellen von `list` genau an den Entity-Positionen, nach der Zuordnung aus den Festlegungen.
  - Plausibilität der Entities: Schätze liegen in der Karte ohne Entities auf `Cell.InsideRoomOpen`. MOBs liegen auf `Open`, `InsideRoomOpen`, `InsideTunnelOpen` oder `InsideAnteroomOpen`. Mindestens ein Preset liefert bei Seed 42 wenigstens einen MOB und einen Schatz.
  - Räume: `roomIds.length === width * height`; jede ID ist `≤ rooms.length`; jede Zelle mit ID `k` liegt in `rooms[k-1].bounds`; `count(id === k) ≤ size`; `rooms[i].id === i + 1`.
  - Steps: `offsets[0] === 0` und `offsets[1] === width * height`. `offsets` ist monoton, `offsets.at(-1) === index.length === cell.length`. `replaySteps(steps, w * h)` ergibt `cells`, ebenso bei `{ steps: true, entities: 'baked' }`.
  - **Review Focus 1:** `extendDesign(presets.design3A, { population: undefined })` und eine Population aus lauter Nullen ergeben `entities: []` und dieselben Zellen wie ohne Entities. Wie `extendDesign` ein Feld entfernt, steht in `src/config/extend.ts`; notfalls wird das Objekt per Spread ohne `population` gebaut.
  - **Review Focus 2:** `design` auf 1024×1024 mit `{ steps: true }`: Frame 0 hat `1024 * 1024` Einträge, und das Abspielen ergibt `cells`.
  - Fehler:
    - `generate(text, 42, { entities: 'nope' } as never)` wirft `TypeError`.
    - Eine 3×50-Karte mit `entities` wirft `DesignValidationError` mit der Meldung »entities need a map of at least 4x4«.
    - Ein N-Record mit beiden Movie-Flags 0 plus `steps` wirft `DesignValidationError`.
  - Die neue Teststufe läuft über `test/helpers.ts`; die Vendor-Designs werden dort als Text gelesen.

- [ ] **Step 2: Ausführen.** `pnpm --filter dungeonmaker-js test -- layers core-layers`. Erwartet: FAIL, `parseOutput` ist nicht definiert.

- [ ] **Step 3: Implementieren.**
  - `layers.ts`.
  - `core.generate`: erst `parseOutput`, dann `outputFlags`. Die Layer werden nach `HEAPU8`-Neulesen per `slice` kopiert: `HEAP16`/`HEAP32` gibt es nicht als exportierte Views. Gelesen wird über `new Uint16Array(mod.HEAPU8.slice(p, p + 2 * n).buffer)` bzw. die passenden 32-Bit-Varianten, aus `HEAPU8` neu gelesen erst nach `_dm_generate`. Danach `_dm_reset()`.
  - Die Room- und Entity-Objekte werden aus den Tabellen gebaut und mit `Object.freeze` eingefroren.
  - `CompiledWasm` einsetzen; intern wird nach `WebAssembly.Module` gecastet.

- [ ] **Step 4: Ausführen.** `pnpm test && pnpm typecheck`. Erwartet: PASS.

- [ ] **Step 5: Commit.**
  ```bash
  git add packages/dungeonmaker-js/src packages/dungeonmaker-js/test
  git commit -m "feat(core): output options and typed rooms, entities and steps layers"
  ```

### Task 3: Worker & Client — Layer durchreichen und transferieren

**Files:**
- Modify: `src/protocol.ts`, `src/worker/handler.ts`, `src/dungeon.ts`, `src/client/client.ts`, `src/index.ts`, `test/protocol.test.ts`, `test/worker-handler.test.ts`, `test/client/client.test.ts`, `test/dungeon.test.ts`, `test/browser/client.browser.test.ts`, `size-budget.json` (`clientGzipBytes`)

**Interfaces:**
- Consumes: `OutputOptions`, `parseOutput`, `DungeonLayers` aus Task 2; `core.generate(text, seed, output)`.
- Produces:
  - `ToWorker` `create` bekommt `output?: OutputOptions`.
  - `FromWorker` `result` bekommt `rooms?: RoomLayer`, `entities?: EntityLayer` und `steps?: StepLayer`.
  - `DungeonRequest.output?: OutputOptions`, `DungeonData extends DungeonLayers`; `Dungeon` trägt `rooms?`, `entities?` und `steps?` (readonly).
  - `index.ts` exportiert zusätzlich die Typen `OutputOptions`, `Room`, `RoomLayer`, `Entity`, `EntityLayer` und `StepLayer`.

- [ ] **Step 1: Failing tests schreiben.**
  - `protocol.test.ts`:
    - `parseToWorker` akzeptiert `output: { rooms: true }` und lehnt `output: { rooms: 1 }` ab.
    - `parseFromWorker` lehnt ab: `roomIds` als `Uint8Array`, ein `roomIds.length` ungleich `width * height` und `steps` mit `offsets.at(-1) !== index.length`.
    - `parseFromWorker` akzeptiert ein vollständiges Ergebnis mit allen drei Layern.
  - `worker-handler.test.ts` (echter Core):
    - `create` mit `output: { rooms: true, entities: 'list', steps: true }` postet alle drei Layer.
    - Die Transfer-Liste enthält genau fünf Buffer: `cells.buffer`, `roomIds.buffer`, `steps.offsets.buffer`, `steps.index.buffer` und `steps.cell.buffer`.
  - `client.test.ts` (In-Process-Worker): `create({ design: presets.design3A, seed: 42, output: { rooms: true } })` liefert ein `dungeon.rooms.roomIds` mit `fnv` gleich dem Golden-Wert aus Task 2. `output: { entities: 'baked' }` liefert kein `entities`. `output: { steps: 'yes' }` lehnt mit `TypeError` ab (Rejection, kein synchroner Throw).
  - `dungeon.test.ts`: `toDungeon` übernimmt die Layer, `Object.isFrozen(d)`.
  - Browser-Test (alle Engines): Mit `output: { rooms: true, steps: true }` gilt `rooms.roomIds.buffer.byteLength === width * height * 2`, und `steps.offsets[1] === width * height`.

- [ ] **Step 2: Ausführen.** `pnpm test`. Erwartet: FAIL in den neuen Fällen.

- [ ] **Step 3: Implementieren.**
  - Der Client prüft `output` mit `parseOutput` beim Aufruf von `create()`; ein Fehler wird zur Rejection. `output` fließt in den Design-Snapshot (`structuredClone`) mit ein.
  - Der Handler reicht `output` an `generate` durch und transferiert alle Layer-Buffer.
  - `parseFromWorker` prüft Typ und Länge jedes Layers.
- [ ] **Step 4: Ausführen.** Nacheinander `pnpm test`, `pnpm build`, `pnpm size`, `pnpm --filter dungeonmaker-js test:browser` (lokal `DM_BROWSERS=chromium,firefox`, wenn WebKit fehlt). Den Client-Budgetwert nach der Regel aus den Festlegungen anheben. Erwartet: PASS.
- [ ] **Step 5: Commit.**
  ```bash
  git add packages/dungeonmaker-js
  git commit -m "feat(client): request output layers and receive them by transfer"
  ```

### Task 4: Entry `dungeonmaker-js/render`

**Files:**
- Create: `src/render/ascii.ts`, `src/render/tiles.ts`, `src/render/palette.ts`, `src/render/raster.ts`, `src/render/canvas.ts`, `src/render.ts`, `test/render.test.ts`, `test/browser/render.browser.test.ts`
- Modify: `package.json` (`exports["./render"]`)

**Interfaces:**
- Produces:
  ```ts
  /** Anything with the core fields: Dungeon, CoreResult. */
  export interface DungeonLike { readonly width: number; readonly height: number; readonly cells: Uint8Array }
  export const ASCII_CHARS: readonly string[];            // index = Cell, legacy toChar() table
  export function toAscii(dungeon: DungeonLike): string;  // rows joined by '\n', no trailing newline
  export const Tile: { readonly Floor: 0; readonly Wall: 1; readonly Door: 2; readonly Column: 3; readonly Mob: 4; readonly Treasure: 5 };
  export type Tile = (typeof Tile)[keyof typeof Tile];
  export function toTiles(dungeon: DungeonLike): Uint8Array;
  export type Palette = Readonly<Record<CellName, string>>;           // '#rrggbb'
  export const DEFAULT_PALETTE: Palette;
  export interface RasterOptions { palette?: Partial<Palette>; scale?: number }   // scale: integer 1..64, default 1
  export interface Raster { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray } // RGBA
  export function toRgba(dungeon: DungeonLike, options?: RasterOptions): Raster;
  export function paletteRgb(palette?: Partial<Palette>): Uint8Array; // 20 * 3 bytes, index = Cell
  export function toImageData(dungeon: DungeonLike, options?: RasterOptions): ImageData;
  export function drawToCanvas(dungeon: DungeonLike, canvas: HTMLCanvasElement | OffscreenCanvas, options?: RasterOptions): void;
  ```
- `DungeonLike`, `toAscii`, `toTiles`, `toRgba`, `paletteRgb` und `DEFAULT_PALETTE` liegen in DOM-freien Modulen (`ascii`, `tiles`, `palette`, `raster`); `export` importiert direkt von dort. Nur `canvas.ts` nennt DOM-Typen.

- [ ] **Step 1: Failing tests schreiben** (`test/render.test.ts`, Node):
  ```ts
  const d = { width: 3, height: 2, cells: Uint8Array.of(Cell.Open, Cell.Closed, Cell.Column, Cell.HorizontalDoor, Cell.Mob1, Cell.Treasure3) };
  expect(toAscii(d)).toBe(' #@\n=16');
  expect(ASCII_CHARS).toEqual([' ', '#', ' ', '#', '.', 'x', '_', 'X', "'", ',', '^', '=', '|', '1', '2', '3', '4', '5', '6', '@']);
  expect([...toTiles(d)]).toEqual([Tile.Floor, Tile.Wall, Tile.Column, Tile.Door, Tile.Mob, Tile.Treasure]);
  expect(DEFAULT_PALETTE.closed).toBe('#303030');
  expect(DEFAULT_PALETTE.insideTunnelOpen).toBe('#e8e8e8');
  const r = toRgba(d, { scale: 2, palette: { open: '#102030' } });
  expect([r.width, r.height, r.data.length]).toEqual([6, 4, 6 * 4 * 4]);
  expect([...r.data.slice(0, 4)]).toEqual([0x10, 0x20, 0x30, 255]);
  expect(() => toRgba(d, { scale: 0 })).toThrow(RangeError);
  expect(() => toRgba(d, { scale: 65 })).toThrow(RangeError);
  expect(() => toRgba(d, { palette: { open: 'red' } })).toThrow(TypeError);
  ```
  - Für alle 20 Zellwerte gilt: `toTiles` folgt dieser Tabelle:

    | `Tile` | Zellen |
    |---|---|
    | `Floor` | die sieben `*Open`-Zellen |
    | `Wall` | die vier `*Closed`-Zellen |
    | `Door` | beide Türen |
    | `Mob` | `Mob1`–`Mob3` |
    | `Treasure` | `Treasure1`–`Treasure3` |
    | `Column` | `Column` |

  - Die vollständige Palette:
    - `#f0f0f0` für `open`, `guaranteedOpen`, `nonJoinOpen`, `nonJoinGuaranteedOpen` und `insideRoomOpen`
    - `#303030` für die vier `*Closed`-Zellen
    - `#e8e8e8` für `insideTunnelOpen`
    - `#e0e0e0` für `insideAnteroomOpen`
    - `#a04000` für beide Türen
    - `#ff0040`, `#f00030`, `#e00020` für `mob1`, `mob2`, `mob3`
    - `#ffff00`, `#f0f000`, `#e0e000` für `treasure1`, `treasure2`, `treasure3`
    - `#00ff00` für `column`
  - `#rgb` ist als Kurzform erlaubt, alles andere ist `TypeError`.
  - Grenzen für `toRgba`: Bei mehr als 67 108 864 Pixeln (`width * scale * height * scale`) wirft es `RangeError`.
  - Browser-Test (`test/browser/render.browser.test.ts`): Nach `drawToCanvas` auf ein `OffscreenCanvas` ist `canvas.width === width * scale`, und `getImageData(...).data` ist gleich `toRgba(...).data`. `toImageData(...)` ist `instanceof ImageData`.
- [ ] **Step 2: Ausführen.** `pnpm --filter dungeonmaker-js test -- render`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Dazu gehören der Export `./render` in `package.json` (`types` + `default`, wie `./presets`) und der Test-Alias für Browser-Tests, falls `vitest.browser.config.ts` die Subpaths einzeln listet.
- [ ] **Step 4: Ausführen.** Nacheinander `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm check:package` und `pnpm --filter dungeonmaker-js test:browser`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(render): ascii, tiles, rgba raster and canvas helpers"`

### Task 5: Entry `dungeonmaker-js/export` — Dungeon-JSON, ASCII, Raw

**Files:**
- Create: `src/version.ts`, `scripts/write-version.mjs`, `src/schema/dungeon-file.ts`, `dungeon.schema.json` (generiert), `src/export/base64.ts`, `src/export/dungeon-json.ts`, `src/export/source.ts`, `src/export/text.ts`, `src/export.ts`, `test/export-json.test.ts`, `test/version.test.ts`, `test/golden/export-sha256.json`
- Modify: `package.json` des Packages (`exports["./export"]`, `exports["./dungeon.schema.json"]`, `files`, Scripts `build` und `version`), `scripts/generate-design-artifacts.mjs` (schreibt auch `dungeon.schema.json`), Root-`package.json` (`check:package`: `./dungeon.schema.json` zu `--exclude-entrypoints`)

**Interfaces:**
- Consumes: `DungeonLike`, `ASCII_CHARS`/`toAscii` (Task 4), Layer-Typen (Task 2), `CELL_TOKENS`/`CellName` (`src/config/tokens.ts`), `toDesignText`, `parseDesignText`.
- Produces:
  ```ts
  // src/version.ts (generated; build and `npm version` rewrite it)
  export const VERSION: string;
  // src/export/dungeon-json.ts
  export interface ExportableDungeon extends DungeonLike, DungeonLayers { readonly seed: number }
  export type DungeonSource = { readonly preset: string } | { readonly designHash: string; readonly design?: DesignConfig };
  export interface DungeonFileOptions { source?: DungeonSource; cells?: 'base64' | 'rows' | 'array'; generator?: string }
  export const DUNGEON_FORMAT = 'dungeonmaker-js/dungeon';
  export const DUNGEON_FORMAT_VERSION = 1;
  export const ROWS_ALPHABET: string;   // " #~%.x_X',^=|123456@", index = Cell
  export function toDungeonFile(dungeon: ExportableDungeon, options?: DungeonFileOptions): DungeonFile;
  export function toDungeonJson(dungeon: ExportableDungeon, options?: DungeonFileOptions): string; // 2-space JSON + '\n'
  // src/export/source.ts
  export function designSource(design: DesignConfig | string, options?: { embed?: boolean }): Promise<DungeonSource>;
  // src/export/text.ts
  export function toAsciiText(dungeon: DungeonLike): string;  // toAscii + '\n'
  export function toRaw(dungeon: DungeonLike): Uint8Array;    // u32 LE width, u32 LE height, cells
  ```
- `DungeonFile` ist `Static<typeof DungeonFileSchema>` aus `src/schema/dungeon-file.ts`, nur per `import type` verwendet. Der Aufbau, Schlüssel in genau dieser Reihenfolge:
  ```jsonc
  { "format": "dungeonmaker-js/dungeon", "formatVersion": 1, "generator": "dungeonmaker-js@0.0.2",
    "width": 200, "height": 80, "seed": 42,
    "source": { "preset": "design3A" },                      // optional
    "legend": { "0": "open", "1": "closed", …, "19": "column" },
    "cells": { "encoding": "base64", "data": "…" }           // | { "encoding": "rows", "alphabet": ROWS_ALPHABET, "data": ["…"] } | { "encoding": "array", "data": [0, 1, …] }
    "rooms": { "roomIds": { "encoding": "base64", "data": "…" }, "rooms": [ … ] },   // only with the layer
    "entities": [ … ],                                        // only with the layer
    "steps": { "offsets": "…", "index": "…", "cell": "…" } }  // base64 LE, only with the layer
  ```
  Das Schema hat `$id: "https://unpkg.com/dungeonmaker-js/dungeon.schema.json"`, `$comment: "SPDX-License-Identifier: CC0-1.0 …"` und durchgehend `additionalProperties: false`.
- `designSource`: Der Hash ist `sha256:<hex>` über die UTF-8-Bytes des Designtexts. Bei Objekten ist das `toDesignText(design)`, bei Strings der Text unverändert; berechnet wird über `globalThis.crypto.subtle`. Mit `embed: true` kommt `design` dazu (bei Legacy-Text `parseDesignText(text)`).

- [ ] **Step 1: Failing tests schreiben** (`test/export-json.test.ts`):
  - Den Dungeon `design3A`/42 über `loadCore` erzeugen, mit `{ rooms: true, entities: 'list', steps: true }`.
  - `toDungeonFile(d, { generator: 'dungeonmaker-js@test', source: { preset: 'design3A' } })`:
    - wird von `validateDesign`-artig (`Value.Check` mit `DungeonFileSchema`) akzeptiert;
    - `Object.keys(file)` steht in der Reihenfolge oben;
    - `legend['19'] === 'column'`;
    - `legend['8'] === 'insideRoomOpen'`.
  - Round-Trip mit einem testlokalen Decoder: Für jede `cells`-Kodierung, Raum-IDs und Steps ergeben `base64` → Bytes, `rows` → über das Alphabet und `array` dieselben Typed Arrays. Die Entities sind gleich.
  - Ohne Layer gibt es keine Schlüssel `rooms`/`entities`/`steps`. Bei `entities: 'baked'` gibt es keinen `entities`-Schlüssel.
  - **§9.4:**
    - Mit `source: { preset }` gibt es keinen `design`-Schlüssel irgendwo in der Datei.
    - `designSource(presets.design3A)` ergibt `{ designHash: /^sha256:[0-9a-f]{64}$/ }` ohne `design`; mit `embed` kommt `design` gleich dem Objekt dazu.
    - `designSource` auf Text und auf `toDesignText` desselben Objekts ergibt denselben Hash.
    - Die Datei besteht nach `JSON.parse` ausschließlich aus Objekten, Arrays, Strings, Zahlen und Booleans (rekursive Prüfung), und das Schema lehnt jeden zusätzlichen Schlüssel ab.
  - `toAsciiText` endet mit `'\n'`. `toRaw` hat die Länge `8 + w * h`, die ersten 8 Bytes sind LE `200, 80`.
  - Golden: `sha256` von `toDungeonJson` (Optionen wie oben, `cells: 'base64'`), `toAsciiText` und `toRaw` stehen unter `json`, `txt`, `bin` in `test/golden/export-sha256.json`. Die Datei wird beim ersten Lauf mit `DM_WRITE_GOLDEN=1` erzeugt und danach nur mit Begründung im Commit geändert.
  - `test/version.test.ts`: `VERSION === JSON.parse(readFileSync('package.json')).version`.
  - Drift: Das committete `dungeon.schema.json` ist gleich dem generierten (wie der bestehende Drift-Test für `design.schema.json` in `test/validate.test.ts`).
- [ ] **Step 2: Ausführen.** `pnpm --filter dungeonmaker-js test -- export-json version`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - `scripts/write-version.mjs` schreibt `src/version.ts` (mit SPDX-Header und `export const VERSION = '<version>';`).
  - In `package.json` des Packages wird `build` zu `node ../../scripts/write-version.mjs && tsc -p tsconfig.build.json`, und es kommt `"version": "node ../../scripts/write-version.mjs && git add src/version.ts"` dazu.
  - Base64 ohne `Buffer`: `btoa` über `String.fromCharCode` in Blöcken von 32 KiB.
  - Neuer Export `./export` und `./dungeon.schema.json`; `dungeon.schema.json` kommt in `files`.
  - `boundaries.test.ts` bleibt unverändert grün, denn `src/export/` importiert das Schema nur per `import type`.
- [ ] **Step 4: Ausführen.** Nacheinander `pnpm --filter dungeonmaker-js generate`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm check:package`, `pnpm lint`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(export): self-describing dungeon json, ascii and raw exporters"`

### Task 6: Export — PNG und Tiled-Map

**Files:**
- Create: `src/export/crc32.ts`, `src/export/png.ts`, `src/export/tiled.ts`, `test/export-png.test.ts`, `test/export-tiled.test.ts`, `test/browser/export.browser.test.ts`
- Modify: `src/export.ts`, `test/golden/export-sha256.json` (Schlüssel `png`, `tmj`, `tileset`)

**Interfaces:**
- Consumes: `paletteRgb`, `RasterOptions` (Task 4); `ExportableDungeon`, `VERSION` (Task 5).
- Produces:
  ```ts
  export interface PngOptions extends RasterOptions { generator?: string }
  export function toPng(dungeon: ExportableDungeon, options?: PngOptions): Promise<Uint8Array>;
  export interface TilesetOptions { palette?: Partial<Palette>; tileWidth?: number; tileHeight?: number } // default 16 × 16
  export const TILESET_IMAGE = 'dungeonmaker-tiles.png';
  export function toTilesetPng(options?: TilesetOptions): Promise<Uint8Array>;   // 20 tiles in one row, index = Cell
  export interface TiledOptions { tileWidth?: number; tileHeight?: number; tilesetImage?: string; generator?: string }
  export function toTiledMap(dungeon: ExportableDungeon, options?: TiledOptions): string; // JSON + '\n'
  export function crc32(bytes: Uint8Array): number;
  ```

- [ ] **Step 1: Failing tests schreiben.**
  `test/export-png.test.ts`:
  - `crc32(new TextEncoder().encode('IEND')) === 0xae426082`.
  - `toPng` für den 3×2-Dungeon aus Task 4 beginnt mit der PNG-Signatur `89 50 4E 47 0D 0A 1A 0A`.
  - Die Chunk-Folge ist `IHDR, PLTE, tEXt, tEXt, IDAT, IEND`. `IHDR` enthält Breite 3, Höhe 2, Bittiefe 8 und Farbtyp 3. `PLTE` hat die Länge 60.
  - Jeder Chunk-CRC stimmt.
  - Dekodieren mit `node:zlib.inflateSync`: Jede Zeile beginnt mit Filterbyte 0, und die Pixel-Indizes sind `cells`.
  - Mit `scale: 2` sind Breite und Höhe verdoppelt.
  - `tEXt` enthält `Software\0dungeonmaker-js@test` und `Comment\0seed=42`.

  `test/export-tiled.test.ts`:
  - `JSON.parse(toTiledMap(d, { generator: 'dungeonmaker-js@test' }))` hat diese Felder:
    - `type === 'map'`, `version === '1.10'`, `orientation === 'orthogonal'`, `renderorder === 'right-down'`, `infinite === false`
    - `width`/`height` gleich dem Dungeon, `tilewidth === 16`
    - `layers[0]`: `{ type: 'tilelayer', name: 'cells', data.length: w * h }` mit `data[i] === cells[i] + 1`
    - `tilesets[0]`: `{ firstgid: 1, tilecount: 20, columns: 20, image: 'dungeonmaker-tiles.png', imagewidth: 320, imageheight: 16 }`
    - `tiles[19].type === 'column'`
    - `properties` enthält `generator` und `seed`
  - Mit Layern kommen die Objektebenen `rooms` (Rechtecke in Pixeln, Property `area`, `size`) und `entities` dazu (`point: true`, Properties `kind`, `level`). `nextlayerid`/`nextobjectid` stimmen.
  - Golden in `export-sha256.json` (alle mit `generator: 'dungeonmaker-js@test'`):
    - `png`: `design3A`/42
    - `tmj`: gleicher Dungeon mit Rooms und Entities
    - `tmj-plain`: gleicher Dungeon ohne Layer
    - `tileset`: Default

  `test/browser/export.browser.test.ts`: In jeder Engine sind die SHA-256-Werte (`crypto.subtle`) von `toPng` und `toTilesetPng` für `design3A`/42 aus `createDungeon` gleich den Golden-Werten `png` und `tileset`. Das ist der M4-Nachweis »Browser = Node«.
- [ ] **Step 2: Ausführen.** `pnpm --filter dungeonmaker-js test -- export-png export-tiled`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - CRC-32 mit Tabelle (Polynom `0xEDB88320`).
  - Der zlib-Strom kommt aus `new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))` und wird über `new Response(...).arrayBuffer()` eingesammelt.
  - Kein `node:`-Import.
- [ ] **Step 4: Ausführen.** Nacheinander `pnpm test`, `pnpm build` und `pnpm --filter dungeonmaker-js test:browser`. Erwartet: PASS. Weicht eine Engine beim PNG-Hash ab, siehe die PNG-Festlegung oben.
- [ ] **Step 5: Commit.** `git commit -m "feat(export): dependency-free png encoder and tiled map export"`

### Task 7: Entry `dungeonmaker-js/node` — `generateToFiles`

**Files:**
- Create: `src/node/index.ts`, `src/node/seeds.ts`, `src/node/name.ts`, `src/node/design-file.ts`, `src/node/generate.ts`, `test/node/seeds.test.ts`, `test/node/name.test.ts`, `test/node/design-file.test.ts`, `test/node/generate.test.ts`
- Modify: `package.json` (`exports["./node"]: { "types": "./dist/node/index.d.ts", "node": "./dist/node/index.js" }`), `test/bundler-safety.test.ts` (`src/node/` ausnehmen, mit Begründung im Kommentar), `test/boundaries.test.ts` (`node/` darf das Schema laden)

**Interfaces:**
- Consumes: `loadCore` (Task 2), alle Exporter (Task 5/6), Presets, `parseDesignText`, `toDesignText`.
- Produces:
  ```ts
  export const MAX_SEEDS_PER_RUN = 10_000;
  export function parseSeeds(spec: string): number[];        // "42" | "1..50" | "1,5,9" | "1..3,7"; RangeError naming the input
  export function renderName(template: string, values: { name: string; seed: number }): string;
  // placeholders {name} {seed}; RangeError for '/', '\\', '..', an empty result or an unknown placeholder
  export function readDesignFile(path: string): Promise<{ design: DesignConfig | string; name: string }>;
  // .json → JSON.parse (object); otherwise legacy text with the BOM stripped and CRLF → LF; name = basename without extensions
  export type ExportFormat = 'json' | 'png' | 'tmj' | 'txt' | 'bin';
  export const EXPORT_EXTENSIONS: Readonly<Record<ExportFormat, string>>; // .dungeon.json .png .tmj .txt .bin
  export interface GenerateToFilesOptions {
    design?: DesignConfig | string; preset?: PresetName; designName?: string;
    seeds: readonly number[]; formats: readonly ExportFormat[]; outDir: string;
    name?: string; output?: OutputOptions; manifest?: boolean; embedDesign?: boolean;
    scale?: number; generator?: string;
  }
  export interface GenerateToFilesResult { readonly files: readonly string[]; readonly manifest?: string } // absolute paths
  export function generateToFiles(options: GenerateToFilesOptions): Promise<GenerateToFilesResult>;
  export type PresetName = 'design' | 'design2' | … | 'designOld1';   // the eleven names
  ```
- Regeln für `generateToFiles`:
  - Genau eines von `design`/`preset` muss gesetzt sein, sonst `TypeError`.
  - Die Seeds werden geprüft. Bei mehreren Seeds muss das Template `{seed}` enthalten, sonst `RangeError`. Geprüft wird alles **vor** der ersten Generierung.
  - `outDir` wird rekursiv angelegt.
  - `source`:
    - Preset → `{ preset }`.
    - Ein Design, dessen `toDesignText` gleich dem eines Presets ist → `{ preset: <name> }`, auch mit `embedDesign` (§9.4).
    - Sonst `designSource(design, { embed: embedDesign })`.
  - `tmj` schreibt zusätzlich einmal `dungeonmaker-tiles.png` in `outDir`.
  - `manifest: true` schreibt `manifest.json`:
    ```json
    { "format": "dungeonmaker-js/manifest", "formatVersion": 1, "generator": "…", "source": { … }, "output": { … }, "formats": [ … ], "files": [ { "seed": 42, "files": ["design3A-42.dungeon.json", …] } ] }
    ```
  - Pro Aufruf wird ein Core geladen; ein `GenerationError` bricht ab (Exit 1 in der CLI).

- [ ] **Step 1: Failing tests schreiben.**
  - `seeds.test.ts`:
    - `parseSeeds('42')` → `[42]`, `'1..3,7'` → `[1, 2, 3, 7]`, `'4294967295'` → `[4294967295]`.
    - **Review Focus 5:** `'0..3'`, `'5..1'`, `'1..20000'`, `'abc'`, `'4294967296'`, `''` und `'1,,2'` werfen `RangeError` mit der Eingabe im Text.
    - Doppelte Seeds werden entfernt, die Reihenfolge bleibt.
  - `name.test.ts`:
    - `renderName('{name}-{seed}', { name: 'cave', seed: 7 })` → `'cave-7'`.
    - `'../x-{seed}'`, `'a/b-{seed}'` und `'{nope}'` werfen `RangeError`.
  - `design-file.test.ts` (**Review Focus 3**): Eine Datei mit `﻿` und CRLF und dieselbe mit LF ergeben dasselbe `design` und denselben `toDesignText(parseDesignText(...))`. `cave.design.json` ergibt `name === 'cave'`.
  - `generate.test.ts` (in einem Temp-Verzeichnis unter `os.tmpdir()`, `afterEach` räumt auf):
    - `generateToFiles({ preset: 'design3A', seeds: [42], formats: ['json', 'png', 'tmj', 'txt', 'bin'], outDir, generator: 'dungeonmaker-js@test' })` schreibt `design3A-42.dungeon.json`, `.png`, `.tmj`, `.txt`, `.bin` und `dungeonmaker-tiles.png`.
    - Die SHA-256-Werte gleichen `export-sha256.json` (`json`, `png`, `tmj-plain`, `txt`, `bin`, `tileset`).
    - `design: presets.design3A` mit `embedDesign: true` → `source` ist `{ preset: 'design3A' }`, kein `design` in der Datei (§9.4).
    - Mehrere Seeds mit `name: 'fixed'` werfen `RangeError`, bevor eine Datei existiert (**Review Focus 4**, API-Seite).
    - `manifest: true` schreibt `manifest.json` mit beiden Seeds.
- [ ] **Step 2: Ausführen.** `pnpm --filter dungeonmaker-js test -- node/`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** `node:fs/promises` und `node:path` sind hier statisch erlaubt. Das Laden des Cores läuft über `loadCore()`; der Default-`wasmUrl` funktioniert unter Node bereits.
- [ ] **Step 4: Ausführen.** Nacheinander `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm check:package`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(node): generateToFiles with seed ranges, name templates and manifest"`

### Task 8: Node-CLI und Tarball-Smoke

**Files:**
- Create: `src/node/commands.ts`, `src/node/cli.ts`, `test/node/cli.test.ts`
- Modify: `package.json` des Packages (`"bin": { "dungeonmaker-js": "./dist/node/cli.js" }`, `sideEffects` um `./dist/node/cli.js` ergänzen), `scripts/pack-smoke.mjs`

**Interfaces:**
- Consumes: alles aus Task 7, `validateDesign`, `checkDesign`, `parseDesignText`, die Presets, `VERSION`.
- Produces:
  ```ts
  export interface CliIo { stdout(text: string): void; stderr(text: string): void; cwd: string; generator?: string } // generator: test hook only
  export function main(argv: readonly string[], io: CliIo): Promise<number>;  // exit code
  ```
  `cli.ts`: `#!/usr/bin/env node` als erste Zeile, SPDX-Header in Zeile 2, dann `process.exitCode = await main(process.argv.slice(2), { stdout: …, stderr: …, cwd: process.cwd() })`.
- Befehle (Parsing über `node:util` `parseArgs`, `strict: true`):

  | Befehl | Verhalten |
  |---|---|
  | `generate` | Genau eines von `--preset <name>` oder `--design <file>`, sonst Exit 2. Höchstens eines von `--seed <n>`, `--seeds <spec>`, `--count <n>`; der Default ist `--count 1`, mit Zufalls-Seeds über `crypto.getRandomValues` (0 wird neu gezogen). Weitere Optionen: `--format <list>` (Default `json`), `--out <dir>` (Default `cwd`), `--name <template>`, `--rooms`, `--entities list\|baked`, `--steps`, `--manifest`, `--embed-design`, `--scale <n>`. Auf stdout steht eine Zeile pro geschriebener Datei, relativ zu `cwd`. |
  | `presets` | Pro Preset eine Zeile `<name>  <width>x<height>`, in der Reihenfolge des Presets-Entry. |
  | `validate <file>` | Eine JSON-Datei durchläuft `validateDesign`, danach `checkDesign`; eine Textdatei durchläuft `parseDesignText`. Ergebnis: stdout `valid` mit Exit 0, oder je Fehler `<path>: <message>` auf stderr mit Exit 1. |
  | `convert <file> [--out <file>]` | Legacy-Text → JSON mit `"$schema"` als erstem Schlüssel (`DESIGN_SCHEMA_ID`), 2 Leerzeichen, `\n` am Ende; ohne `--out` auf stdout. |
  | `schema [design\|dungeon]` | Gibt den Inhalt der jeweiligen Schema-Datei aus dem Package aus; Default `design`. |
  | `--help`, `-h`, `help` | Hilfe auf stdout, Exit 0. Ohne Argumente: Hilfe auf stderr, Exit 2. `--version`: `VERSION`, Exit 0. |

  Die Hilfe enthält den Satz: `Generated files are program output and are not covered by the GPL; this CLI is GPL-3.0-or-later.`

- [ ] **Step 1: Failing tests schreiben** (`test/node/cli.test.ts`, in-process über `main`, mit gesammeltem stdout/stderr, Temp-Verzeichnis als `cwd`):
  - `generate --preset design3A --seed 42 --format json,png,tmj` → Exit 0. Die vier Dateien (inklusive Tileset) existieren, und die SHA-256-Werte von `json`/`png`/`tileset` gleichen `export-sha256.json` (mit `io.generator = 'dungeonmaker-js@test'`).
  - **Review Focus 4:** `generate --preset design3A --seeds 1..3 --name fixed` → Exit 2, das Verzeichnis bleibt leer.
  - **Review Focus 5:** `--seeds 0..3` → Exit 2, stderr nennt `0..3`.
  - Exit 2 auch bei:
    - `--preset nope`
    - `--preset design3A --design x.json`
    - `--format gif`
    - `--entities all`
    - unbekannter Option
    - unbekanntem Befehl
  - Ein ungültiges JSON-Design mit `validate` → Exit 1, stderr enthält einen JSON-Pfad (`/map/width: …`). Mit dem Preset als JSON-Datei → Exit 0, `valid`.
  - `convert` einer Vendor-Designdatei → stdout parst als JSON, der erste Schlüssel ist `$schema`, und `toDesignText(parsed)` ist gleich `toDesignText(presets.design3A)` (für `design3A`).
  - `schema` → stdout ist gleich `design.schema.json`; `schema dungeon` → gleich `dungeon.schema.json`.
  - `presets` → 11 Zeilen, die erste beginnt mit `design`.
  - `--help` enthält den Lizenzsatz. Ohne Argumente → Exit 2.
  - `generate --design cave.txt --count 2 --rooms --entities list` → Exit 0 mit zwei JSON-Dateien. Beide haben `entities` und einen `source.designHash`.
- [ ] **Step 2: Ausführen.** `pnpm --filter dungeonmaker-js test -- cli`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Die Schema-Dateien liest `commands.ts` über `new URL('../../design.schema.json', import.meta.url)` (Literal) bzw. `'../../dungeon.schema.json'`.
- [ ] **Step 4: Tarball-Smoke erweitern** (`scripts/pack-smoke.mjs`):
  1. In einem neuen leeren Temp-Verzeichnis `pnpm --package=<tarball> dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj` ausführen. Danach existieren die drei Dateien und das Tileset. Die JSON-Datei hat `seed === 42` und `source.preset === 'design3A'`, und ihr Feld `generator` ist `dungeonmaker-js@<version aus package.json>`.
  2. `npx --yes <tarball> presets` gibt 11 Zeilen aus.
  3. Der bestehende DOM-freie TypeScript-Consumer importiert zusätzlich `dungeonmaker-js/core` (`loadCore`, `CompiledWasm`), `dungeonmaker-js/export` (`toDungeonJson`, `toPng`) und `dungeonmaker-js/node` (`generateToFiles`). Er bleibt ohne DOM-Lib und ohne `@types` grün; der Kommentar zur `core`-Ausnahme fällt weg.

  Danach `pnpm build && pnpm pack:smoke` ausführen. Erwartet: PASS.
- [ ] **Step 5: Ausführen.** Nacheinander `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm check:package`, `pnpm size`. Erwartet: PASS.
- [ ] **Step 6: Commit.** `git commit -m "feat(cli): generate, presets, validate, convert and schema commands"`

### Task 9: Doku und Projektstatus

**Files:**
- Modify: `packages/dungeonmaker-js/README.md`, `CLAUDE.md`, `RELEASING.md`, `NOTICE`

- [ ] **Step 1: Package-README (Englisch)** um diese Abschnitte ergänzen:
  - **Output layers:** `output: { rooms, entities, steps }` mit je einem Beispiel. Dazu:
    - Hinweis, dass Entities Upstreams Demo-Code sind (`PlonkDownStuff`), samt Zuordnung von `baked`.
    - Größenwarnung zu `steps`: Frame 0 enthält jede Zelle, ein 1024×1024-Design ergibt mehrere MB.
  - **Rendering:** `toAscii`, `toTiles`, `drawToCanvas`, mit dem Hinweis, dass `dungeonmaker-js/render` für `toImageData`/`drawToCanvas` die DOM-Typen braucht.
  - **Export formats:** die Tabelle aus §7.4, der Aufbau des Dungeon-JSON, der Hinweis, dass Browser- und CLI-Dateien byte-gleich sind, und dass `dungeon.schema.json` unter CC0-1.0 steht.
  - **Command line:** die Beispiele aus §7.5, die Exit-Codes und »Generate offline, ship data« mit dem Lizenzsatz aus der CLI-Hilfe, ohne Rechtsberatung, mit Verweis auf §9.4-Inhalte.
  - `generateToFiles` aus `dungeonmaker-js/node`.
- [ ] **Step 2: `CLAUDE.md` aktualisieren.**
  - Status: Phasen 0–4 erledigt, Phase 3 auf `master`, Phase 4 auf `phase-4-layers-export-cli`, nichts davon veröffentlicht.
  - Die Entries `render`, `export` und `node` samt CLI in die Liste aufnehmen.
  - Layout: `src/render/`, `src/export/`, `src/node/`.
  - Gotchas: `PlonkDownStuff`/`SortRooms` sind durch Patch 0003 deterministisch; `steps` braucht Movie-Flags. Der alte Gotcha-Satz »Before enabling entities (phase 4) …« wird ersetzt.
  - Commands: `pnpm pack:smoke` prüft jetzt auch `pnpm dlx`/`npx`.
- [ ] **Step 3: Restliche Doku.**
  - `RELEASING.md`: `npm version` aktualisiert `src/version.ts` per Lifecycle-Script; bei einem Bump von Hand vorher `node scripts/write-version.mjs` ausführen, sonst schlägt `test/version.test.ts` fehl.
  - `NOTICE`: `dungeon.schema.json` (Format-Spezifikation) steht unter CC0-1.0.
- [ ] **Step 4: Gesamtlauf.** Nacheinander `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm size`, `pnpm check:package`, `pnpm pack:smoke`, `pnpm --filter dungeonmaker-js test:browser`, `pnpm bundler:smoke` und `sh native/test/run.sh`. Erwartet: alles grün.
- [ ] **Step 5: Commit.** `git commit -m "docs: layers, render, export and CLI; phase 4 status"`

---

**Manuell (Owner, nach dem Merge):** Ein `design3A-42.tmj` aus der CLI einmal in Tiled öffnen und prüfen, dass die Karte, das Tileset und die Objektebenen angezeigt werden. Dieser Schritt ist nicht automatisiert, weil Tiled in CI nicht verfügbar ist.
