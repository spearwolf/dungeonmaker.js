# dungeonmaker.js — Modernisierung & wiederverwendbares Package

Konzept und Schlachtplan · Stand 2026-10-31 · Status: **freigegeben am 2026-10-31.** Nächster Schritt: Umsetzungsplan für Phase 0 + 1 (§10).

> Entscheidungen des Owners sind als solche formuliert und in §11 gesammelt. Alles mit
> **[Vorschlag]** ist meine Setzung und darf überstimmt werden.

---

## 1. Ausgangslage

Der Ist-Zustand in Zahlen und Fakten, soweit er den Plan beeinflusst:

- **Kern:** DungeonMaker 2.05 (Peter Henningsen, alifegames), eine C++-Datei mit 4 630 Zeilen plus Header mit 556 Zeilen. Der Generator ist vollständig deterministisch über `rand()`/`srand()` (76 Aufrufe), nutzt keine Exceptions und keine RTTI, enthält 84 `assert()`s und zwei `exit(1)`-Pfade (beide in `Init_fromFile`/`Init_fromText` bei Parse-Fehlern).
- **Build:** fastcomp-Emscripten von 2014 → asm.js (`index.js`, ~1,1 MB) plus `.mem`-Datei; Designs per `--embed-file` im virtuellen FS. Die Toolchain ist lokal nicht installiert; ein Rebuild ist ein Port.
- **Repo:** Quellen und Build-Output liegen gemischt im Root, `dist/` ist committed und wird von Hand auf `gh-pages` gespiegelt. Kein `package.json`, keine Tests, kein Linter.
- **Datenpfad heute:** Der Worker postet `HEAP32.subarray(...)`. Structured Clone kopiert dabei den **gesamten 16-MB-Heap** pro Dungeon, und `Dungeon.data` ist eine View in diese Kopie.

Für den Entwurf sind vier Funde in der Bibliothek entscheidend:

1. **`Config` ist eine öffentliche Klasse**, `Config::AcceptDesign(text)` und `DungeonMaker::Init_fromConfig(config, seed)` sind public. Die Bridge kann also selbst parsen und bei Fehlern einen Statuscode zurückgeben, statt in `Init_fromText` → `exit(1)` zu laufen.
2. **Achsen:** Intern gilt `Map[x * dimY + y]`, `x` ist die *Zeile* (Norden = `x--`) und `y` die *Spalte* (Osten = `y++`). Die heutige Bridge schreibt `out[2 + y*width + x]` mit `width = dimX`. Damit ist jede heute gerenderte Karte **transponiert**: Norden zeigt im Canvas nach links.
3. **MOBs und Schätze werden in 2.05 nicht verteilt.** `PlonkDownStuff()` ist in `generate()` auskommentiert und `private`. Die Records `E1/E2/H1/H2/I1/I2` werden geparst, haben aber keine Wirkung. MOB- und Treasure-Zellen entstehen nur, wenn ein Design sie per `R`-Rechteck setzt.
4. **Zusatzdaten existieren bereits:** `GetRooms()` (Raumliste mit Zellen und Labyrinth-/Dungeon-Flag), `GetMOBs()`/`GetTreas()` (nach `PlonkDownStuff`) und `GetMovie()` (Änderungen pro Iteration, wenn `storeMovie` gesetzt ist).

Lizenz: Die Bibliothek steht unter der »GPL« ohne Versionsangabe (die mitgelieferte `COPYING` ist leer); dieses Repo steht unter GPL-2.0-or-later. → §9.

---

## 2. Ziel und Nicht-Ziele

### Ziel

Ein npm-Package, das sich in beliebigen Web-Projekten mit einer Zeile benutzen lässt:

```ts
import { createDungeon } from 'dungeonmaker-js';

const dungeon = await createDungeon({ design: myDesign, seed: 42 });
// dungeon.width, dungeon.height, dungeon.cells: Uint8Array
```

- TypeScript-Typen, Implementierung in modernem ESM-JavaScript, Kern als WebAssembly.
- Die Generierung läuft in einem Web Worker. Das Package verwaltet ihn vollständig: Config rein, Dungeon async raus.
- Die Config ist JSON, deckt **alle** Features der Originalbibliothek ab und ist optional per JSON Schema validierbar.
- Das Ausgabeformat ist kompakt und binär. Zusatz-Layer (Räume, Entities, Bauverlauf) sind opt-in, Konvertierungen (ASCII, Canvas, Tile-Kollaps) sind tree-shakeable Helfer.
- Aus dem Worker kommt **nur** die Karte (plus angeforderte Layer), exakt so groß wie nötig, per Transfer statt Kopie.
- Saubere Trennung: Quellen im Repo, Build-Output nicht im Repo, mit genau einer Ausnahme: das gebaute `.wasm` samt Glue wird committet (Owner-Entscheidung, §8.1). Das Package enthält nur, was zur Runtime gebraucht wird.
- **Node-CLI parallel zum Browser-Package:** Mit `pnpm dlx dungeonmaker-js generate …` (oder `npx …`) erzeugt man lokal fertige Dungeons als Dateien (JSON, PNG, Tiled-Map, ASCII). Diese Dateien sind reine Daten und lassen sich in beliebige Projekte importieren, ohne dass die GPL mitwandert (§7.5, §9.4).
- **Demo-Site auf GitHub Pages, auf Englisch:** visuelle Demo mit Download-Aktion für jeden erzeugten Dungeon, Kurzbeschreibung, Quickstart, API-Doku, Config-Referenz und CLI-Doku, eben alles, was zu einer kleinen Library gehört (§8.5).

### Nicht-Ziele (v1)

- Kein Umschreiben des Generators nach TS/Rust. Der C++-Kern bleibt, Patches nur minimal und als Datei sichtbar.
- Keine Bit-Kompatibilität mit den Dungeons der 2014er-Version (der PRNG wird ersetzt, §5.3).
- Kein CommonJS-Build, keine Unterstützung für Browser ohne Module Workers.
- Keine Rendering-Engine. Ein Canvas-Helfer für Debugging und die Demo reicht.

### Anti-Ziele — woran das Projekt scheitern würde, selbst wenn es technisch läuft

- Das Package funktioniert nur mit einem bestimmten Bundler, oder der Consumer muss Worker- und Wasm-Dateien von Hand kopieren.
- Ein ungültiges Design hängt den Worker auf, und das Promise settled nie (heute der Fall).
- Die JSON-Config ist nur eine 1:1-Abschrift der Kryptokürzel (`sSSP`, `tDSP`, `gSUOAR`) und dadurch unlesbar.
- Typen und Schema laufen auseinander, weil sie doppelt gepflegt werden.

---

## 3. Zielarchitektur

```
 Main Thread                                   Web Worker (module)
┌──────────────────────────────┐   postMessage  ┌──────────────────────────────────┐
│ createDungeon(request)       │ ─────────────▶ │ worker.ts                        │
│  ├─ validate? (optional)     │  {create,id,   │  ├─ toDesignText(config)          │
│  ├─ DungeonMakerClient       │   request}     │  ├─ core.generate(text, seed, …)  │
│  │   queue · timeout · abort │                │  │    └─ dungeonmaker.wasm         │
│  │   respawn on crash        │ ◀───────────── │  └─ slice() → transfer           │
│  └─ Dungeon (typed arrays)   │  {result,id,   └──────────────────────────────────┘
└──────────────────────────────┘   payload}
                                  + transfer list (ArrayBuffers, ohne Kopie)
```

Vier Schichten, jede einzeln benutzbar:

| Schicht | Entry Point | Läuft in | Zweck |
|---|---|---|---|
| **core** | `dungeonmaker-js/core` | Worker, Node, Deno, Bun | lädt das Wasm im aktuellen Thread, `generate()` synchron. Für Tests, Server-seitige Vorgenerierung, eigene Worker-Setups. |
| **worker** | `dungeonmaker-js/worker` | Worker | dünne Message-Schleife um `core`. |
| **client** | `dungeonmaker-js` | Main Thread | Worker-Lifecycle, Request-Queue, Promise-API. |
| **node** | `dungeonmaker-js/node` + `bin` | nur Node | CLI und Datei-Helfer (`writeDungeon`, Batch-Erzeugung) auf Basis von `core` und `export`. |

Quer dazu liegt `dungeonmaker-js/export`: plattformneutrale Exporter (§7.4), die *dieselben* Dateiformate für die CLI und für den Download-Button der Demo erzeugen.

**[Vorschlag]** `core` als eigener Entry Point ist kein Luxus. Er macht den Kern ohne Browser testbar (Vitest in Node), und ein Consumer, der schon einen Worker hat, braucht keinen zweiten.

---

## 4. Öffentliche API

```ts
// ── Client ────────────────────────────────────────────────────────────────
export function createDungeonMaker(options?: DungeonMakerOptions): DungeonMaker;
export function createDungeon(request: DungeonRequest, opts?: CallOptions): Promise<Dungeon>;
//            ↑ nutzt eine lazy erzeugte, geteilte Default-Instanz

interface DungeonMakerOptions {
  worker?: () => Worker;        // Escape Hatch für exotische Bundler/CSP
  wasmUrl?: string | URL;       // dito
  timeout?: number;             // ms pro Request, Default 30_000
  validate?: boolean;           // Schema-Check vor dem Senden, Default false
}

interface DungeonMaker {
  create(request: DungeonRequest, opts?: CallOptions): Promise<Dungeon>;
  ready(): Promise<void>;       // optional vorwärmen
  dispose(): void;              // Worker terminieren, offene Requests rejecten
}

interface CallOptions { signal?: AbortSignal; timeout?: number }

interface DungeonRequest {
  design: DesignConfig | string;   // JSON-Config oder Legacy-Designtext
  seed?: number;                   // uint32 ≥ 1; fehlt er → zufällig, steht im Ergebnis
  output?: OutputOptions;          // §7
}

// ── Ergebnis ──────────────────────────────────────────────────────────────
interface Dungeon {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly cells: Uint8Array;      // row-major, index = y * width + x, Werte = Cell
  readonly rooms?: RoomLayer;
  readonly entities?: EntityLayer;
  readonly steps?: StepLayer;
  get(x: number, y: number): Cell;
}

export const Cell = { Open: 0, Closed: 1, /* … */ Column: 19 } as const;
```

Fehler sind typisiert und kommen **immer** als Rejection, nie als hängendes Promise:

| Klasse | Wann |
|---|---|
| `DesignValidationError` | Schema- oder Semantikfehler (Pfad + Meldung pro Fehler), vor dem Senden oder im Worker |
| `GenerationError` | Wasm-Abort (z. B. `assert`). Der Worker instanziiert das Modul danach neu. |
| `TimeoutError` | Request überschreitet `timeout`. Der Worker wird terminiert und neu gestartet. |
| `AbortError` (`DOMException`) | `signal` abgebrochen |

Der Broadcast-Mechanismus `onCreateDungeon` entfällt. Wer alle Ergebnisse beobachten will, wrappt `create()`.

---

## 5. Wasm-Kern

### 5.1 Toolchain — Optionen und Empfehlung

| Option | Pro | Contra |
|---|---|---|
| **Emscripten (aktuelles emsdk), gepinnt per Docker-Image** | erprobte libc++/iostream-Runtime, ES-Module-Glue (`EXPORT_ES6`), Binaryen/`wasm-opt` inklusive, Abort-Handling in JS | Glue-Code von einigen KB, Emscripten-Eigenheiten |
| wasi-sdk (clang + libc++ für `wasm32-wasi`) + eigener WASI-Shim | schlankster Output, kein fremder JS-Glue | Shim für `fd_write`, `proc_exit`, `clock_time_get` selbst schreiben und pflegen; Memory-Growth und Abort selbst handhaben |
| Zig als C++-Cross-Compiler (`zig c++ -target wasm32-wasi`) | ein einziges Binary als Toolchain, sehr reproduzierbar | gleiches Shim-Thema wie wasi-sdk, libc++-Support im Zig-Bundle ist weniger erprobt |

**[Vorschlag] Emscripten**, aufgerufen über ein Build-Script, das ein **gepinntes `emscripten/emsdk`-Image** per Docker/Podman startet (beides ist auf der Maschine vorhanden). Lokal und in CI läuft derselbe Compiler, und niemand muss emsdk installieren. Lohnt sich später jedes Kilobyte, ist der Wechsel auf wasi-sdk ein abgeschlossener Umbau hinter derselben C-ABI.

Flags (Startpunkt, in M2 vermessen):

```
em++ -std=c++17 -O3 -flto -fno-exceptions -fno-rtti
  -sMODULARIZE -sEXPORT_ES6 -sEXPORT_NAME=loadDungeonMakerWasm
  -sENVIRONMENT=worker,node -sFILESYSTEM=0
  -sALLOW_MEMORY_GROWTH -sINITIAL_MEMORY=4MB
  -sEXPORTED_FUNCTIONS=_dm_generate,_dm_result_ptr,_dm_result_len,…,_malloc,_free
  -sEXPORTED_RUNTIME_METHODS=HEAPU8,stringToUTF8,lengthBytesUTF8
  -sINCOMING_MODULE_JS_API=locateFile,instantiateWasm,print,printErr
  -sSTRICT
```

`-sFILESYSTEM=0`: Designs kommen als String rein, ein virtuelles FS braucht niemand mehr. Damit fallen auch die elf `--embed-file`s weg. Der 2005er-Code wird vermutlich ein paar Warnungen oder einen älteren `-std` brauchen. Das klärt M2.

### 5.2 Die Bridge (`native/src/bridge.cpp`, ersetzt `createdungeon.cpp`)

Eine schmale C-ABI, ein globaler Ergebnis-Slot pro Instanz (ein Worker generiert ohnehin seriell):

```c
// Status: 0 = ok, 1 = parse error, 2 = invalid seed
int32_t  dm_generate(const char* designText, uint32_t seed, uint32_t flags);
uint32_t dm_width(void);     uint32_t dm_height(void);
const uint8_t* dm_cells(void);                 // width*height Bytes, north-up, row-major
uint32_t dm_room_count(void); const uint16_t* dm_room_ids(void); /* … */
const char* dm_last_error(void);
void     dm_reset(void);                       // gibt Ergebnis-Puffer frei
```

- **Kein `exit()` mehr:** `Config c; if (!c.AcceptDesign(text)) return 1; dm.Init_fromConfig(c, seed); dm.generate();`
- **Zellen als `uint8_t`:** 20 Werte passen in ein Byte. Das spart 75 % gegenüber `int32`.
- **Achsen:** Die interne Ablage `Map[x * dimY + y]` *ist* bereits north-up row-major mit `width = dimY` und `height = dimX`. Die Bridge kopiert linear und narrowt dabei auf `uint8_t`. Das behebt die Transposition aus §1 nebenbei. Achtung: Bestehende Demos erscheinen dadurch um 90° gedreht (korrekt orientiert).
- **Cell-Nummerierung [Vorschlag]:** die Reihenfolge des Library-Enums `SquareData` (`OPEN=0, CLOSED, G_OPEN, G_CLOSED, NJ_OPEN, …, COLUMN=19`) statt der eigenen `toInt()`-Tabelle. Damit entfällt eine Übersetzungstabelle, die auseinanderdriften kann. Das bricht mit der Legacy-Nummerierung, die aber ohnehin nirgends außerhalb dieses Repos vertraglich zugesagt war.
- `print`/`printErr` des Moduls sammeln Library-Ausgaben (die Bibliothek schreibt Warnungen nach `cout`) und hängen sie an Fehler bzw. optional an das Ergebnis (`diagnostics`).

### 5.3 Determinismus

`rand()` aus der jeweiligen libc ist nicht portabel. **[Vorschlag]** Eine Unity-TU `native/src/dungeonmaker_unity.cpp` bindet erst `<cstdlib>` ein und definiert danach `rand`/`srand` auf einen eigenen, dokumentierten PRNG (PCG32 oder xorshift32) um, bevor sie `vendor/…/DungeonMaker.cpp` inkludiert. Das Vendor-File bleibt unangetastet. Die Garantie lautet dann: **gleiche Config + gleicher Seed + gleiche Package-Major-Version = byte-identischer Dungeon**, auf jeder Plattform und auch in einem nativen Debug-Build derselben TU.

Seed `0` triggert in der Bibliothek `time(NULL)`. Die API erlaubt deshalb nur `1 … 2³²−1`, und ein ausgewürfelter Seed steht immer im Ergebnis.

### 5.4 Robustheit

- **Parser-Fehler** werden in erster Linie *vor* dem Wasm abgefangen: Der Designtext wird aus validiertem JSON erzeugt (§6), ist also per Konstruktion wohlgeformt. `AcceptDesign` ist das Sicherheitsnetz.
- **`assert` bleibt aktiv** (kein `-DNDEBUG`). Ohne Asserts würden Out-of-bounds-Schreibzugriffe im Linear Memory still Daten zerstören. Ein Assert wird zum Abort, der Worker meldet `GenerationError` und instanziiert das Modul neu aus dem gecachten `WebAssembly.Module` (Millisekunden, kein Re-Download).
- **Endlosschleifen** (pathologische Configs) fängt der Client-Timeout: `worker.terminate()`, neuer Worker, `TimeoutError`.

---

## 6. Design-Config als JSON

### 6.1 Prinzip: JSON ist die API, der Designtext ist das Wire-Format

```
DesignConfig (JSON) ──validate?──▶ toDesignText() ──▶ Config::AcceptDesign (C++)
Legacy-Designtext ──parseDesignText()──▶ DesignConfig
```

**[Vorschlag]** Die Konvertierung JSON → Designtext passiert in TypeScript, nicht in C++. Gründe:

- **Feature-Parität ist garantiert:** Der Original-Parser bleibt die einzige Stelle, die `Config` befüllt. Kein JSON-Parser in C++ (spart Binary-Größe), kein zweiter Mapping-Pfad.
- **Legacy-Designs kommen kostenlos mit:** `parseDesignText()` macht aus den elf Beispieldesigns JSON-Presets und erlaubt Consumern, alte Designdateien zu importieren.
- **Ein starker Test fällt ab:** Für jedes Legacy-Design und mehrere Seeds muss `generate(text) === generate(toDesignText(parseDesignText(text)))` byte-identisch sein. Das beweist die Vollständigkeit des JSON-Modells gegen den echten Parser.

### 6.2 Modell — lesbare Namen statt Kürzel

Alle Record-Typen des Formats werden abgedeckt: `D R BC BR BT ZU ZD F J T GS GB S C AC AT M N K PR PT PU WS WP1/WP2 U E1 E2 H1 H2 I1 I2`. Skizze (Namen final in M3):

```jsonc
{
  "$schema": "https://unpkg.com/dungeonmaker-js/design.schema.json",
  "map": {
    "width": 200, "height": 80,                 // Bildschirmkonvention, s. u.
    "background": "closed",
    "joinDistance": 12, "tunnelJoinDistance": 18,
    "openings": ["W"]
  },
  "rectangles": [ { "from": { "x": 1, "y": 94 }, "to": { "x": 5, "y": 98 }, "cell": "open" } ],
  "spawnDelay": { "crawler": [0,0,50,0,50,0,0,0,0,0,0], "roomie": […], "tunneler": […] },
  "crawlers": {
    "stepLength":   { "byGeneration": [3,3,3,3,3,3] },
    "corridorWidth":{ "byGeneration": [15,15,7,7,3,3,2,2,1] },
    "maxAge":       { "byGeneration": [20,10,…] },
    "random":       { "perThousandWallSquares": [0,99], "genes": { … } },
    "inTunnels":    { "seedCount": 0, "generation": -1, "genes": { … }, "closedProbability": 100 },
    "seeds": [ /* WS */ ], "pairs": [ /* WP1+WP2 */ ]
  },
  "tunnelers": {
    "sizeUpProbability": [0,10,10,10,20,30,40], "sizeDownProbability": […],
    "anteroomProbability": [20,20,50,0,0,100], "joinPreference": [0,0,10,100,100],
    "maxAge": […], "lastChance": { … }, "seeds": [ /* U */ ]
  },
  "rooms": {
    "size": { "min": 20, "medium": 50, "large": 100, "max": 300 },
    "count": { "labyrinth": { "small": 20, "medium": 5, "large": 1 }, "dungeon": { … } },
    "sizeProbability": { "sideways": [[100,0,0], …], "branching": [ … ] },
    "aspectRatio": 0.6
  },
  "behaviour": { "mutator": 20, "noHeadingProbability": 40, "patience": 90, … },
  "population": { "mobs": { … }, "treasure": { … } }   // wirkt nur mit output.entities, s. §7
}
```

Regeln, die das JSON vom Textformat abheben:

- **Arrays statt Terminatoren.** Das Textformat beendet Listen je nach Record mit `-1`, `0`, `100`, `99` oder einer negativen Zahl. JSON-Arrays enthalten den Terminator nie; der Serializer hängt den richtigen an und lehnt einen Wert ab, der mit ihm kollidiert. Was jenseits des Array-Endes gilt, bestimmt der Record, nicht das JSON: Bei `S`, `C`, `AC`, `AT`, `J`, `ZU` und `ZD` wiederholt sich der letzte Wert; bei `F` gilt danach 100 (immer ein Vorraum), bei `GS`/`GB` 100 % große Räume, bei `K` werden keine Crawler mehr gesetzt.
- **Koordinaten in Bildschirmkonvention** (`x` = Spalte nach rechts, `y` = Zeile nach unten, Norden oben). Der Serializer tauscht genau an *einer* Stelle in die Library-Konvention. Die Himmelsrichtungen (`N`, `NE`, …) bleiben dabei unverändert, weil Library-Norden (`x--`) bereits »Zeile nach oben« bedeutet.
- **Enums als lesbare Strings** (`"guaranteedClosed"`, `"insideRoomOpen"` …) mit Mapping auf die Library-Tokens.
- **Nicht-Wirkendes wird nicht angeboten:** `showMovie` und `storeMovie` stehen nicht im Modell; `storeMovie` wird über `output.steps` gesetzt, `randSeed` kommt aus dem Request-Seed. Wirkungslos sind die Movie-Flags trotzdem nicht: Upstreams `MakeIteration()` erkennt Kartenänderungen nur, wenn eines davon gesetzt ist, sonst läuft jede Generation genau eine Iteration. Der Serializer setzt deshalb immer `showMovie = 1`; Designtext mit beiden Flags auf `0` lehnt der Import ab.

### 6.3 Typen, Schema, Validierung — eine Quelle

**[Vorschlag] TypeBox** als Single Source of Truth: Aus einer Definition entstehen die statischen TS-Typen (`Static<typeof DesignConfig>`), ein Standard-JSON-Schema (wird als `design.schema.json` mitgeliefert, damit Editoren per `$schema` autocompleten) und ein Runtime-Validator. Alternativen: Valibot (kleiner, Schema-Export nur über Zusatzpaket), Zod 4 (größer, JSON-Schema-Export eingebaut).

Validierung in zwei Stufen:

1. **Strukturell (optional):** `dungeonmaker-js/schema` → `validateDesign(config)`. Wird nur geladen, wenn `validate: true` gesetzt ist oder der Consumer es selbst importiert. Der Client bleibt dadurch schlank.
2. **Semantisch (immer, billig, im Worker):** Summen = 100 (`BC/BR/BT`, `GS/GB`), `sizeUp + sizeDown ≤ 100`, Koordinaten innerhalb der Karte, Indexgrenzen (`spawnDelay` genau 11 Einträge). Das sind genau die Bedingungen, deren Verletzung sonst in einem Assert oder einer Endlosschleife endet.

### 6.4 Presets & Komposition

- `dungeonmaker-js/presets` exportiert die elf Originaldesigns als JSON (`design`, `design2`, `design3A`, … `designOld1`), einzeln importierbar.
- Ein Helfer `extendDesign(base, patch)` (Deep Merge, Arrays ersetzen statt mergen) erlaubt `extendDesign(presets.design5, { map: { width: 120 } })`.

---

## 7. Ausgabe, Export & Node-CLI

### 7.1 Kern: immer gleich, immer binär

`cells: Uint8Array` (row-major, `Cell`-Werte) plus `width`, `height` und `seed`. Für eine 200×80-Karte sind das 16 000 Bytes statt heute 16 MB Heap-Clone. Der Worker kopiert per `HEAPU8.slice()` exakt diesen Bereich in einen frischen `ArrayBuffer` und **transferiert** ihn. Aus dem Wasm-Heap verlässt nichts anderes den Worker.

### 7.2 Opt-in-Layer — nur, was Wasm-State braucht, wird im Worker berechnet

```ts
interface OutputOptions {
  rooms?: boolean;                       // RoomLayer
  entities?: false | 'list' | 'baked';   // MOBs & Schätze (PlonkDownStuff)
  steps?: boolean;                       // Bauverlauf für Animationen (storeMovie)
}
```

| Layer | Inhalt | Format |
|---|---|---|
| `rooms` | Räume aus `GetRooms()` | `roomIds: Uint16Array` (pro Zelle, 0 = kein Raum) + `rooms: { id, area: 'labyrinth' \| 'dungeon', size, bounds }[]` |
| `entities: 'list'` | Ergebnis von `PlonkDownStuff()`, Karte bleibt unverändert | `{ kind: 'mob' \| 'treasure', x, y, level }[]` |
| `entities: 'baked'` | wie die Library-Demo (`PutPlonkOnMap`): Entities werden als Zellen in die Karte geschrieben | nur `cells` |
| `steps` | Zelländerungen pro Iteration | `offsets: Uint32Array` (Start pro Iteration), `index: Uint32Array`, `cell: Uint8Array` |

`entities` braucht einen Ein-Zeilen-Patch (`PlonkDownStuff`/`PutPlonkOnMap` von `private` nach `public`). Er liegt als Datei unter `native/patches/` und wird im Build angewendet. Der Original-Autor nennt `PlonkDownStuff` selbst Demo-Code. Darum ist das Feature opt-in und in der Doku entsprechend gekennzeichnet.

### 7.3 Konverter — Main Thread, tree-shakeable

`dungeonmaker-js/render`:

- `toAscii(dungeon)`: die Zeichentabelle aus dem alten `toChar()`
- `toImageData(dungeon, palette?)` und `drawToCanvas(dungeon, canvas, { scale, palette })`: ersetzt `showDungeon`, nur noch an einer Stelle
- `toTiles(dungeon)`: kollabiert die 20 Zellarten auf `floor | wall | door | column | …` für Spiele, die die Builder-Semantik (`NJ_*`, `G_*`) nicht interessiert

Bewusst **kein** konfigurierbares Wire-Format. Der Worker spricht immer Binär, alles Weitere sind reine Funktionen auf dem `Dungeon`. Das hält das Worker-Protokoll stabil und das Bundle klein.

### 7.4 Exportformate — eine Implementierung für CLI und Demo

`dungeonmaker-js/export` erzeugt aus einem `Dungeon` Dateien als `Uint8Array` bzw. `string`. Die Exporter sind plattformneutral: Node schreibt das Ergebnis mit `fs`, die Demo macht daraus einen `Blob`-Download. Weil beide Wege denselben Code benutzen, ist eine Datei aus der Demo identisch mit einer aus der CLI (gleiche Config, gleicher Seed).

| Format | Datei | Wofür |
|---|---|---|
| **Dungeon-JSON** (Hauptformat) | `*.dungeon.json` | verlustfrei inkl. Layer, versioniert, für eigene Importer |
| **PNG** | `*.png` | Vorschau, Doku, Level-Editoren mit Bild-Import. Encoder ohne Dependency: PNG-Chunks von Hand, Kompression über `CompressionStream('deflate')`, das es in Node und im Browser gibt |
| **Tiled-Map** | `*.tmj` | direkter Import in Tiled und damit in Godot, Phaser, Unity, Excalibur und alles, was Tiled-Maps liest |
| **ASCII** | `*.txt` | Roguelikes, Tests, schneller Blick ins Terminal |
| **Raw** | `*.bin` | 8-Byte-Header (`width`, `height` als uint32 LE) + `cells`, für Engines ohne JSON-Parser |

Das Dungeon-JSON ist als **eigenständige Spezifikation** dokumentiert (Abschnitt auf der Doku-Site plus JSON Schema):

```jsonc
{
  "format": "dungeonmaker-js/dungeon", "formatVersion": 1,
  "generator": "dungeonmaker-js@1.0.0",
  "width": 200, "height": 80, "seed": 42,
  "source": { "preset": "design3A" },          // oder { "designHash": "sha256:…" }, Design optional eingebettet
  "legend": { "0": "open", "1": "closed", … }, // macht die Datei selbsterklärend
  "cells": { "encoding": "base64", "data": "…" }, // alternativ "rows" (ASCII-Zeilen) oder "array"
  "rooms": [ … ], "entities": [ … ]           // nur, wenn angefordert
}
```

**[Vorschlag]** Die `legend` steht in jeder Datei. Ein Importer braucht dann weder dieses Package noch dessen Doku, die Datei erklärt sich selbst.

### 7.5 Node-CLI

Teil desselben npm-Packages (`"bin": { "dungeonmaker-js": "./dist/node/cli.js" }`), damit Wasm, Presets und Version immer zusammenpassen. Ohne Laufzeit-Dependencies: Argumente über `node:util` `parseArgs`, Dateien über `node:fs`.

```sh
pnpm dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj --out ./dungeons
pnpm dlx dungeonmaker-js generate --design ./my-cave.json --seeds 1..50 --format json --name "cave-{seed}"
pnpm dlx dungeonmaker-js generate --design ./old-design.txt --count 10 --rooms --entities list
pnpm dlx dungeonmaker-js presets                     # Presets auflisten
pnpm dlx dungeonmaker-js validate ./my-cave.json     # Schema + Semantik prüfen, Exit-Code ≠ 0 bei Fehlern
pnpm dlx dungeonmaker-js convert ./old-design.txt    # Legacy-Text → JSON-Config
pnpm dlx dungeonmaker-js schema > design.schema.json
```

- **Programmatisch** dasselbe über `dungeonmaker-js/node`: `generateToFiles({ design, seeds, formats, outDir })`, gedacht für Build-Scripts (`vite.config`, eigene Asset-Pipelines).
- **Reproduzierbarkeit:** Jede erzeugte Datei trägt Generator-Version und Seed. `--manifest` schreibt zusätzlich eine `manifest.json` über den ganzen Batch.
- **Batch-Parallelität** (`--jobs n` über `worker_threads`) kommt erst, wenn Messungen sie rechtfertigen (§10, Abschnitt »Später«).
- **Lizenz-Hinweis in der CLI-Hilfe und der Doku:** Die erzeugten Dateien sind Programmausgabe und keine GPL-Werke (§9.4). Die CLI selbst und das Package bleiben GPL.

---

## 8. Repo-Struktur, Build, Package und Demo-Site

### 8.1 Layout (pnpm Workspace)

```
/
├─ package.json · pnpm-workspace.yaml · tsconfig.base.json · mise.toml
├─ native/
│  ├─ vendor/dungeonmaker-2.05/     # entpackt, unverändert: DungeonMaker.{h,cpp}, Manual, Designs
│  ├─ patches/                      # minimal, je Patch eine Begründung im Header
│  ├─ src/bridge.cpp · dungeonmaker_unity.cpp · prng.h
│  └─ build.sh                      # docker/podman run emscripten/emsdk:<pin> …
├─ packages/dungeonmaker-js/
│  ├─ src/{client,worker,core,config,schema,presets,render,export,node}/
│  ├─ wasm/                         # Build-Output von native/, COMMITTET (s. u.)
│  └─ test/
├─ site/                            # Demo + Doku (Englisch), Vite, deployt nach GitHub Pages
├─ docs/                            # interne Projekt-Doku (dieses Konzept etc.)
└─ .github/workflows/ ci.yml · pages.yml · release.yml
```

**Gebautes Wasm wird committet (Owner-Entscheidung).** `packages/dungeonmaker-js/wasm/` enthält `dungeonmaker.wasm` und das Emscripten-Glue-Modul. Damit ist ein frischer Clone ohne Docker sofort test- und baubar; nur wer `native/` ändert, braucht den Container. Begleitende Regeln:

- `.gitattributes`: `packages/dungeonmaker-js/wasm/** linguist-generated binary`, damit Diffs und Sprachstatistik nicht verrauschen.
- **CI-Drift-Check:** CI baut das Wasm im gepinnten Container neu und vergleicht es byte-genau mit dem committeten Stand. Ist der Build nicht bit-reproduzierbar (in M1 prüfen), fällt der Check auf einen Verhaltensvergleich zurück: Hash der Golden-Dungeons aller Presets. Ein PR, der `native/` ändert, ohne das Wasm neu zu committen, wird rot.
- Ein `wasm/BUILD-INFO.json` hält Emscripten-Version, Image-Digest, Flags und den Commit von `native/` fest. Das erfüllt nebenbei einen Teil der Quellenpflicht aus §9.3.

**Legacy (Owner-Entscheidung):** Den Ist-Stand als `legacy-2014` taggen, den `gh-pages`-Branch zusätzlich als `legacy-2014-demo`. Bewusst ohne `v`-Präfix: `v*`-Tags gehören ab jetzt allein den npm-Releases (§8.6). Danach alle Root-Dateien von 2014 (`index.*`, `createdungeon*`, `pre.js`, `build.sh`, `dist/`, Tarball, `preview.png`) aus `master` entfernen; die Git-History bewahrt sie. Der Tarball wird durch das entpackte `native/vendor/` ersetzt (diffbar, Patches sichtbar). Die **Demo bleibt als Funktion erhalten**, wird aber in `site/` neu gebaut (§8.5).

### 8.2 Toolchain JS/TS

- Node (aktuelle LTS, per `mise` gepinnt), pnpm, TypeScript im `strict`-Modus, Target ES2022, **ESM only**.
- **Emit mit `tsc`, nicht gebundelt.** Das ist bei Worker-Packages entscheidend: Das Muster `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })` und `new URL('./dungeonmaker.wasm', import.meta.url)` muss im ausgelieferten Code intakt stehen, damit Vite, webpack 5, Rollup und Parcel Worker und Wasm selbst erkennen und mitkopieren. Ein vorab gebundeltes Package zerstört genau das.
- Lint/Format: Biome (ein Tool, schnell) oder ESLint Flat Config + Prettier, je nach Vorliebe.
- Tests: Vitest (Node) für `core`, `config`, `export`, `node`/CLI; Vitest Browser Mode mit Playwright-Provider für den Worker-Client in Chromium, Firefox und WebKit.
- Package-Hygiene in CI: `publint` und `@arethetypeswrong/cli`.
- **pnpm überall**, wo es Sinn macht: Workspace, Scripts, Lockfile, CI, Doku-Beispiele (`pnpm add`, `pnpm dlx`). npm direkt nur dort, wo es fachlich nötig ist, nämlich beim OIDC-Handshake mit der Registry (§8.6). In Doku und Site stehen npm, yarn und bun als umschaltbare Alternativen daneben.
- Node und pnpm sind in `mise.toml` gepinnt, zusätzlich `packageManager` in der Root-`package.json` für Corepack-Nutzer. CI liest dieselbe `mise.toml` (`jdx/mise-action`), es gibt also nur eine Versionsquelle.
- Releases: vollautomatisch per Versions-Bump, siehe §8.6.

### 8.3 Package-Inhalt (`files`, `exports`, `bin`)

```jsonc
"name": "dungeonmaker-js",
"license": "GPL-3.0-or-later",
"type": "module",
"bin": { "dungeonmaker-js": "./dist/node/cli.js" },
"exports": {
  ".":             { "types": "./dist/index.d.ts",   "default": "./dist/index.js" },
  "./core":        { "types": "./dist/core.d.ts",    "default": "./dist/core.js" },
  "./worker":      { "default": "./dist/worker.js" },
  "./schema":      { "types": "./dist/schema.d.ts",  "default": "./dist/schema.js" },
  "./presets":     { "types": "./dist/presets.d.ts", "default": "./dist/presets.js" },
  "./render":      { "types": "./dist/render.d.ts",  "default": "./dist/render.js" },
  "./export":      { "types": "./dist/export.d.ts",  "default": "./dist/export.js" },
  "./node":        { "types": "./dist/node/index.d.ts", "node": "./dist/node/index.js" },
  "./design.schema.json":  "./design.schema.json",
  "./dungeon.schema.json": "./dungeon.schema.json",
  "./dungeonmaker.wasm":   "./wasm/dungeonmaker.wasm"
},
"sideEffects": false
```

Die Schemas liegen im Package-Root, nicht in `dist/`: Nur so löst die `$id`/`$schema`-URL `https://unpkg.com/dungeonmaker-js/design.schema.json` auf die ausgelieferte Datei auf. Das Wasm liegt im committeten Build-Output `wasm/` (§8.1) und wird von dort exportiert.

Drin: JS, `.d.ts`, `.wasm`, Emscripten-Glue (ES-Modul), beide Schemas, README, LICENSE, NOTICE. Nicht drin: C++-Quellen, Tests, Site, Source Maps des Wasm (separat als Release-Asset). Der `./node`-Export hat bewusst nur die `node`-Condition, damit kein Browser-Bundler versehentlich `node:fs` einsammelt.

Größenbudget: wird in M1 nach der ersten Messung festgelegt und ab dann in CI geprüft (Wasm gzip, Client-Entry gzip). Der Client-Entry ohne `schema` soll im einstelligen KB-Bereich bleiben.

### 8.4 Name

**`dungeonmaker-js` (Owner-Entscheidung)**, kein Scope. Am 2026-10-31 gegen die npm-Registry geprüft: `dungeonmaker-js` ist **frei**. Frei sind auch `dungeonmaker`, `dungeon-maker`, `dungeonmaker.js`, `dungeon-maker-js` und `dungeonmaker-wasm`. Die Registry-Suche nach »dungeonmaker« liefert kein verwandtes Paket.

Einordnung der Alternativen:

- `dungeonmaker`: kürzer, klingt aber nach dem offiziellen Upstream (vgl. §9.6). Eher nicht.
- `dungeonmaker-wasm`: technisch präzise, sagt aber nichts über die JS-API und die CLI.
- `dungeonmaker.js`: entspricht dem Repo-Namen. Punkte in Paketnamen sind erlaubt, aber unüblich und beim Tippen fehleranfällig.

`dungeonmaker-js` ist die beste Wahl: Der Name passt zum Repo, sagt »Portierung« statt »Original« und funktioniert als Binary-Name für `pnpm dlx dungeonmaker-js …` bzw. `npx dungeonmaker-js …`. Hinweis: npm blockiert nach dem ersten Publish ähnliche Schreibweisen (`dungeonmakerjs`, `dungeonmaker.js`) für Dritte. Das ist ein willkommener Nebeneffekt. Bis zum ersten Release kann der Name noch weggeschnappt werden; **[Vorschlag]** früh einen `0.0.1`-Platzhalter publizieren, sobald M1 steht.

### 8.5 Demo- und Doku-Site (GitHub Pages, Englisch)

Die Site ersetzt das alte `dist/` + `gh-pages` und ist zugleich die Visitenkarte der Library. Sie ist komplett auf **Englisch**. Aufbau **[Vorschlag]**: ein Vite-Projekt in `site/`, das gegen das lokale Workspace-Package baut (die Demo benutzt also immer exakt den aktuellen Stand) und per `pages.yml` über GitHub Actions deployt wird.

| Seite | Inhalt |
|---|---|
| **Playground** (Startseite) | Preset-Auswahl, Seed-Feld + »Reroll«, Canvas mit Zoom/Pan, Layer-Toggles (Räume einfärben, Entities), Animations-Player für `steps`, Generierungszeit |
| **Design-Editor** | JSON-Editor mit Schema-Autocomplete und Live-Validierung; »Legacy-Design einfügen« konvertiert alten Text zu JSON |
| **Download-Aktion** an jedem erzeugten Dungeon | Menü mit `.dungeon.json`, `.png`, `.tmj` (Tiled), `.txt`, `.bin`, dazu »Copy CLI command«: der passende `pnpm dlx dungeonmaker-js generate …`-Aufruf (umschaltbar auf `npx`, `yarn dlx`, `bunx`), der genau diesen Dungeon reproduziert. Der Download nutzt dieselben Exporter wie die CLI (§7.4). |
| **Getting Started** | Was die Library ist (Kurzbeschreibung + Herkunft/Credits), Install, Quickstart Browser, Quickstart CLI, Bundler-Hinweise |
| **Guides** | »Generate offline, ship data« (Lizenzrezept, §9.4), Design-Konzepte (Crawler/Tunneler/Roomies kurz erklärt, nach dem Upstream-Manual), Orientierung & Cell-Legende |
| **API Reference** | TypeDoc-generiert, in die Site eingebunden |
| **Config Reference** | aus `design.schema.json` generiert: jedes Feld mit Typ, Default, Erklärung und Upstream-Record-Kürzel |
| **Dungeon File Format** | Spezifikation von `*.dungeon.json` (CC0, §9.4) |
| **License** | GPL-Hinweis in Klartext, was das für Nutzer heißt, Credits an Peter Henningsen |

Das README im Repo bleibt kurz (Pitch, Install, ein Beispiel für Browser und CLI, Link zur Site, Lizenzhinweis) und ebenfalls auf Englisch, weil es auf npm und GitHub erscheint.

### 8.6 CI & automatischer Release (Owner-Entscheidung)

**Regel:** Steigt die `version` in `packages/dungeonmaker-js/package.json` auf `master` über die zuletzt veröffentlichte Version, baut CI das Package, testet es, veröffentlicht es auf npm, setzt den Git-Tag `v<version>` und legt ein GitHub-Release an. Niemand muss lokal `publish` tippen; der Versions-Bump *ist* der Release-Knopf.

**Workflows:**

| Datei | Trigger | Aufgabe |
|---|---|---|
| `ci.yml` | Push + PR | install (`pnpm install --frozen-lockfile`), lint, typecheck, Tests (Node + Browser), Wasm-Drift-Check, `publint`/`attw`, Pack-Smoke-Test |
| `release.yml` | Push auf `master`, der `packages/dungeonmaker-js/package.json` berührt; zusätzlich `workflow_dispatch` für Retry | Version prüfen → bauen → testen → publishen → taggen → GitHub-Release |
| `pages.yml` | Push auf `master` (Site oder Package geändert) | Site bauen und nach GitHub Pages deployen |

**Ablauf von `release.yml`** (Skizze, wird in P1 umgesetzt):

```yaml
name: release                       # Dateiname MUSS release.yml bleiben – npm prüft ihn (s. u.)
on:
  push: { branches: [master], paths: ['packages/dungeonmaker-js/package.json'] }
  workflow_dispatch:
concurrency: { group: release, cancel-in-progress: false }
permissions: { contents: read }

jobs:
  check:                            # entscheidet nur, ob veröffentlicht wird
    runs-on: ubuntu-latest
    outputs: { publish: …, version: …, dist-tag: … }
    steps:
      - checkout
      - version = node -p "require('./packages/dungeonmaker-js/package.json').version"
      - existiert dungeonmaker-js@version schon auf npm?          → publish=false (still beenden)
      - version ≤ höchste veröffentlichte Version?                 → Fehler (versehentlicher Downgrade)
      - Prerelease (1.2.0-beta.1)? → dist-tag=next, sonst latest

  publish:
    needs: check
    if: needs.check.outputs.publish == 'true'
    runs-on: ubuntu-latest           # GitHub-hosted ist Pflicht für Trusted Publishing
    environment: npm                 # Name muss zur npm-Konfiguration passen
    permissions: { contents: write, id-token: write }
    steps:
      - checkout
      - jdx/mise-action              # Node + pnpm aus mise.toml
      - pnpm install --frozen-lockfile
      - pnpm -r build && pnpm -r test && publint && attw
      - pnpm --filter dungeonmaker-js pack --pack-destination out/
      - npm --version ≥ 11.5.1 sicherstellen, sonst Abbruch
      - npm publish out/dungeonmaker-js-<version>.tgz --access public --tag <dist-tag>
      - git tag v<version> && git push origin v<version>
      - gh release create v<version> --generate-notes out/*.tgz source.tar.gz dungeonmaker.wasm.map
```

**Warum `pnpm pack` + `npm publish <tarball>` statt `pnpm publish`:** Gebaut und gepackt wird mit pnpm (Workspace-Protokolle werden dabei aufgelöst, Lockfile gilt). Den eigentlichen Upload macht die npm-CLI, weil der tokenlose OIDC-Handshake (Trusted Publishing) dort spezifiziert ist und npm ≥ 11.5.1 verlangt. Berichte aus der Praxis zeigen, dass `pnpm publish` einen gescheiterten OIDC-Austausch nur als Warnung »Skipped OIDC« meldet und dann trotzdem weitermacht. Ein grüner Lauf beweist dort also nicht, dass der Release vertrauenswürdig war. Das Tarball explizit mit npm hochzuladen ist robust und hält die pnpm-Welt sonst unberührt. Falls pnpm das bis zur Umsetzung sauber beherrscht (in P1 prüfen), wird auf `pnpm publish` vereinfacht.

**Was Trusted Publishing bringt:** kein `NPM_TOKEN`-Secret im Repo, das leaken könnte. Jeder Release bekommt automatisch eine **Provenance-Attestation**: npm zeigt dann »built and signed on GitHub Actions« mit Link auf genau diesen Workflow-Lauf. Das passt nebenbei gut zur Quellenpflicht aus §9.3. Voraussetzung dafür sind ein öffentliches Repo und ein öffentliches Package.

**Henne-Ei-Problem beim ersten Release:** Trusted Publishing konfiguriert man in den Settings eines **bestehenden** Packages auf npmjs.com. Darum wird `0.0.1` einmalig lokal veröffentlicht. Ab `0.0.2` übernimmt CI. Das passt zu »sobald 0.0.1 erreicht wird«.

#### Einrichtung: Was der Owner wo tun muss

Einmalig, in dieser Reihenfolge. Die Repo-seitigen Dateien (`release.yml`, `package.json`-Felder, `RELEASING.md`) liefere ich in P0/P1. Diese Anleitung kommt dann zusätzlich als `RELEASING.md` ins Repo.

**A — npmjs.com: Konto vorbereiten (vor P1)**
1. Auf npmjs.com einloggen bzw. registrieren und **2FA aktivieren** (Account → Two-Factor Authentication → »Authorization and writes«).

**B — lokal: `0.0.1` einmalig veröffentlichen (am Ende von P1)**
2. Im Repo: `npm login`. Der Login landet in `~/.npmrc`, und pnpm benutzt dieselbe Datei.
3. Auf `master` mit sauberem Working Tree: `pnpm --filter dungeonmaker-js build`, dann `pnpm --filter dungeonmaker-js publish --access public`. npm fragt nach dem 2FA-Code. pnpm prüft dabei selbst, dass der Branch `master` heißt und nichts uncommittet ist.
4. Kontrolle: `pnpm view dungeonmaker-js` zeigt `0.0.1`.

**C — npmjs.com: Trusted Publisher eintragen (direkt nach B)**
5. npmjs.com → Package `dungeonmaker-js` → **Settings** → Abschnitt **Trusted Publisher** → **GitHub Actions** wählen.
6. Felder (case-sensitive, npm validiert beim Speichern *nicht*, Tippfehler zeigen sich erst beim nächsten Release):
   - Organization or user: `spearwolf`
   - Repository: `dungeonmaker.js`
   - Workflow filename: `release.yml` (nur der Dateiname, kein Pfad)
   - Environment name: `npm`
   - Allowed actions: **`npm publish` anhaken.** Ohne diesen Haken ist nur »staged publish« erlaubt, das eine manuelle Freigabe auf npmjs.com verlangt. Damit wäre der Release nicht mehr automatisch.
7. Speichern. **Frist:** Eine neue Trusted-Publisher-Konfiguration verfällt, wenn sie nicht innerhalb von **2 Tagen** einmal erfolgreich benutzt wird. Also C erst erledigen, wenn `0.0.2` zeitnah ansteht, oder danach direkt einen kleinen `0.0.2`-Bump pushen.

**D — GitHub: Repository-Settings (`github.com/spearwolf/dungeonmaker.js/settings`)**
8. **Environments** → *New environment* → Name `npm` → *Deployment branches and tags*: »Selected branches and tags« → Regel `master`. Damit kann nur `master` veröffentlichen, auch wenn jemand den Workflow auf einem anderen Branch startet. *Required reviewers* bewusst **nicht** setzen, sonst wartet jeder Release auf einen Klick.
9. **Actions → General → Workflow permissions:** »Read repository contents and packages permissions« (Default) lassen. Der Release-Job fordert `contents: write` und `id-token: write` selbst an.
10. **Pages** → *Build and deployment* → Source: **GitHub Actions** (statt »Deploy from a branch«). Erst umstellen, wenn `pages.yml` existiert (P5). Bis dahin läuft die alte Demo vom `gh-pages`-Branch weiter.
11. Empfohlen: **Rules → Rulesets** für `master`: Status-Check `ci` muss grün sein. Wer direkt auf `master` pusht, statt PRs zu mergen, kann das weglassen; der Release-Job testet ohnehin selbst noch einmal vollständig.
12. Repo muss **öffentlich** bleiben, sonst entfällt die Provenance.
13. **Secrets: keine.** Kein `NPM_TOKEN` anlegen.

**E — npmjs.com: Tokens abschalten (nach dem ersten erfolgreichen CI-Release `0.0.2`)**
14. Package → **Settings → Publishing access** → »Require two-factor authentication and **disallow tokens**« → *Update*. Trusted Publishing ist davon nicht betroffen (OIDC ist kein Token), aber ein geleakter Token kann ab dann nichts mehr veröffentlichen.
15. Optional lokal `npm logout`, falls der Rechner sonst keine npm-Publishes braucht.

**Danach — ein Release im Alltag:**

```sh
# Version erhöhen (patch | minor | major | prerelease --preid beta)
pnpm --filter dungeonmaker-js exec npm version patch --no-git-tag-version
# CHANGELOG.md ergänzen, committen, pushen
git commit -am "release: dungeonmaker-js 0.0.3" && git push
```

CI erledigt den Rest. Sichtbar wird das unter *Actions → release*, auf npmjs.com (mit Provenance-Badge) und unter *Releases* im Repo. Wird nur eine andere Zeile der `package.json` geändert, endet der `check`-Job still, weil die Version schon veröffentlicht ist.

**Fallstricke, die der Workflow abfängt bzw. die man kennen sollte:**
- `repository.url` in `packages/dungeonmaker-js/package.json` muss **exakt** `git+https://github.com/spearwolf/dungeonmaker.js.git` lauten, sonst lehnt npm die Provenance ab. Dazu kommt `"directory": "packages/dungeonmaker-js"`.
- Den Workflow nie umbenennen, ohne die npm-Konfiguration (Schritt 6) anzupassen.
- Self-hosted Runner funktionieren mit Trusted Publishing nicht.
- Ein Versions-*Downgrade* oder eine schon vergebene Version bricht den Release mit einer klaren Meldung ab, statt still etwas Falsches zu veröffentlichen. npm erlaubt ohnehin nie, eine Version zweimal zu vergeben, auch nicht nach `unpublish`.

---

## 9. Lizenz — Bewertung

> Das hier ist eine sorgfältige Einordnung, keine Rechtsberatung. Wer das Package
> kommerziell oder in Kundenprojekten einsetzen will, lässt §9.4 von jemandem mit
> Lizenzrecht-Mandat gegenlesen.

### 9.1 Ist die Transformation selbst erlaubt? — Ja.

Die GPL erlaubt ausdrücklich, das Programm zu **verändern**, in eine andere Form zu **übersetzen** und das Ergebnis **weiterzugeben**. GPLv2 §2/§3 und GPLv3 §5/§6 regeln genau diesen Fall. Ein Cross-Compile nach WebAssembly ist rechtlich nichts anderes als ein Compile nach x86: Es entsteht **Object Code** eines abgeleiteten Werks. Ein JS-Wrapper drumherum und eine Neuverpackung als npm-Package ändern daran nichts. Die GPL kennt auch keine Beschränkung auf Plattformen oder Laufzeitumgebungen.

Dieses Repo tut seit 2014/2015 bereits genau das (asm.js-Build, veröffentlicht auf `gh-pages`). Neu ist nur die Verbreitung über npm und damit die Zahl möglicher Empfänger.

### 9.2 Welche GPL-Version gilt?

Der Header von `DungeonMaker.h` sagt nur »General Public License«, ohne Versionsnummer. Die mitgelieferte `COPYING` ist **leer (0 Bytes)**. Für diesen Fall regeln beide Lizenzen dasselbe: Nennt ein Programm keine Versionsnummer, darf der Empfänger **jede je von der FSF veröffentlichte Version** wählen (GPLv2 §9 letzter Satz, GPLv3 §14). Damit ist `GPL-2.0-or-later`, die Lizenz dieses Repos, sauber gedeckt, und `GPL-3.0-or-later` wäre es ebenso.

**[Vorschlag]** Das Package als `GPL-3.0-or-later` lizenzieren. Grund: GPLv3 §6(d) erlaubt ausdrücklich, Object Code von einem Ort (npm) und den zugehörigen Quellcode von einem *anderen* Server (GitHub-Tag) bereitzustellen, solange neben dem Object Code klar steht, wo die Quellen liegen. GPLv2 §3 ist hier strenger: Quellen beilegen, ein schriftliches Angebot über drei Jahre, oder »gleichwertiger Zugang am selben Ort«. Mit v3 kann das npm-Package schlank bleiben, wie in §8.3 verlangt, ohne dass die Compliance wackelt. Die eigenen Wrapper-Dateien dürfen weiter `or-later` tragen; das Gesamtwerk wird unter v3 verteilt.

### 9.3 Pflichten beim Verteilen — die Compliance-Checkliste

Das sind konkrete Aufgaben. Sie wandern in Phase 0 bzw. Phase 5 des Schlachtplans:

| Pflicht | Umsetzung |
|---|---|
| **Lizenztext beilegen** (v2 §1, v3 §4) | Vollständiger GPL-Text als `LICENSE` im Repo *und* im npm-Package. Die leere Upstream-`COPYING` reicht nicht. |
| **Copyright-Vermerke erhalten** | Header von `DungeonMaker.{h,cpp}` bleiben unangetastet; `AUTHORS`/`NOTICE` nennt Peter Henningsen / alifegames als Urheber des Kerns. Ein Lizenz-Banner (`/*! … GPL-3.0-or-later, includes DungeonMaker © Peter Henningsen */`) steht im Glue-JS, das Bundler erhalten. |
| **Änderungen kenntlich machen** (v2 §2a, v3 §5a) | Jede Datei unter `native/patches/` und die Unity-TU (PRNG-Umleitung) tragen einen Header mit *was*, *warum* und *Datum*. Der Vendor-Code selbst bleibt byte-gleich, die Modifikationen sind dadurch trivial nachweisbar. Die README sagt: »enthält eine modifizierte Fassung von DungeonMaker 2.05«. |
| **Corresponding Source** (v3 §1, §6) | Das ist *mehr* als der C++-Code: Bridge, Patches, Unity-TU, `build.sh` samt gepinntem Emscripten-Image-Tag, TS-Quellen. Kurz: alles, was nötig ist, um genau dieses `.wasm` und dieses JS neu zu bauen. Jede npm-Version verweist auf ihren Git-Tag (`repository` + `gitHead` in `package.json`, plus ein Satz in der README). Die Tags werden nie gelöscht. |
| **Keine Zusatzbeschränkungen** (v2 §6, v3 §10) | Keine Nutzungsbedingungen, keine obfuskierten Builds ohne Quellen. Minifizierung ist erlaubt, solange die Quellen verfügbar sind. |
| **Konsistente Metadaten** | `"license": "GPL-3.0-or-later"` in `package.json`, SPDX-Header in eigenen Quelldateien. `publint` prüft das Feld mit. |

**[Vorschlag]** Vorsichtsvariante, falls das Repo einmal umziehen oder verschwinden könnte: zusätzlich ein `source.tar.gz` (Vendor + `native/` + TS-Quellen, geschätzt deutlich unter 200 KB) als Asset an jedes GitHub-Release hängen. Das kostet nichts und macht die Quellenpflicht unabhängig von der Repo-Historie.

### 9.4 Was bedeutet das für Projekte, die das Package nutzen? — Hier liegt das eigentliche Risiko

Nicht die Transformation ist heikel, sondern die **Ansteckung nach unten**:

- **Web-Bundles sind Verteilung.** Anders als Server-Code (wo die GPL ohne AGPL nicht greift) wird JS/Wasm an den Browser *ausgeliefert*. Wer eine Website mit diesem Package betreibt, verteilt GPL-Object-Code an jeden Besucher und hat die Pflichten aus §9.3 selbst.
- **Ist die App dann ein abgeleitetes Werk?** Für Code, der das Package importiert und im selben Bundle läuft: nach FSF-Lesart **ja** (Combined Work, wie beim Linken), die App müsste GPL-kompatibel lizenziert sein. Die Worker-Grenze mit `postMessage` ist eine **Grauzone**. Die FSF-FAQ behandelt Kommunikation über Pipes oder Sockets zwischen getrennten Programmen meist als »arm's length«, aber nicht, wenn komplexe interne Datenstrukturen ausgetauscht werden und beides gemeinsam ausgeliefert wird. Darauf sollte niemand ein Geschäftsmodell bauen.
- **Konservative Faustregel für die README:** »Wer dieses Package in eine ausgelieferte Anwendung einbaut, sollte davon ausgehen, dass die Anwendung unter einer GPL-kompatiblen Lizenz stehen muss.«
- **Was ohne Ansteckung geht:** Dungeons **offline vorgenerieren** (Node-CLI aus §7.5 oder `core` im Build-Schritt) und nur die erzeugten Karten ausliefern. Die Ausgabe eines GPL-Programms unterliegt grundsätzlich nicht der GPL, solange sie keinen Programmcode enthält (GPL-FAQ »Is there some way that I can GPL the output people get from use of my program?«). Eine Tilemap aus `cells` ist Daten, kein Code. Das ist ein echter, legitimer Weg für proprietäre Spiele. Auf der Doku-Site wird er zum prominenten Rezept: »Generate offline, ship data«.

Damit die exportierten Dateien wirklich sauber bleiben, gelten für §7.4 drei Regeln:

1. **Kein Code in Exportdateien.** Nur Karte, Layer, Metadaten und Legende. Die Legende enthält Bezeichner wie `"open"` oder `"door"`, also Fakten, keinen Code.
2. **Upstream-Designs nur per Referenz.** Die elf Presets stammen aus der GPL-Distribution. Ob reine Parameterdateien überhaupt urheberrechtlich schutzfähig sind, ist zweifelhaft, aber es gibt keinen Grund, das auszutesten. Eine Exportdatei nennt Presets deshalb nur beim Namen (`"source": { "preset": "design3A" }`). Eigene Designs werden nur auf ausdrücklichen Wunsch eingebettet (`--embed-design`), sonst nur als Hash.
3. **Das Format ist frei, die Library nicht.** Wer die Dateien importiert, soll dafür *nicht* dieses Package brauchen; dessen Reader-Code wäre GPL. **[Vorschlag]** Die Formatspezifikation (Doku-Seite + `dungeon.schema.json`) wird separat unter **CC0** gestellt. Das geht, weil der Owner sie selbst schreibt und sie keinen Upstream-Code enthält. So kann jeder einen eigenen Importer in jeder Sprache und unter jeder Lizenz schreiben.

### 9.5 Optionen, falls die GPL-Bindung stört

**Owner-Entscheidung (2026-10-31):** GPL ist für jetzt akzeptiert (Option 3). Der Upstream-Autor wird vorerst nicht angefragt; Option 1 bleibt für später offen. Mit der Offline-CLI deckt Option 3 auch den Fall »Dungeons in ein nicht-GPL-Projekt übernehmen« ab.

1. **Upstream anfragen (zurückgestellt):** Peter Henningsen bzw. alifegames bot laut Header eine kommerzielle Lizenz an. Die Firma ist vermutlich nicht mehr aktiv, aber eine Mail an den Autor mit der Bitte um eine Zusatzlizenz (MIT/Apache) für diese Portierung kostet nichts. Eine schriftliche Zusage des alleinigen Urhebers würde das Problem vollständig lösen. Vorher prüfen, ob es weitere Mitautoren gibt (`AUTHORS`, `ChangeLog`).
2. **Clean-Room-Neuimplementierung:** Das Verfahren (Crawler/Tunneler/Roomies, Generationen, Wahrscheinlichkeitsprofile) ist eine Idee und urheberrechtlich nicht geschützt, der Code schon. Eine Neuimplementierung allein aus dem Manual, *ohne* Blick in `DungeonMaker.cpp`, könnte frei lizenziert werden. Das ist ein eigenes Projekt und kein Teil dieses Plans; das JSON-Modell und die Presets aus Phase 2 wären aber direkt wiederverwendbar (das Designformat beschreibt Parameter und ist selbst kein Code).
3. **Status quo akzeptieren (gewählt):** Für eigene Open-Source-Projekte und das Offline-Vorgenerierungs-Rezept ist die GPL kein Hindernis.

### 9.6 Namensnutzung

»DungeonMaker« ist der Projektname des Upstreams. Eine eingetragene Marke ist nicht bekannt, aber Fairness und Klarheit sprechen für eine eindeutige Kennzeichnung: In der README steht »inoffizielle WebAssembly-Portierung von DungeonMaker 2.05 von Peter Henningsen«, mit Link auf das SourceForge-Projekt. Ein offizieller Status wird nicht suggeriert.

---

## 10. Phasen, Meilensteine und Schlachtplan

Größen: S ≈ eine fokussierte Session, M ≈ zwei bis drei, L ≈ mehr. Die Reihenfolge ist auf frühes Risiko-Abräumen optimiert: Der Wasm-Port (P1) ist der größte Unbekannte und kommt deshalb direkt nach dem Fundament.

### Phase 0 — Sichern & Fundament (S)
1. `master` als `legacy-2014` taggen, `gh-pages` als `legacy-2014-demo`.
2. Tarball nach `native/vendor/dungeonmaker-2.05/` entpacken (nur Quellen, Manual, Designs, kein Autotools-Ballast); 2014er-Dateien aus `master` entfernen.
3. pnpm-Workspace, `tsconfig.base.json`, Linter, `.gitignore`/`.gitattributes`, `mise.toml` für Node/pnpm.
4. CI-Skelett: install, lint, typecheck.
5. Lizenz-Fundament (§9.3): vollständiger GPL-3.0-Text als `LICENSE`, `NOTICE`/`AUTHORS` mit Upstream-Urheber, SPDX-Header-Konvention, Patch-Header-Vorlage.

**M0:** Workspace baut leer grün in CI, Legacy ist getaggt, Vendor-Code liegt diffbar im Repo.

### Phase 1 — Wasm-Kern (L) ← größtes Risiko
1. `native/build.sh` mit gepinntem `emscripten/emsdk`-Image, Flags aus §5.1, Ausgabe nach `packages/dungeonmaker-js/wasm/` + `BUILD-INFO.json`.
2. `dungeonmaker_unity.cpp` + `prng.h` (§5.3); den Vendor-Code kompilierbar machen (Warnungen, `-std`).
3. `bridge.cpp` mit C-ABI (§5.2): Statuscodes statt `exit`, `uint8_t`-Zellen north-up.
4. `core`-Entry in TS: Modul laden, `generate(text, seed)` → `{ width, height, cells }` als frische Kopie.
5. Erste Tests in Node: jedes der elf Designs generiert ohne Abort; gleicher Seed → gleicher Hash; Parse-Fehler → Status 1 statt Prozessende; Orientierungstest (ein Design mit Öffnung `NO` hat die Lücke in Zeile 0).
6. Reproduzierbarkeit des Wasm-Builds prüfen → CI-Drift-Check einrichten (§8.1). Größe messen und Budget festlegen.
7. Release-Pipeline (§8.6): `release.yml`, `package.json`-Metadaten (`repository`, `publishConfig`, `license`), `RELEASING.md`.
8. Namen sichern: Der Owner veröffentlicht `dungeonmaker-js@0.0.1` lokal und trägt den Trusted Publisher ein (§8.6, Schritte A–D). Danach testet ein `0.0.2`-Bump die Pipeline Ende-zu-Ende.

**M1:** `pnpm --filter dungeonmaker-js test` generiert alle Presets deterministisch in Node; das committete Wasm ist durch CI gegen `native/` abgesichert; `0.0.2` wurde allein durch einen Versions-Bump von CI veröffentlicht, mit Provenance.

### Phase 2 — Design-Config (L)
1. Das Textformat vollständig erfassen (Manual `manDesign.txt` + `Config::AcceptDesign` als Wahrheit, nicht die Kommentare in den Beispieldesigns).
2. `parseDesignText()` (Text → JSON) und `toDesignText()` (JSON → Text), inklusive Terminator-Logik und Achsentausch an genau einer Stelle.
3. TypeBox-Modell → Typen, `design.schema.json`, `validateDesign()`; semantische Checks (§6.3).
4. Presets aus den elf Vendor-Designs generieren (Script) und als JSON committen.
5. **Round-Trip-Test:** pro Design × 5 Seeds `cells(text) === cells(toDesignText(parseDesignText(text)))`.
6. Negative Tests: kaputte Configs liefern `DesignValidationError` mit JSON-Pfad, nie einen Abort.

**M2:** Alle elf Legacy-Designs bestehen den byte-genauen Round-Trip; das Schema validiert alle Presets und lehnt eine Sammlung kaputter Fixtures ab.

### Phase 3 — Worker & Client-API (M)
1. Versioniertes Message-Protokoll (`ready` / `create` / `result` / `error`, jeweils mit `id` und Protokollversion).
2. Worker: Request → `toDesignText` → `core` → `slice` → `postMessage(…, [buffers])`. Abort fangen → Modul neu instanziieren.
3. Client: lazy Spawn, FIFO-Queue, `timeout` + `AbortSignal` → terminate + respawn, `dispose()`, `createDungeon()` mit Default-Instanz.
4. Escape Hatches `worker`/`wasmUrl` und ein dokumentiertes Rezept für CSP-strikte Umgebungen.
5. Browser-Tests (Vitest Browser Mode, drei Engines): Parallelaufrufe, Timeout, Abort, Crash-Recovery, Transfer (`cells.buffer.byteLength === width*height`).
6. Smoke-Fixtures: Mini-Projekte mit Vite und webpack, die das *gepackte* Tarball (`pnpm pack`) konsumieren. Das beweist, dass die Worker- und Wasm-Auflösung beim Consumer funktioniert.

**M3:** `await createDungeon({ design: presets.design3A, seed: 42 })` funktioniert in Vite- und webpack-Fixtures ohne Konfiguration; kein Fehlerpfad lässt ein Promise hängen.

### Phase 4 — Layer, Export & Node-CLI (L)
*Kann parallel zu P3 starten, sobald P2 steht; die CLI hängt nur an `core`, nicht am Worker.*
1. `rooms`-Layer (Bridge + TS).
2. Patch für `PlonkDownStuff`/`PutPlonkOnMap`; `entities: 'list' | 'baked'`; der `population`-Teil der Config wird wirksam.
3. `steps`-Layer (Movie), mit Größenwarnung in der Doku.
4. `render`-Entry: `toAscii`, `toImageData`, `drawToCanvas`, `toTiles`.
5. `export`-Entry (§7.4): Dungeon-JSON inkl. `dungeon.schema.json`, PNG-Encoder ohne Dependency, Tiled `.tmj`, ASCII, Raw. Die Exportregeln aus §9.4 (kein Code, Presets nur per Referenz) sind als Tests abgesichert.
6. `node`-Entry + CLI (§7.5): `generate`, `presets`, `validate`, `convert`, `schema`; Seeds-Ranges, `--name`-Templates, `--manifest`; Exit-Codes.
7. CLI-Tests: Snapshot der erzeugten Dateien für feste Seeds; `pnpm dlx`- und `npx`-Smoke-Test gegen das gepackte Tarball in einem leeren Verzeichnis.

**M4:** `pnpm dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj` erzeugt in einem leeren Verzeichnis reproduzierbar dieselben Dateien wie der Exporter im Browser; die `.tmj` öffnet sich fehlerfrei in Tiled.

### Phase 5 — Site, Doku, Release (M)
1. `site/` (Vite, Englisch): Playground, Design-Editor, **Download-Menü + »Copy CLI command« an jedem Dungeon**, Layer-Toggles, Animations-Player (§8.5).
2. Doku-Seiten: Getting Started, Guides (inkl. »Generate offline, ship data«), API Reference (TypeDoc), Config Reference (aus dem Schema), Dungeon File Format (CC0), License.
3. `pages.yml` deployt die Site per GitHub Actions; der alte `gh-pages`-Branch wird danach nicht mehr gepflegt (getaggt in P0).
4. README (Englisch, kurz), `CHANGELOG.md`, `publint`/`attw` grün, Versions-Bump auf `1.0.0` → CI veröffentlicht. Compliance-Check vor dem Publish: Lizenz-Banner im Glue, `LICENSE`/`NOTICE` im Tarball, Quellverweis auf den Tag, `source.tar.gz` am GitHub-Release (§9.3).
5. Root-`CLAUDE.md` an die neue Struktur anpassen.

**M5:** `dungeonmaker-js@1.0.0` ist auf npm, die Site läuft auf Pages, und ein frisches Vite-Projekt kommt mit der Doku allein in unter fünf Minuten zum ersten Dungeon, ebenso ein leeres Verzeichnis per `pnpm dlx` zur ersten PNG.

### Später / bewusst nicht in v1
- Worker-Pool (`concurrency: n`) im Browser und `--jobs n` in der CLI
- `inline`-Variante (Wasm als Base64 im Glue, `-sSINGLE_FILE`) für Umgebungen ohne Asset-Pipeline
- Wechsel auf wasi-sdk, falls das Größenbudget drückt
- Streaming von `steps` während der Generierung
- Weitere Exportformate (LDtk, Godot `TileMap`-Ressource), falls Bedarf entsteht
- Anfrage beim Upstream-Autor wegen einer Zusatzlizenz (§9.5)

### Abhängigkeiten auf einen Blick

```
P0 ──▶ P1 ──▶ P2 ──┬──▶ P3 ──┬──▶ P5
                   └──▶ P4 ──┘
```

---

## 11. Entscheidungen des Owners (2026-10-31)

| Thema | Entscheidung |
|---|---|
| Lizenz | GPL ist akzeptiert. Den Upstream-Autor vorerst nicht anfragen, vielleicht später. Vorschlag für die Version: `GPL-3.0-or-later` (§9.2). |
| Package-Name | `dungeonmaker-js`, ohne `@spearwolf`-Scope (§8.4) |
| Orientierung | »Norden soll da sein, wo Norden ist«: Norden oben (§5.2) |
| Wasm-Artefakt | wird committet, abgesichert durch einen CI-Drift-Check (§8.1) |
| Legacy-Dateien | taggen und aus `master` entfernen; die Demo bleibt als Funktion erhalten und wird erneuert (§8.1, §8.5) |
| Demo-Site | GitHub Pages, Englisch, visuelle Demo + Kurzbeschreibung + API-Doku + alles, was zu einer kleinen Library gehört (§8.5) |
| Node-CLI | parallel zum Browser-Package; lokal erzeugte Dungeons sind lizenzfrei importierbar (§7.5, §9.4) |
| Download | jeder Dungeon in der Demo hat eine Download-Aktion (§8.5) |
| Package-Manager | pnpm statt npm, wo es Sinn macht (§8.2) |
| Release | automatisch, sobald die Package-Version auf `master` steigt, ab `0.0.1` (§8.6) |

Noch offen, aber ohne Einfluss auf den Start von P0/P1: die Cell-Nummerierung (§5.2, Vorschlag: Library-Enum-Reihenfolge) und GPL-2.0- vs. 3.0-or-later (§9.2, Vorschlag: v3). Beides wird spätestens in P1 bzw. vor dem ersten Publish fixiert.

## 12. Festgelegt durch mich (zum Gegenlesen)

- Vier Entry-Schichten `client`/`worker`/`core`/`node` plus `export`; `core` läuft auch in Node.
- CLI im selben Package statt eines eigenen `dungeonmaker-cli`, damit Wasm, Presets und Version nie auseinanderlaufen.
- Emscripten im gepinnten Docker-Image; C-ABI ohne embind.
- JSON → Designtext in TS; der Original-Parser bleibt die einzige `Config`-Quelle.
- Eigener PRNG statt libc-`rand()`; Seed-Bereich `1 … 2³²−1`.
- Asserts bleiben aktiv; Abort → Neuinstanziierung, Hänger → Timeout + Respawn.
- TypeBox als Quelle für Typen + Schema; strukturelle Validierung optional, semantische immer.
- Binäres Wire-Format, Layer opt-in, Konverter und Exporter als reine Funktionen, geteilt zwischen CLI und Demo.
- Exportdateien: selbsterklärend (Legende), ohne Code, Upstream-Presets nur per Referenz; Formatspezifikation unter CC0.
- `tsc`-Emit ohne Bundling, ESM only, ES2022.
- Site als Vite-Projekt in `site/`, TypeDoc für die API-Referenz.
- npm Trusted Publishing (OIDC) statt `NPM_TOKEN`; Upload per `npm publish <tarball>` nach `pnpm pack`; `0.0.1` einmalig lokal.
- Versionsbump von Hand bzw. per `npm version`, kein Changesets; Release-Notes aus `--generate-notes` + `CHANGELOG.md`.
- Tags: `v<version>` für npm-Releases, `legacy-2014*` für den Altbestand.
