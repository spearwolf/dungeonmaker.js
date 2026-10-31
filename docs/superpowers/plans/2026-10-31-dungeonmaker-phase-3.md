# dungeonmaker-js Phase 3 (Worker & Client-API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `await createDungeon({ design: presets.design3A, seed: 42 })` generiert im Browser in einem vom Package verwalteten Web Worker, funktioniert in Vite- und webpack-Projekten ohne Konfiguration, und kein Fehlerpfad lässt ein Promise hängen.

**Architecture:** Drei Schichten über dem bestehenden `core`: ein versioniertes Message-Protokoll (`src/protocol.ts`), ein Worker-Handler als reine, in Node testbare Funktion plus ein dünner Worker-Entry (`dist/worker.js`), und ein Client (`createDungeonMaker`, `createDungeon`) mit Lazy Spawn, FIFO-Queue, Timeout, Abort, Respawn und `dispose()`. Der Client hängt nur an einer schmalen Worker-Schnittstelle; dadurch laufen Queue- und Fehlerlogik in Node mit Fake-Workern und Fake Timers, die echte Worker-Strecke in Vitest Browser Mode (Chromium, Firefox, WebKit), die Bundler-Auflösung in Vite- und webpack-Fixtures gegen das gepackte Tarball.

**Tech Stack:** TypeScript 7 (`tsc`-Emit, ESM only, ES2022), Vitest 5.0.5 (Node + Browser Mode mit `@vitest/browser-playwright` 5.0.5), Playwright 1.64.1, Vite 8.3.5 und webpack 5.112.2 + webpack-cli 7.3.1 (nur in den Fixtures), Biome 2, pnpm 12, Node 26.

**Spec:** `docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md` (Phase 3 aus §10; API §4, Robustheit §5.4, Validierung §6.3, Ausgabe §7.1, Toolchain §8.2, Package §8.3). Vorgänger: `docs/superpowers/plans/2026-10-31-dungeonmaker-phase-2.md`.

## Global Constraints

- Arbeit auf einem Branch `phase-3-worker-client` von `master`; nichts davon wird in dieser Phase veröffentlicht (kein Versions-Bump).
- Determinismus-Vertrag unverändert: gleiche Designtext + gleicher Seed = byte-identische Zellen. `test/golden/native-fnv.json` wird nicht angefasst. Das `.wasm` bleibt byte-gleich; nur das Glue (`wasm/dungeonmaker.js`) und `BUILD-INFO.json` ändern sich in Task 1.
- Native-Änderungen (`native/build.sh`) werden zusammen mit dem neu gebauten `wasm/` committet (`sh native/build.sh`, Container); CI-Job `wasm-drift` muss grün bleiben.
- Fehler kommen **immer** als Rejection, nie als synchroner Throw aus `create()`/`createDungeon()`, nie als hängendes Promise (§4). Klassen: `DesignValidationError`, `GenerationError`, `TimeoutError`, `WorkerError`, Abbruch = `signal.reason` (Default `DOMException` `AbortError`).
- `tsc`-Emit ohne Bundling, ESM only, `sideEffects` nur für `./dist/worker.js` (§8.2). Die Muster `new Worker(new URL('../worker.js', import.meta.url), { type: 'module' })` und `new URL('../../wasm/dungeonmaker.wasm', import.meta.url)` stehen wörtlich im ausgelieferten Code.
- **Bundler-Regeln (beim Planen per Probe mit Vite 8.3.5 und webpack 5.112.2 belegt):** Jeder `import('node:…')` in Code, den ein Browser-Bundler erreicht (alles unter `src/` außer `*.d.ts`, plus das Glue), trägt `/* webpackIgnore: true */ /* @vite-ignore */`; statische `node:`-Imports gibt es dort nicht. Kein `new URL(<nicht-literal>, import.meta.url)` (webpack: »Critical dependency«). Kein Top-Level-`await` in Modulen, die der Worker lädt (Vite baut Worker per Default als IIFE: `INVALID_TLA_FORMAT`).
- Die TypeBox-Runtime erreicht der Client ausschließlich über den dynamischen Import in `src/client/validate.ts` (§6.3: »wird nur geladen, wenn `validate: true`«). Der Client-Entry ohne `schema` bleibt im einstelligen KB-Bereich gzip (§8.3).
- Verzögerungen und Hänger in Tests entstehen nie durch Rechenlast: Fake Timers, Fake-Worker, ein stiller Test-Worker, der nie antwortet. Endlosschleifen-Designs werden nicht generiert.
- Eigene Quelldateien tragen `// SPDX-License-Identifier: GPL-3.0-or-later` in den ersten drei Zeilen (`pnpm lint` prüft). README auf Englisch. Toolchain-Aufrufe über `mise x -- …`, wenn `pnpm`/`node` nicht im `PATH` liegen.

## Review Focus

1. **Langlebiges `AbortSignal`, das über viele Aufrufe wiederverwendet wird** (etwa die Lebensdauer einer UI-Komponente): Nach dem Settle eines Requests muss sein Abort-Listener weg sein. Ein späteres `abort()` darf weder einen anderen Request abbrechen noch den Worker terminieren. Test in Task 5.
2. **Abort oder Timeout eines noch wartenden Requests:** Er verlässt nur die Queue; der Worker, der gerade einen anderen Request rechnet, bleibt am Leben. Nachrichten eines bereits terminierten Workers werden ignoriert. Test in Task 5.
3. **`timeout: Infinity` oder sehr große Werte:** `setTimeout` mit mehr als 2 147 483 647 ms feuert sofort. Erwartet: `Infinity` setzt keinen Timer, größere endliche Werte und `≤ 0`/`NaN` sind `RangeError`. Test in Task 5.
4. **Asset-Fehler (404, CSP blockiert Worker oder Wasm) bei vielen gleichzeitigen Aufrufen:** Alle laufenden und wartenden Requests werden mit `WorkerError` abgelehnt, ohne Respawn-Schleife; erst der nächste Aufruf startet genau einen neuen Worker. Test in Task 5.
5. **Relativer `wasmUrl`-String:** Der Consumer meint »relativ zur Seite«, der Worker würde »relativ zum Worker-Skript« auflösen. Erwartet: der Client löst gegen `location.href` auf, bevor er die URL schickt. Test in Task 6.

## Festlegungen dieses Plans (zum Gegenlesen vor der Ausführung)

- **Protokoll:** Spec §10 P3.1 nennt `ready`/`create`/`result`/`error`. Dazu kommt `init` (Client → Worker), denn der Worker braucht `wasmUrl`, bevor er das Modul lädt. Jede Nachricht trägt `v: 1`. `ready` antwortet auf `init` und hat keine `id`; `error` mit `id: null` heißt »Worker-Start gescheitert«. Request-IDs zählen pro Client-Instanz ab 1. Additive, optionale Felder (Phase 4: `output`, Layer) erhöhen `v` nicht.
- **Eine Anfrage zur Zeit:** Der Client hält die FIFO-Queue selbst und schickt erst nach `result`/`error` die nächste `create`-Nachricht. Nur so kann ein Timeout den Worker terminieren, ohne wartende Requests mitzureißen. Der Timeout zählt ab dem Versand, nicht ab dem Einreihen; für den ersten Request schließt er den Worker-Start ein.
- **Neue Fehlerklassen** in `src/errors.ts`: `TimeoutError` (Request überschreitet `timeout`) und `WorkerError` (Worker ließ sich nicht starten, ist abgestürzt oder spricht ein anderes Protokoll; nie ein Designfehler). Die Spec-Tabelle §4 bekommt damit eine Zeile mehr; ein Ladefehler als `GenerationError` würde Consumer auf das Design statt auf Bundler oder CSP schauen lassen.
- **Abbruch:** abgelehnt wird mit `signal.reason` (wie `fetch`), ohne Grund ist das eine `DOMException` mit `name === 'AbortError'`. `dispose()` lehnt mit `new DOMException('DungeonMaker was disposed', 'AbortError')` ab und ist idempotent.
- **Worker-Ausfall** (`error`-/`messageerror`-Event, `error` mit `id: null`, falsche Protokollversion, Factory wirft): laufender und alle wartenden Requests → `WorkerError`, Worker terminiert, kein automatischer Neustart. Der nächste Aufruf spawnt neu. Ein `GenerationError` (Wasm-Assert) ist dagegen kein Worker-Ausfall: Der Worker instanziiert das Modul aus dem gecachten `WebAssembly.Module` neu und bleibt.
- **Seed:** Der Client prüft ihn (`1 … 2³²−1`, sonst `RangeError`) und würfelt einen fehlenden per `crypto.getRandomValues` (0 wird neu gezogen). Der Worker bekommt immer einen Seed.
- **`Dungeon`** bekommt zusätzlich `diagnostics: readonly string[]` (Library-Ausgabe, §5.2). `get(x, y)` wirft `RangeError` außerhalb der Karte. `output` und die Layer `rooms`/`entities`/`steps` kommen erst mit Phase 4 in `DungeonRequest` und `Dungeon`.
- **Bundler-Kompatibilität per Magic Comments**, nicht per konditionalen Subpath-Imports (`#wasm-bytes`): Die Probe zeigt, dass `webpackIgnore`/`@vite-ignore` an den drei `node:`-Imports genügt (webpack baute vorher mit drei `UnhandledSchemeError`), und Subpath-Imports würden in `tsc`-Typecheck und Vitest auf `dist/` zeigen. Das Glue bekommt den Kommentar per Nachbearbeitung in `native/build.sh`, mit Abbruch, wenn das Muster nicht genau einmal vorkommt.
- **Vite-Dev-Server:** In der Probe funktionierte auch `vite` (Dev, mit Dependency-Prebundling) ohne `optimizeDeps.exclude`. Die Fixture prüft deshalb Build und Dev.
- **Browser-Tests laufen gegen `dist/`**, über Aliase für `dungeonmaker-js` und `dungeonmaker-js/*`: getestet wird, was ausgeliefert wird, und Vite muss `new URL('../worker.js', …)` nicht auf eine `.ts`-Quelle umbiegen. Sie liegen in `test/browser/`, haben ein eigenes `tsconfig.json` und laufen nicht in `pnpm test`, sondern in `pnpm --filter dungeonmaker-js test:browser`.
- **WebKit lokal optional:** `DM_BROWSERS` (kommagetrennt, Default `chromium,firefox,webkit`) wählt die Engines. CI (Ubuntu, `playwright install --with-deps`) läuft immer mit allen dreien; auf Distributionen ohne offizielle WebKit-Builds lokal `DM_BROWSERS=chromium,firefox`.
- **Fixtures** liegen in `fixtures/bundlers/{vite,webpack}/` außerhalb des pnpm-Workspace (`packages/*`) und werden von `scripts/bundler-smoke.mjs` in ein Temp-Verzeichnis kopiert. Der Quellcode der Fixture-Seite ist das Browser-Beispiel aus dem README, wörtlich (wie `pack-smoke` es mit dem JSON-Beispiel tut).
- **CSP-Rezept:** `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'` (plus `default-src 'self'`). Der Smoke-Server liefert die gebauten Fixtures mit genau diesem Header aus; damit ist das dokumentierte Rezept getestet.
- **Escape Hatch `worker`:** Rezept für exotische Bundler ist ein eigenes Worker-Modul mit `import 'dungeonmaker-js/worker';`. Damit ein Bundler diesen Side-Effect-Import nicht wegschüttelt, wird `sideEffects` von `false` zu `["./dist/worker.js"]`.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `native/build.sh` | Glue-Nachbearbeitung: Magic Comments an `import("node:module")` (Task 1) |
| `packages/dungeonmaker-js/src/core/core.ts` | `node:`-Imports mit Magic Comments, keine variable `new URL(…, import.meta.url)` (Task 1) |
| `src/errors.ts` | + `TimeoutError`, `WorkerError` (Task 2) |
| `src/protocol.ts` | Nachrichtentypen, `PROTOCOL_VERSION`, Fehler-(De-)Serialisierung, Eingangsprüfung (Task 2) |
| `src/dungeon.ts` | `Dungeon`, `DungeonData`, `toDungeon()` (Task 2) |
| `src/worker/handler.ts` | `createWorkerHandler()`: Protokoll → `core`, Neuinstanziierung nach Abort (Task 3) |
| `src/worker.ts` | Worker-Entry: verdrahtet `self` mit dem Handler, kein TLA (Task 3) |
| `src/client/seed.ts` | `resolveSeed()`, `randomSeed()` (Task 4) |
| `src/client/client.ts` | `createDungeonMaker()`: Lebenszyklus, Queue, Timeout, Abort, Ausfall (Tasks 4–5) |
| `src/client/validate.ts` | einziger (dynamischer) Weg vom Client zu `schema/validate.js` (Task 6) |
| `src/client/spawn.ts` | `spawnDefaultWorker()`, nur das Bundler-Muster (Task 6) |
| `src/client/default.ts` | `createDungeon()` mit geteilter Lazy-Instanz (Task 6) |
| `src/index.ts`, `package.json` | Exporte, `./worker`, `sideEffects`, Scripts (Tasks 6–8) |
| `scripts/check-size.mjs`, `size-budget.json` | + `clientGzipBytes` (Task 6) |
| `test/client/fake-worker.ts`, `test/client/in-process-worker.ts` | Test-Doubles (Tasks 4, 6) |
| `test/browser/**`, `vitest.browser.config.ts` | Browser-Tests (Task 7) |
| `fixtures/bundlers/**`, `scripts/bundler-smoke.mjs` | Bundler-Smoke (Task 8) |
| `.github/workflows/ci.yml`, `scripts/test/workflows.test.mjs` | Jobs `browser`, `bundlers` im Gate (Tasks 7–8) |
| `README.md` (Package), `CLAUDE.md` | Browser-Quickstart, Fehler, CSP, Bundler, Status (Task 8) |

---

### Task 1: Bundler-sichere Node-Imports in `core` und Glue

**Files:**
- Modify: `native/build.sh` (nach dem `em++`-Aufruf)
- Modify: `packages/dungeonmaker-js/src/core/core.ts` (`readWasmBytes`)
- Regenerate: `packages/dungeonmaker-js/wasm/dungeonmaker.js`, `packages/dungeonmaker-js/wasm/BUILD-INFO.json`
- Test: `packages/dungeonmaker-js/test/bundler-safety.test.ts`

**Interfaces:**
- Consumes: —
- Produces: Glue und `core` ohne Bundler-Stolpersteine; Regel und Test, die spätere Tasks (Worker, Client) automatisch mit abdecken.

- [ ] **Step 1: Write the failing test** `test/bundler-safety.test.ts`. Er scannt alle `src/**/*.ts` außer `*.d.ts` und `wasm/dungeonmaker.js`:

```ts
const NODE_IMPORT = /import\(((?:\s*\/\*.*?\*\/)*)\s*['"](node:[^'"]+)['"]\s*\)/g;
const STATIC_NODE = /\bfrom\s*['"]node:|\bimport\s*['"]node:/;
const VARIABLE_URL = /new URL\(\s*(?!['"`])[^,()]+,\s*import\.meta\.url\s*\)/;

test('the scan finds the known node imports', () => {
  expect([...read('wasm/dungeonmaker.js').matchAll(NODE_IMPORT)]).toHaveLength(1);
  expect([...read('src/core/core.ts').matchAll(NODE_IMPORT)]).toHaveLength(2);
});
test.each(files)('%s: every node: import is hidden from bundlers', (file) => {
  const source = read(file);
  expect(source).not.toMatch(STATIC_NODE);
  for (const [, comments, specifier] of source.matchAll(NODE_IMPORT)) {
    expect(comments, specifier).toContain('webpackIgnore: true');
    expect(comments, specifier).toContain('@vite-ignore');
  }
});
test.each(files)('%s: new URL(…, import.meta.url) only with a literal', (file) => {
  expect(read(file)).not.toMatch(VARIABLE_URL);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/bundler-safety.test.ts`
Expected: FAIL — fehlende Kommentare in `core.ts` und Glue, `VARIABLE_URL` trifft `new URL(url, import.meta.url)` in `readWasmBytes`.

- [ ] **Step 3: `core.ts` anpassen.** Beide dynamischen Imports in `readWasmBytes` bekommen `/* webpackIgnore: true */ /* @vite-ignore */` vor dem String. Die Basis-URL kommt aus `const moduleUrl = import.meta.url;` auf Modulebene, `new URL(url, moduleUrl)` ersetzt den variablen Ausdruck; das Default-Argument `new URL('../../wasm/dungeonmaker.wasm', import.meta.url)` bleibt wörtlich.

- [ ] **Step 4: `native/build.sh` erweitern.** Direkt nach `run em++ …`: zählen, wie oft `import("node:module")` im Glue steht; ist es nicht genau 1, mit Meldung `expected one import("node:module") in the glue, found <n>` und Exit 1 abbrechen; sonst portabel (`sed … > tmp && mv`, kein `sed -i`) ersetzen durch `import(/* webpackIgnore: true */ /* @vite-ignore */ "node:module")`. Kommentar darüber: webpack bricht an `node:`-URIs ab, Vite warnt; der Import läuft nur in Node.

- [ ] **Step 5: Wasm neu bauen und prüfen**

Run: `sh native/build.sh && git diff --stat -- packages/dungeonmaker-js/wasm`
Expected: geändert nur `dungeonmaker.js` und `BUILD-INFO.json` (`nativeSourceHash`); `dungeonmaker.wasm` taucht nicht auf.

- [ ] **Step 6: Tests, Build und Emit prüfen**

Run: `mise x -- pnpm test && mise x -- pnpm build && grep -c webpackIgnore packages/dungeonmaker-js/dist/core/core.js`
Expected: alle Tests PASS (Golden-Hashes unverändert), `grep` meldet `2` (tsc erhält die Kommentare).

- [ ] **Step 7: Commit**

```bash
git add native/build.sh packages/dungeonmaker-js/src/core/core.ts packages/dungeonmaker-js/wasm packages/dungeonmaker-js/test/bundler-safety.test.ts
git commit -m "fix(core): hide node-only imports from browser bundlers"
```

---

### Task 2: Protokoll, Ergebnisobjekt und neue Fehlerklassen

**Files:**
- Modify: `packages/dungeonmaker-js/src/errors.ts`
- Create: `packages/dungeonmaker-js/src/protocol.ts`, `packages/dungeonmaker-js/src/dungeon.ts`
- Test: `packages/dungeonmaker-js/test/protocol.test.ts`, `packages/dungeonmaker-js/test/dungeon.test.ts`

**Interfaces:**
- Consumes: `DesignIssue`, `DesignValidationError`, `GenerationError` (`src/errors.ts`), `Cell` (`src/cell.ts`), `DesignConfig` (`import type` aus `src/schema/model.ts`).
- Produces:

```ts
// errors.ts
export class TimeoutError extends Error { name: 'TimeoutError'; readonly timeout: number;
  constructor(timeout: number) }                       // message: `generation timed out after ${timeout} ms`
export class WorkerError extends Error { name: 'WorkerError';
  constructor(message: string, options?: ErrorOptions) }

// protocol.ts
export const PROTOCOL_VERSION = 1;
export interface WireError { name: string; message: string;
  issues?: DesignIssue[]; diagnostics?: string[]; }
export type ToWorker =
  | { type: 'init'; v: 1; wasmUrl?: string }
  | { type: 'create'; v: 1; id: number; design: DesignConfig | string; seed: number };
export type FromWorker =
  | { type: 'ready'; v: 1 }
  | { type: 'result'; v: 1; id: number; width: number; height: number; seed: number;
      cells: Uint8Array; diagnostics: string[] }
  | { type: 'error'; v: 1; id: number | null; error: WireError };
export function encodeError(error: unknown): WireError;
export function decodeError(wire: WireError): Error;
export function parseToWorker(data: unknown): ToWorker;      // throws Error (message names the problem)
export function parseFromWorker(data: unknown): FromWorker;  // throws WorkerError

// dungeon.ts
export interface DungeonData { width: number; height: number; seed: number;
  cells: Uint8Array; diagnostics: readonly string[]; }
export interface Dungeon extends Readonly<DungeonData> { get(x: number, y: number): Cell; }
export function toDungeon(data: DungeonData): Dungeon;
```

- [ ] **Step 1: Write the failing tests**

`test/protocol.test.ts`:

```ts
test('DesignValidationError survives the round trip with issues and diagnostics', () => {
  const e = decodeError(encodeError(new DesignValidationError([{ path: '/map/width', message: 'too small' }], ['warn'])));
  expect(e).toBeInstanceOf(DesignValidationError);
  expect((e as DesignValidationError).issues).toEqual([{ path: '/map/width', message: 'too small' }]);
  expect((e as DesignValidationError).diagnostics).toEqual(['warn']);
});
test('GenerationError keeps message and diagnostics', …);          // instanceof + Felder
test('RangeError stays a RangeError', …);
test('anything else becomes a plain Error with its message', () => {
  expect(decodeError(encodeError('boom'))).toEqual(new Error('boom'));
  expect(decodeError({ name: 'Weird', message: 'x' }).message).toBe('x');
});
test('encodeError output is structured-cloneable', () => {
  expect(() => structuredClone(encodeError(new GenerationError('x', ['d'], { cause: () => 1 })))).not.toThrow();
});
test.each([[null], [{}], [{ type: 'result', v: 2, id: 1 }], [{ type: 'nope', v: 1 }]])(
  'parseFromWorker rejects %j with WorkerError', (data) => {
    expect(() => parseFromWorker(data)).toThrow(WorkerError);
  });
test('parseFromWorker names the version mismatch', () => {
  expect(() => parseFromWorker({ type: 'ready', v: 2 })).toThrow(/protocol version 2.*expected 1/);
});
test.each([[{ type: 'create', v: 1, id: 0, design: '', seed: 1 }], [{ type: 'init', v: 3 }]])(
  'parseToWorker rejects %j', (data) => { expect(() => parseToWorker(data)).toThrow(); });
```

`test/dungeon.test.ts`:

```ts
const d = toDungeon({ width: 3, height: 2, seed: 7, cells: Uint8Array.of(0, 1, 2, 3, 4, 5), diagnostics: [] });
test('get reads row-major', () => { expect(d.get(2, 1)).toBe(5); expect(d.get(0, 1)).toBe(3); });
test.each([[-1, 0], [3, 0], [0, 2], [0.5, 0], [Number.NaN, 0]])('get(%d, %d) is a RangeError', (x, y) => {
  expect(() => d.get(x, y)).toThrow(RangeError);
});
test('the dungeon object is frozen, cells are not copied', …);    // Object.isFrozen, d.cells === input
test('TimeoutError and WorkerError have their names', …);         // name, instanceof Error, timeout field
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/protocol.test.ts packages/dungeonmaker-js/test/dungeon.test.ts`
Expected: FAIL — Module existieren nicht.

- [ ] **Step 3: Implementieren** (Signaturen oben). `encodeError` übernimmt bei `DesignValidationError` `issues` und `diagnostics`, bei `GenerationError` `diagnostics`, sonst nur `name`/`message` (nie `cause`, nie `stack`: nicht garantiert klonbar). `decodeError` baut die Klasse anhand von `name` wieder auf (`DesignValidationError`, `GenerationError`, `RangeError`), sonst `new Error(message)`. `parseFromWorker`/`parseToWorker` prüfen `type`, `v === PROTOCOL_VERSION`, `id` (ganzzahlig ≥ 1, bei `error` auch `null`) und bei `result` `cells instanceof Uint8Array` und `cells.length === width * height`. `toDungeon` gibt ein eingefrorenes Objekt zurück.

- [ ] **Step 4: Run tests to verify they pass**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/protocol.test.ts packages/dungeonmaker-js/test/dungeon.test.ts && mise x -- pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dungeonmaker-js/src/errors.ts packages/dungeonmaker-js/src/protocol.ts packages/dungeonmaker-js/src/dungeon.ts packages/dungeonmaker-js/test/protocol.test.ts packages/dungeonmaker-js/test/dungeon.test.ts
git commit -m "feat(client): versioned worker protocol, Dungeon result, TimeoutError and WorkerError"
```

---

### Task 3: Worker-Handler und Worker-Entry

**Files:**
- Create: `packages/dungeonmaker-js/src/worker/handler.ts`, `packages/dungeonmaker-js/src/worker.ts`
- Test: `packages/dungeonmaker-js/test/worker-handler.test.ts`

**Interfaces:**
- Consumes: `parseToWorker`, `encodeError`, `PROTOCOL_VERSION`, `FromWorker` (Task 2); `loadCore`, `LoadCoreOptions`, `DungeonMakerCore` (`src/core/core.ts`); `toDesignText` (`src/config/serialize.ts`).
- Produces:

```ts
export interface WorkerHandlerDeps {
  post(message: FromWorker, transfer: Transferable[]): void;
  loadCore(options: LoadCoreOptions): Promise<DungeonMakerCore>;
}
/** Handles one incoming message; calls are processed strictly in arrival order. */
export function createWorkerHandler(deps: WorkerHandlerDeps): (data: unknown) => Promise<void>;
```

`dist/worker.js` (Entry `dungeonmaker-js/worker`): keine Exporte, verdrahtet `self.addEventListener('message', e => void handle(e.data))` und `post = (m, t) => self.postMessage(m, t)`.

- [ ] **Step 1: Write the failing test** `test/worker-handler.test.ts` mit echtem `loadCore` und einem `post`-Recorder (`messages: FromWorker[]`, `transfers: Transferable[][]`):

```ts
test('init loads the core and answers ready', async () => {
  await handle({ type: 'init', v: 1 });
  expect(messages).toEqual([{ type: 'ready', v: 1 }]);
});
test('create with a preset generates the golden dungeon and transfers exactly the cells', async () => {
  await handle({ type: 'init', v: 1 });
  await handle({ type: 'create', v: 1, id: 1, design: design3A, seed: 42 });
  const r = messages.at(-1) as Extract<FromWorker, { type: 'result' }>;
  expect(r).toMatchObject({ type: 'result', id: 1, seed: 42 });
  expect(fnv1a32(r.cells)).toBe(golden['design3A:42']);
  expect(r.cells.buffer.byteLength).toBe(r.width * r.height);
  expect(transfers.at(-1)).toEqual([r.cells.buffer]);
});
test('legacy design text is generated unchanged', …);              // readDesign('design'), 42 → golden['design:42']
test('an invalid config is a DesignValidationError with JSON pointers', …);
  // design: extendDesign(design3A, { map: { width: 2 } }) → error.name 'DesignValidationError', issues[0].path startsWith '/'
test('an invalid seed is a RangeError', …);                        // seed 0 → error.name 'RangeError', id 1
test('an assert abort is a GenerationError and the next request runs on a fresh instance', async () => {
  // broken = design + 'WS 500 500 WE SW 0 15 2 4 1 7 0 20 0 60 10' (wie core-errors.test.ts)
  // → error.name 'GenerationError'; loadCore wurde ein zweites Mal mit { wasmModule } aufgerufen;
  // danach design:42 → golden['design:42']
});
test('a failed init is reported with id null', async () => {
  const handle = createWorkerHandler({ post, loadCore: () => Promise.reject(new Error('HTTP 404')) });
  await handle({ type: 'init', v: 1 });
  expect(messages).toEqual([{ type: 'error', v: 1, id: null, error: { name: 'Error', message: 'HTTP 404' } }]);
});
test('a message with another protocol version is answered with an error naming it', …);
  // { type: 'create', v: 2, id: 5, … } → { type: 'error', id: 5, error.message /protocol/ }
test('create before init is an error, not a hang', …);
test('messages are handled in arrival order', …);
  // drei create ohne await hintereinander → result-IDs 1, 2, 3 in dieser Reihenfolge
test('wasmUrl from init reaches loadCore', …);                     // Spy auf loadCore, { wasmUrl: 'file:///x.wasm' }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/worker-handler.test.ts`
Expected: FAIL — `createWorkerHandler` existiert nicht.

- [ ] **Step 3: `src/worker/handler.ts` implementieren.** Interne Promise-Kette serialisiert die Verarbeitung. `init` startet `loadCore({ wasmUrl })` einmal (ein zweites `init` antwortet erneut `ready`, ohne neu zu laden). `create`: `design` als String unverändert, als Objekt durch `toDesignText`; dann `core.generate(text, seed)`; `post(result, [cells.buffer])`. Nach einem Fehler mit `core.aborted === true` wird der Core per `loadCore({ wasmModule: core.wasmModule })` ersetzt, bevor die nächste Nachricht läuft. Jeder Fehler wird zu `{ type: 'error', id, error: encodeError(e) }`; eine nicht parsbare Nachricht antwortet mit der `id` der Nachricht, falls lesbar, sonst `null`.

- [ ] **Step 4: `src/worker.ts` schreiben.** `self` lokal minimal typisieren (`declare const self: { postMessage(message: unknown, transfer: Transferable[]): void; addEventListener(type: 'message', listener: (event: MessageEvent) => void): void; }`), damit weder `lib: WebWorker` noch ein Konflikt mit `DOM` nötig ist. Kein Top-Level-`await`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/worker-handler.test.ts packages/dungeonmaker-js/test/bundler-safety.test.ts && mise x -- pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dungeonmaker-js/src/worker packages/dungeonmaker-js/src/worker.ts packages/dungeonmaker-js/test/worker-handler.test.ts
git commit -m "feat(worker): message handler around the core with re-instantiation after aborts"
```

---

### Task 4: Client — Lebenszyklus, Queue, Seeds, Ergebnisse

**Files:**
- Create: `packages/dungeonmaker-js/src/client/seed.ts`, `packages/dungeonmaker-js/src/client/client.ts`
- Create: `packages/dungeonmaker-js/test/client/fake-worker.ts`
- Test: `packages/dungeonmaker-js/test/client/client.test.ts`, `packages/dungeonmaker-js/test/client/seed.test.ts`

**Interfaces:**
- Consumes: Task 2 (`parseFromWorker`, `decodeError`, `ToWorker`, `toDungeon`, `Dungeon`, `WorkerError`).
- Produces:

```ts
// seed.ts
export const MAX_SEED = 0xffff_ffff;
export function randomSeed(): number;                       // 1 … MAX_SEED, crypto.getRandomValues, 0 neu ziehen
export function resolveSeed(seed: number | undefined): number; // undefined → randomSeed(); sonst prüfen, RangeError

// client.ts
export interface DungeonRequest { design: DesignConfig | string; seed?: number; }
export interface CallOptions { signal?: AbortSignal; timeout?: number; }
export interface DungeonMakerOptions {
  worker?: () => Worker; wasmUrl?: string | URL; timeout?: number; validate?: boolean;
}
export interface DungeonMaker {
  create(request: DungeonRequest, opts?: CallOptions): Promise<Dungeon>;
  ready(): Promise<void>;
  dispose(): void;
}
export function createDungeonMaker(options?: DungeonMakerOptions): DungeonMaker;
export const DEFAULT_TIMEOUT = 30_000;
```

Der Client benutzt vom Worker nur `postMessage(message, transfer?)`, `terminate()` und `addEventListener('message' | 'error' | 'messageerror', …)`. Bis Task 6 ist `worker` in Tests immer gesetzt; der Default kommt in Task 6.

`test/client/fake-worker.ts`:

```ts
export class FakeWorker extends EventTarget {
  readonly posted: ToWorker[];            // was der Client geschickt hat (nach structuredClone)
  terminated: boolean;
  onPost?: (message: ToWorker) => void;   // Autoresponder-Hook
  postMessage(data: unknown, transfer?: Transferable[]): void; // klont wie ein echter Worker: wirft DataCloneError
  terminate(): void;
  reply(message: unknown): void;          // dispatcht MessageEvent('message', { data })
  crash(message: string): void;           // dispatcht Event('error') mit Feld message
  messageError(): void;                   // dispatcht Event('messageerror')
}
export function resultFor(worker: FakeWorker, id: number, width?: number, height?: number): FromWorker;
  // gültige result-Nachricht mit Nullzellen; seed aus der create-Nachricht mit dieser id in worker.posted
export function autoWorker(): FakeWorker; // antwortet auf init mit ready, auf create mit resultFor(…, 4, 3)
export function fakeFactory(make?: () => FakeWorker): { factory: () => Worker; workers: FakeWorker[] };
  // ohne make: FakeWorker ohne Autoresponder
```

- [ ] **Step 1: Write the failing tests**

`test/client/seed.test.ts`:

```ts
test.each([0, -1, 1.5, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY])('resolveSeed(%d) is a RangeError', (s) => {
  expect(() => resolveSeed(s)).toThrow(RangeError);
});
test.each([1, 42, 0xffff_ffff])('resolveSeed(%d) keeps it', (s) => { expect(resolveSeed(s)).toBe(s); });
test('randomSeed draws again on 0', () => {
  const spy = vi.spyOn(crypto, 'getRandomValues')
    .mockImplementationOnce((a) => { (a as Uint32Array)[0] = 0; return a; })
    .mockImplementationOnce((a) => { (a as Uint32Array)[0] = 7; return a; });
  expect(randomSeed()).toBe(7);
  spy.mockRestore();
});
```

`test/client/client.test.ts`:

```ts
test('spawns lazily: nothing before the first call, then init followed by create', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory });
  expect(workers).toHaveLength(0);
  await dm.create({ design: 'D', seed: 9 });
  expect(workers[0]?.posted.map((m) => m.type)).toEqual(['init', 'create']);
  expect(workers[0]?.posted[1]).toMatchObject({ v: 1, id: 1, design: 'D', seed: 9 });
});
test('resolves a frozen Dungeon from the result', …);   // width/height/seed/cells/diagnostics, get()
test('runs one request at a time, in FIFO order', async () => {
  // FakeWorker ohne Autoresponder; drei create() ohne await
  // posted enthält genau ein 'create' (id 1); reply(result id 1) → zweites create (id 2) erscheint; …
  // Promises resolven in Reihenfolge 1, 2, 3
});
test('a missing seed is drawn by the client and returned in the result', …);
test.each([0, 1.5, 2 ** 32])('seed %d rejects with RangeError before anything is spawned', async (seed) => {
  const { factory, workers } = fakeFactory(autoWorker);
  await expect(createDungeonMaker({ worker: factory }).create({ design: 'D', seed })).rejects.toThrow(RangeError);
  expect(workers).toHaveLength(0);
});
test('worker errors arrive as typed errors', …);
  // reply({ type: 'error', v: 1, id: 1, error: { name: 'DesignValidationError', message: 'm', issues: [{ path: '/a', message: 'm' }] } })
  // → rejects.toBeInstanceOf(DesignValidationError) mit issues; analog GenerationError
test('a design that cannot be cloned rejects and the queue continues', async () => {
  const { factory } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory });
  const bad = dm.create({ design: { map: () => 1 } as unknown as DesignConfig, seed: 1 });
  const good = dm.create({ design: 'D', seed: 2 });
  await expect(bad).rejects.toMatchObject({ name: 'DataCloneError' });
  await expect(good).resolves.toMatchObject({ seed: 2 });
});
test('ready() resolves once the worker reported ready and spawns only once', …);
test('ready() rejects with WorkerError when init fails', …);
  // reply({ type: 'error', v: 1, id: null, error: { name: 'Error', message: 'HTTP 404' } }) → WorkerError, message enthält 'HTTP 404'
test('dispose() rejects running and queued requests with AbortError and terminates', async () => {
  // zwei laufende/wartende Requests; dispose(); beide → DOMException name 'AbortError'; workers[0].terminated
});
test('create() after dispose() rejects, dispose() twice is harmless', …);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/client`
Expected: FAIL — Module existieren nicht.

- [ ] **Step 3: `src/client/seed.ts` und `src/client/client.ts` implementieren.** Zustand pro Instanz: aktueller Worker oder `null`, `ready`-Deferred des aktuellen Workers, laufender Job oder `null`, `queue: Job[]`, `nextId`, `disposed`. `create()` ist `async` (jede Prüfung wird zur Rejection), reiht einen Job ein und stößt `pump()` an. `pump()` spawnt bei Bedarf (Listener registrieren, sofort `init` mit `wasmUrl` senden), nimmt den ersten Job und schickt `create`; wirft `postMessage` synchron, wird nur dieser Job abgelehnt und `pump()` läuft weiter. Eingehende Nachrichten gehen durch `parseFromWorker`; `result` → `toDungeon`, `error` mit passender `id` → `decodeError`; danach nächster Job. Timeout, Abort und Ausfälle kommen in Task 5; `timeout` wird hier nur durchgereicht.

- [ ] **Step 4: Run tests to verify they pass**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/client && mise x -- pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dungeonmaker-js/src/client packages/dungeonmaker-js/test/client
git commit -m "feat(client): createDungeonMaker with lazy worker, FIFO queue and typed results"
```

---

### Task 5: Client — Timeout, Abort, Worker-Ausfall, Respawn

**Files:**
- Modify: `packages/dungeonmaker-js/src/client/client.ts`
- Test: `packages/dungeonmaker-js/test/client/failure.test.ts`

**Interfaces:**
- Consumes: `createDungeonMaker`, `FakeWorker`, `fakeFactory`, `autoWorker` (Task 4); `TimeoutError`, `WorkerError` (Task 2).
- Produces: das vollständige Fehlerverhalten aus den Festlegungen; keine neuen Exporte.

- [ ] **Step 1: Write the failing tests** `test/client/failure.test.ts`, mit `vi.useFakeTimers()` und `FakeWorker`s, die auf `create` nicht antworten, sofern nicht anders gesagt:

```ts
test('a running request times out: TimeoutError, worker terminated, next request on a new worker', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory, timeout: 1000 });
  const p = dm.create({ design: 'D', seed: 1 });
  const q = dm.create({ design: 'D', seed: 2 });
  await vi.advanceTimersByTimeAsync(1000);
  await expect(p).rejects.toBeInstanceOf(TimeoutError);
  expect(workers[0]?.terminated).toBe(true);
  expect(workers[1]?.posted.find((m) => m.type === 'create')).toMatchObject({ seed: 2 });
  workers[1]?.reply(resultFor(workers[1], 2));            // Helfer aus fake-worker.ts
  await expect(q).resolves.toMatchObject({ seed: 2 });
});
test('the timeout counts from dispatch, not from enqueueing', …);
  // timeout 1000; p läuft 900 ms und resolved; q wartete 900 ms → q fällt erst 1000 ms nach seinem Versand
test('a per-call timeout overrides the instance default', …);
test('timeout Infinity sets no timer', async () => {
  const dm = createDungeonMaker({ worker: fakeFactory().factory, timeout: Number.POSITIVE_INFINITY });
  void dm.create({ design: 'D', seed: 1 });
  expect(vi.getTimerCount()).toBe(0);
});
test.each([0, -5, Number.NaN, 2 ** 31])('timeout %d is a RangeError', async (timeout) => {
  expect(() => createDungeonMaker({ timeout })).toThrow(RangeError);
  await expect(createDungeonMaker({ worker: fakeFactory().factory }).create({ design: 'D', seed: 1 }, { timeout }))
    .rejects.toThrow(RangeError);
});
test('aborting a queued request removes it and leaves the running worker alone', …);
  // p läuft, q wartet mit signal; abort(); q → AbortError; workers[0].terminated false; workers[0].posted hat kein create für q
test('aborting the running request terminates the worker; the next request respawns', …);
test('an already aborted signal rejects with its reason and spawns nothing', async () => {
  const { factory, workers } = fakeFactory();
  const reason = new Error('mine');
  await expect(createDungeonMaker({ worker: factory }).create({ design: 'D', seed: 1 }, { signal: AbortSignal.abort(reason) }))
    .rejects.toBe(reason);
  expect(workers).toHaveLength(0);
});
test('abort() without a reason rejects with a DOMException AbortError', …);
test('a reused signal is released after settling: a later abort changes nothing', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const controller = new AbortController();
  const dm = createDungeonMaker({ worker: factory });
  await dm.create({ design: 'D', seed: 1 }, { signal: controller.signal });
  controller.abort();
  await expect(dm.create({ design: 'D', seed: 2 })).resolves.toMatchObject({ seed: 2 });
  expect(workers).toHaveLength(1);
  expect(workers[0]?.terminated).toBe(false);
});
test('messages from a terminated worker are ignored', …);
  // p timed out; der alte FakeWorker sendet danach noch result id 1 → q (id 2, neuer Worker) bleibt pending, kein Throw
test('a worker error event rejects running and queued requests with WorkerError, no respawn storm', async () => {
  const { factory, workers } = fakeFactory();
  const dm = createDungeonMaker({ worker: factory });
  const all = Array.from({ length: 5 }, (_, i) => dm.create({ design: 'D', seed: i + 1 }));
  workers[0]?.crash('Failed to fetch dungeonmaker.wasm');
  for (const p of all) await expect(p).rejects.toBeInstanceOf(WorkerError);
  expect(workers).toHaveLength(1);
  void dm.create({ design: 'D', seed: 9 });
  expect(workers).toHaveLength(2);
});
test('init failure (error with id null) behaves like a worker error', …);
test('messageerror rejects with WorkerError', …);
test('a protocol mismatch from the worker is a WorkerError', …);   // reply({ type: 'ready', v: 2 })
test('a throwing worker factory rejects with WorkerError carrying the cause', …);
test('no timers or listeners are left after settling', …);
  // nach resolve/reject: vi.getTimerCount() === 0; signal: removeEventListener-Spy einmal aufgerufen
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/client/failure.test.ts`
Expected: FAIL — Timeout/Abort/Ausfall nicht implementiert.

- [ ] **Step 3: In `client.ts` implementieren.**
  - Timeout-Regel: `timeout` ist `Infinity` (kein Timer) oder eine endliche Zahl in `1 … 2_147_483_647`; alles andere `RangeError` (in `createDungeonMaker` synchron, in `create()` als Rejection). Der Timer startet beim Versand der `create`-Nachricht.
  - Abort: Bereits abgebrochenes Signal → Rejection mit `signal.reason`, vor Spawn und Queue. Sonst Listener mit `{ once: true }`; wartender Job → aus der Queue, laufender Job → Worker terminieren, `pump()`.
  - Jeder Job räumt beim Settle Timer und Abort-Listener ab.
  - Worker-Ausfall (Ereignisse und Regeln aus den Festlegungen): `WorkerError` mit `cause` (dekodierter Fehler bzw. Event-Message), alle Jobs des Workers ablehnen, terminieren, Worker auf `null`; Listener prüfen, ob sie zum aktuellen Worker gehören, und ignorieren sonst alles.

- [ ] **Step 4: Run tests to verify they pass**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/client && mise x -- pnpm typecheck`
Expected: PASS (Task-4-Tests bleiben grün)

- [ ] **Step 5: Commit**

```bash
git add packages/dungeonmaker-js/src/client/client.ts packages/dungeonmaker-js/test/client/failure.test.ts
git commit -m "feat(client): timeout, abort, worker failure and respawn without hanging promises"
```

---

### Task 6: Öffentlicher Entry — `createDungeon`, Default-Worker, `validate`, `wasmUrl`, Exporte

**Files:**
- Create: `packages/dungeonmaker-js/src/client/spawn.ts`, `src/client/default.ts`, `src/client/validate.ts`
- Modify: `packages/dungeonmaker-js/src/client/client.ts` (Default-Factory, `validate`, `wasmUrl`)
- Modify: `packages/dungeonmaker-js/src/index.ts`, `packages/dungeonmaker-js/package.json`, root `package.json` (`check:package`)
- Modify: `packages/dungeonmaker-js/test/boundaries.test.ts`, `scripts/check-size.mjs`, `packages/dungeonmaker-js/size-budget.json`
- Create: `packages/dungeonmaker-js/test/client/in-process-worker.ts`
- Test: `packages/dungeonmaker-js/test/client/entry.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5; `createWorkerHandler` (Task 3); `validateDesign` (`src/schema/validate.ts`).
- Produces:

```ts
// spawn.ts — nur dieses Muster, damit Bundler es erkennen
export function spawnDefaultWorker(): Worker; // new Worker(new URL('../worker.js', import.meta.url), { type: 'module' })
// validate.ts — einziger Laufzeitweg vom Client zu TypeBox
export async function validateOrThrow(design: DesignConfig): Promise<void>; // DesignValidationError mit allen Issues
// default.ts
export function createDungeon(request: DungeonRequest, opts?: CallOptions): Promise<Dungeon>;
// index.ts (zusätzlich zu Phase 2)
export { createDungeon, createDungeonMaker, TimeoutError, WorkerError };
export type { CallOptions, Dungeon, DungeonMaker, DungeonMakerOptions, DungeonRequest };
// test/client/in-process-worker.ts
export function inProcessWorker(): Worker; // EventTarget-Fake, der createWorkerHandler mit echtem loadCore treibt
```

`package.json` des Packages: `exports["./worker"] = { "default": "./dist/worker.js" }`, `"sideEffects": ["./dist/worker.js"]`. Root-`check:package`: `./worker` zu `--exclude-entrypoints` (hat bewusst keine Typen). `size-budget.json`: `clientGzipBytes`.

- [ ] **Step 1: Write the failing tests**

`test/client/entry.test.ts`:

```ts
vi.mock('../../src/client/spawn.js', () => ({ spawnDefaultWorker: vi.fn(() => inProcessWorker()) }));

test('createDungeon generates the golden design3A dungeon on one shared worker', async () => {
  const a = await createDungeon({ design: design3A, seed: 42 });
  const b = await createDungeon({ design: design3A, seed: 1 });
  expect(fnv1a32(a.cells)).toBe(golden['design3A:42']);
  expect(fnv1a32(b.cells)).toBe(golden['design3A:1']);
  expect(a.cells.buffer.byteLength).toBe(a.width * a.height);
  expect(spawnDefaultWorker).toHaveBeenCalledTimes(1);
});
test('parallel calls all resolve with their own golden hashes', …);   // 5 Seeds aus SEEDS, Promise.all
test('a GenerationError is followed by a working request on the same client', …);
test('validate: true rejects a broken config on the main thread without sending it', async () => {
  const { factory, workers } = fakeFactory(autoWorker);
  const dm = createDungeonMaker({ worker: factory, validate: true });
  const e = await dm.create({ design: { ...design3A, map: { ...design3A.map, width: 'x' } } as never, seed: 1 }).catch((x) => x);
  expect(e).toBeInstanceOf(DesignValidationError);
  expect(e.issues[0].path).toBe('/map/width');
  expect(workers.flatMap((w) => w.posted).some((m) => m.type === 'create')).toBe(false);
});
test('validate: true leaves legacy text alone', …);
test('a relative wasmUrl string is resolved against the page', async () => {
  vi.stubGlobal('location', { href: 'https://example.test/app/page.html' });
  // createDungeonMaker({ worker, wasmUrl: 'assets/dm.wasm' }).ready()
  // → init.wasmUrl === 'https://example.test/app/assets/dm.wasm'
  vi.unstubAllGlobals();
});
test('a URL object is sent as href, without location the string as is', …);
test('the main entry exports the client API', …);  // createDungeon, createDungeonMaker, TimeoutError, WorkerError aus src/index.js
test('package.json: ./worker export and worker as the only side effect', …);
  // exports['./worker'].default === './dist/worker.js'; sideEffects toEqual(['./dist/worker.js'])
```

In `test/boundaries.test.ts` die Ausnahme ergänzen und testen: `client/validate.ts` darf `schema/validate.js` **nur dynamisch** laden; ein statischer Import dort schlägt fehl.

```ts
test('client/validate.ts loads the schema only dynamically', () => {
  const source = readFileSync(new URL('client/validate.ts', SRC), 'utf8');
  expect(source).toMatch(/import\(\s*['"]\.\.\/schema\/validate\.js['"]\s*\)/);
  expect([...source.matchAll(FROM)].filter(([, c]) => !/^type\b/.test(c ?? ''))).toEqual([]);
});
```

Die Reinheit des Client-Pakets prüft `pnpm size` selbst (CI ruft es nach `pnpm build` auf; ein Vitest-Test liefe vor dem Build): `check-size.mjs` bricht mit Exit 1 und der Liste der Treffer ab, wenn die Client-Closure eine Datei unter `schema/` oder `config/` oder `worker.js` enthält.

- [ ] **Step 2: Run tests to verify they fail**

Run: `mise x -- pnpm vitest run packages/dungeonmaker-js/test/client/entry.test.ts packages/dungeonmaker-js/test/boundaries.test.ts`
Expected: FAIL — `createDungeon`, `spawn.ts`, `validate.ts` fehlen.

- [ ] **Step 3: Implementieren.**
  - `client.ts`: Default-Factory `spawnDefaultWorker`; bei `validate: true` und Objekt-Design vor dem Einreihen `await validateOrThrow(design)`; `wasmUrl` beim Spawn auflösen: `URL` → `href`, String → `new URL(s, location.href).href`, falls `globalThis.location` existiert, sonst unverändert.
  - `default.ts`: Modulvariable, beim ersten Aufruf `createDungeonMaker()`.
  - `index.ts`: Exporte wie oben; Kopfkommentar »design config API and worker client (no TypeBox runtime, no Wasm)«.
  - `boundaries.test.ts`: `client/validate.ts` aus dem allgemeinen `test.each` nehmen, stattdessen der eigene Test oben.
  - `check-size.mjs`: `clientClosure(): string[]` (Pfade relativ zu `dist/`) folgt ab `dist/client/default.js` statischen relativen `import … from './…'`/`export … from` (nicht `import(`); `measure()` liefert zusätzlich `clientGzipBytes` (gzip -9 der verketteten Dateien); `main()` prüft die Reinheit wie oben, bevor es das Budget vergleicht.

- [ ] **Step 4: Run tests and package checks**

Run: `mise x -- pnpm lint && mise x -- pnpm typecheck && mise x -- pnpm test && mise x -- pnpm build && node scripts/check-size.mjs`
Expected: PASS; `check-size` zeigt `clientGzipBytes: <n>`. `<n>` auf das nächste Vielfache von 512 aufrunden und in `size-budget.json` eintragen; liegt der Wert über 9216, ist das ein Befund (etwas Ungewolltes hängt im Client) und kein Budget-Problem.

Run: `mise x -- pnpm size && mise x -- pnpm check:package && mise x -- pnpm pack:smoke`
Expected: PASS; `pnpm size` meldet die Closure ohne `schema/`, `config/` und `worker.js`.

- [ ] **Step 5: Commit**

```bash
git add package.json packages/dungeonmaker-js scripts/check-size.mjs
git commit -m "feat: createDungeon in the main entry, worker export, client size budget"
```

---

### Task 7: Browser-Tests in Chromium, Firefox und WebKit

**Files:**
- Create: `packages/dungeonmaker-js/vitest.browser.config.ts`, `packages/dungeonmaker-js/test/browser/tsconfig.json`
- Create: `packages/dungeonmaker-js/test/browser/client.browser.test.ts`, `packages/dungeonmaker-js/test/browser/silent-worker.js`
- Create: `packages/dungeonmaker-js/test/fnv.ts` (aus `helpers.ts` herausgelöst, ohne `node:`-Imports; `helpers.ts` re-exportiert)
- Modify: `packages/dungeonmaker-js/vitest.config.ts` (`exclude` `test/browser/**`), `packages/dungeonmaker-js/tsconfig.json` (`exclude` `test/browser`), `packages/dungeonmaker-js/package.json` (Script), root `package.json` (devDependencies)
- Modify: `.github/workflows/ci.yml`, `scripts/test/workflows.test.mjs`

**Interfaces:**
- Consumes: der gebaute Entry `dungeonmaker-js` (`dist/index.js`), `dungeonmaker-js/presets`, `test/golden/native-fnv.json`.
- Produces: `pnpm --filter dungeonmaker-js test:browser` = `pnpm run build && tsc -p test/browser/tsconfig.json && vitest run -c vitest.browser.config.ts`; CI-Job `browser`.

Root-devDependencies: `@vitest/browser-playwright@5.0.5`, `playwright@1.64.1`. Browser-Config: `browser.enabled`, `provider: playwright()`, `headless: true`, `instances` aus `DM_BROWSERS` (Default `chromium,firefox,webkit`), `include: ['test/browser/**/*.browser.test.ts']`, Aliase `^dungeonmaker-js$` → `dist/index.js` und `^dungeonmaker-js/(.+)$` → `dist/$1.js`. `test/browser/tsconfig.json`: erweitert `../../../../tsconfig.base.json`, `lib: ["ES2022", "DOM"]`, `types: ["vitest/globals"]`, `resolveJsonModule: true`, `noEmit: true`.

- [ ] **Step 1: Browser installieren**

Run: `mise x -- pnpm install && mise x -- pnpm exec playwright install chromium firefox webkit`
Expected: drei Browser installiert. Scheitert WebKit an der Distribution, lokal mit `DM_BROWSERS=chromium,firefox` weiterarbeiten und das im Abschlussbericht nennen.

- [ ] **Step 2: Write the failing test** `test/browser/client.browser.test.ts`:

```ts
import { createDungeon, createDungeonMaker, GenerationError, TimeoutError, toDesignText, WorkerError } from 'dungeonmaker-js';
import { design, design3A } from 'dungeonmaker-js/presets';
import golden from '../golden/native-fnv.json' with { type: 'json' };
import { fnv1a32 } from '../fnv.js';

test('createDungeon generates the golden dungeon and transfers exactly the cells', async () => {
  const d = await createDungeon({ design: design3A, seed: 42 });
  expect(fnv1a32(d.cells)).toBe(golden['design3A:42']);
  expect(d.cells.buffer.byteLength).toBe(d.width * d.height);
});
test('parallel calls resolve in order with their golden hashes', async () => {
  const seeds = [1, 2, 3, 42, 4294967295] as const;
  const all = await Promise.all(seeds.map((seed) => createDungeon({ design: design3A, seed })));
  expect(all.map((d) => fnv1a32(d.cells))).toEqual(seeds.map((s) => golden[`design3A:${s}`]));
});
test('crash recovery: an assert abort, then the next request works', async () => {
  const dm = createDungeonMaker();
  // derselbe Assert-Fall wie in core-errors.test.ts, dort an den Vendor-Text von `design` gehängt
  const broken = `${toDesignText(design)}\nWS 500 500 WE SW 0 15 2 4 1 7 0 20 0 60 10\n`;
  await expect(dm.create({ design: broken, seed: 1 })).rejects.toBeInstanceOf(GenerationError);
  expect(fnv1a32((await dm.create({ design: design3A, seed: 42 })).cells)).toBe(golden['design3A:42']);
  dm.dispose();
});
test('timeout against a worker that never answers', async () => {
  const dm = createDungeonMaker({
    worker: () => new Worker(new URL('./silent-worker.js', import.meta.url), { type: 'module' }),
    timeout: 200,
  });
  await expect(dm.create({ design: design3A, seed: 1 })).rejects.toBeInstanceOf(TimeoutError);
  dm.dispose();
});
test('abort while running', …);              // silent worker, AbortController, abort nach 50 ms → name 'AbortError'
test('a wrong wasmUrl is a WorkerError, a fresh client works afterwards', async () => {
  const dm = createDungeonMaker({ wasmUrl: '/does-not-exist.wasm' });
  await expect(dm.create({ design: design3A, seed: 1 })).rejects.toBeInstanceOf(WorkerError);
  dm.dispose();
  await expect(createDungeonMaker().create({ design: design3A, seed: 1 })).resolves.toBeTruthy();
});
test('dispose rejects a pending request with AbortError', …);
```

`silent-worker.js`: SPDX-Kopf, ein `self.addEventListener('message', () => {})`, sonst nichts — kein Timer, keine Last.

- [ ] **Step 3: Run test to verify the setup**

Run: `mise x -- pnpm --filter dungeonmaker-js test:browser`
Expected: zuerst FAIL, solange Script/Config fehlen; nach dem Anlegen von Config, Script, Aliasen und `test/fnv.ts` PASS in allen gewählten Engines. Schlägt ein einzelner Test nur in einer Engine fehl, ist das ein Befund für den Client (nicht per `skip` wegdrücken).

- [ ] **Step 4: Node-Suite bleibt sauber**

Run: `mise x -- pnpm test && mise x -- pnpm typecheck && mise x -- pnpm lint`
Expected: PASS; `pnpm test` führt keine `*.browser.test.ts` aus.

- [ ] **Step 5: CI-Job `browser`** in `ci.yml`: `checkout`, `jdx/mise-action`, `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium firefox webkit`, `pnpm --filter dungeonmaker-js test:browser`; `ci.needs` um `browser` erweitern. In `scripts/test/workflows.test.mjs`:

```js
test('browser tests are part of the required ci gate and run all three engines', () => {
  const { jobs } = load('ci.yml');
  expect(jobs.ci.needs).toContain('browser');
  const install = jobs.browser.steps.find((s) => s.run?.includes('playwright install'));
  expect(install?.run).toMatch(/chromium firefox webkit/);
  expect(JSON.stringify(jobs.browser)).not.toMatch(/DM_BROWSERS/);
});
```

Run: `mise x -- pnpm vitest run scripts/test/workflows.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml packages/dungeonmaker-js .github/workflows/ci.yml scripts/test/workflows.test.mjs
git commit -m "test(client): browser tests in chromium, firefox and webkit"
```

---

### Task 8: Bundler-Fixtures, CSP-Rezept, README und Status

**Files:**
- Create: `fixtures/bundlers/vite/package.json`, `fixtures/bundlers/vite/index.html`
- Create: `fixtures/bundlers/webpack/package.json`, `fixtures/bundlers/webpack/index.html`
- Create: `scripts/bundler-smoke.mjs`
- Modify: root `package.json` (Script `bundler:smoke`), `.github/workflows/ci.yml`, `scripts/test/workflows.test.mjs`
- Modify: `packages/dungeonmaker-js/README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: das gepackte Tarball (`pnpm --filter dungeonmaker-js pack`), `playwright` (Task 7), Golden-Hash `design3A:42` = `99cc67de`.
- Produces: `pnpm bundler:smoke`, CI-Job `bundlers`, README-Abschnitte.

Fixture-`package.json` (je `private`, `type: module`): Vite-Fixture `devDependencies: { "vite": "8.3.5" }`, webpack-Fixture `{ "webpack": "5.112.2", "webpack-cli": "7.3.1" }`. Keine `vite.config.*`, keine `webpack.config.*` — das ist der Beweis für »ohne Konfiguration«. Vite-`index.html` lädt `/src/index.js` als Modul; webpack-`index.html` lädt `main.js` als klassisches Skript (Default-Output `dist/main.js`).

- [ ] **Step 1: README schreiben (der Fixture-Quellcode kommt daraus).** Neuer Abschnitt `## Quick start (browser)` direkt unter dem Pitch, mit genau einem `js`-Block:

```js
import { createDungeon } from 'dungeonmaker-js';
import { design3A } from 'dungeonmaker-js/presets';

const dungeon = await createDungeon({ design: design3A, seed: 42 });
// dungeon.width, dungeon.height, dungeon.cells (Uint8Array, row-major), dungeon.get(x, y)
```

Weitere Abschnitte (Englisch, knapp): `## Worker client` (`createDungeonMaker`-Optionen mit Defaults, `ready`, `dispose`, `signal`/`timeout` pro Aufruf, Timeout zählt ab Versand, eine Anfrage zur Zeit), `## Errors` (Tabelle der fünf Fälle aus den Festlegungen), `## Bundlers` (Vite und webpack 5 ohne Konfiguration; Escape Hatches `wasmUrl` und `worker` mit dem Rezept `import 'dungeonmaker-js/worker';` in einem eigenen Worker-Modul), `## Content Security Policy` (die drei Direktiven aus den Festlegungen, Begründung `'wasm-unsafe-eval'` für `WebAssembly.compile`). Status-Zeile oben: Web Worker client verfügbar, CLI folgt.

- [ ] **Step 2: Write the smoke script** `scripts/bundler-smoke.mjs` (Aufbau wie `scripts/pack-smoke.mjs`, Temp-Verzeichnisse per `mkdtempSync`, im `finally` gelöscht):
  1. Tarball packen; README-Block unter `## Quick start (browser)` extrahieren (fehlt er: Fehler mit Abschnittsnamen).
  2. Pro Fixture: in ein Temp-Verzeichnis kopieren, `src/index.js` = README-Block + Reporter (`window.__dungeon = { width, height, byteLength: dungeon.cells.buffer.byteLength, hash: fnv1a32(dungeon.cells) }`, Fehler nach `window.__dungeonError`), `pnpm install`, `pnpm add <tarball>`.
  3. Build: Vite `pnpm exec vite build`, Ausgabe darf `/externaliz|warn/i` nicht enthalten; webpack `pnpm exec webpack --mode production`, Ausgabe muss `compiled successfully` enthalten; danach `index.html` nach `dist/` kopieren.
  4. `dist/` per `node:http` ausliefern (`.wasm` als `application/wasm`) mit Header `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'`; Chromium per `playwright` öffnen, auf `__dungeon` oder `__dungeonError` warten (30 s), Konsolenfehler und `securitypolicyviolation` einsammeln.
  5. Vite zusätzlich im Dev-Modus: freien Port per `node:net` holen, `pnpm exec vite --port <p> --strictPort --host 127.0.0.1` starten, auf `ready` in der Ausgabe warten, dieselbe Prüfung ohne CSP, Prozess beenden.
  6. Erwartung je Lauf: `hash === '99cc67de'`, `byteLength === width * height`, keine CSP-Verletzung, keine Konsolenfehler außer `favicon.ico`. Abweichung → Exit 1 mit Fixture-Namen und Befund.

- [ ] **Step 3: Run it**

Run: `mise x -- pnpm build && mise x -- pnpm bundler:smoke`
Expected: drei Zeilen `bundler smoke ok: vite build 99cc67de`, `… vite dev 99cc67de`, `… webpack 99cc67de`. Schlägt webpack mit `UnhandledSchemeError` fehl, fehlt ein Magic Comment (Task 1 erneut prüfen); scheitert Vite mit `INVALID_TLA_FORMAT`, hat ein vom Worker geladenes Modul Top-Level-`await`.

- [ ] **Step 4: CI-Job `bundlers`** in `ci.yml`: `checkout`, `jdx/mise-action`, `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`, `pnpm build`, `pnpm bundler:smoke`; `ci.needs` um `bundlers` erweitern. Test in `scripts/test/workflows.test.mjs`:

```js
test('the bundler smoke test is part of the required ci gate', () => {
  const { jobs } = load('ci.yml');
  expect(jobs.ci.needs).toContain('bundlers');
  expect(jobs.bundlers.steps.some((s) => s.run?.includes('pnpm bundler:smoke'))).toBe(true);
});
```

- [ ] **Step 5: `CLAUDE.md` aktualisieren.** Status: Phasen 0–3 erledigt (Plan-Verweis auf diese Datei), Phase-2-Branch-Hinweis korrigieren (Phase 2 liegt auf `master`), Phase 3 auf `phase-3-worker-client`, unveröffentlicht; Entry-Liste um `createDungeon`/`createDungeonMaker` und `dungeonmaker-js/worker`; Layout um `src/client/`, `src/worker/`, `src/protocol.ts`, `fixtures/bundlers/`; Commands um `pnpm --filter dungeonmaker-js test:browser` (mit `DM_BROWSERS`) und `pnpm bundler:smoke`; Gotchas um die drei Bundler-Regeln aus den Global Constraints.

- [ ] **Step 6: Gesamtprüfung**

Run: `mise x -- pnpm lint && mise x -- pnpm typecheck && mise x -- pnpm test && mise x -- pnpm build && mise x -- pnpm size && mise x -- pnpm check:package && mise x -- pnpm pack:smoke && mise x -- pnpm --filter dungeonmaker-js test:browser && mise x -- pnpm bundler:smoke`
Expected: alles PASS. Das ist M3: `await createDungeon({ design: presets.design3A, seed: 42 })` läuft in Vite (Build und Dev) und webpack ohne Konfiguration, unter strikter CSP, und jeder Fehlerpfad endet in einer Rejection.

- [ ] **Step 7: Commit**

```bash
git add fixtures scripts/bundler-smoke.mjs package.json .github/workflows/ci.yml scripts/test/workflows.test.mjs packages/dungeonmaker-js/README.md CLAUDE.md
git commit -m "test: vite and webpack fixtures consume the packed tarball under strict CSP"
```
