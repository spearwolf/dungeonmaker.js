# Worker client

`createDungeon(request, opts?)` uses one shared client. For your own instance:

```js
import { createDungeonMaker } from 'dungeonmaker-js';

const maker = createDungeonMaker({ timeout: 10_000 });
await maker.ready(); // optional warm-up
const dungeon = await maker.create({ design, seed: 7 }, { signal: AbortSignal.timeout(5_000) });
maker.dispose();
```

Options of `createDungeonMaker`:

| Option     | Default  | Meaning                                                                                       |
| ---------- | -------- | --------------------------------------------------------------------------------------------- |
| `worker`   | bundled  | Factory returning a `Worker` (`WorkerLike`); see [Bundlers](/guide/getting-started#bundlers). |
| `wasmUrl`  | bundled  | URL of `dungeonmaker.wasm`. Relative strings resolve against the page URL.                    |
| `timeout`  | `30_000` | Milliseconds per request; `Infinity` disables it, otherwise `1 … 2147483647`.                 |
| `validate` | `false`  | Check the design with the schema validator first (loaded lazily).                             |

- The worker starts on first use. Requests run one at a time, in order (FIFO).
  With `validate: true` a config request joins the queue only after its validation, so a
  legacy-text request made later can overtake it.
- The timeout counts from dispatch to the worker. For the first request it includes worker start.
- The design is snapshotted when `create()` is called; later changes to the object have no effect.
- `ready()` starts the worker early and rejects with `TimeoutError` after `timeout`.
- `dispose()` terminates the worker and rejects pending requests with an `AbortError`.
- Per call: `{ signal, timeout }`. The seed is `1 … 2³²−1`; omitted, a random one is drawn.

## Errors

Every failure of `create()`, `createDungeon()` and `ready()` arrives as a rejection, never as a
promise that hangs.

| Error                   | Cause                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `DesignValidationError` | The design cannot run; `issues` carry JSON Pointer paths.                                                 |
| `GenerationError`       | The library hit an internal assert. The worker recovers.                                                  |
| `TimeoutError`          | The request exceeded `timeout`. The worker restarts on the next call.                                     |
| `RangeError`            | Invalid `seed` or `timeout` (an invalid `timeout` for `createDungeonMaker` throws right away).            |
| `DataCloneError`        | The design object cannot be structured-cloned (it holds a function or a symbol); a `DOMException`.        |
| `WorkerError`           | The worker could not start, crashed or speaks another protocol: a bundler or CSP problem, not the design. |
| `signal.reason`         | The call was aborted; by default an `AbortError` `DOMException`.                                          |

Error classes are exported from `dungeonmaker-js`; see the [API reference](/api/) for their
members.
