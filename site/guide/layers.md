# Output layers

Besides the cells, `output` requests optional layers. `createDungeon`, `maker.create` and
`core.generate(designText, seed, output)` all take it; without `output` the result has only the
cells, byte-identical to before.

```js
const dungeon = await createDungeon({
  design: design3A,
  seed: 42,
  output: { rooms: true, entities: 'list', steps: true },
});
```

| Option              | Result                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rooms: true`       | `dungeon.rooms`: `roomIds` (`Uint16Array`, one id per cell, `0` = no room) and `rooms: { id, area: 'labyrinth' \| 'dungeon', size, bounds }[]` (screen coordinates). Ids are `uint16`, so at most 65 535 rooms. |
| `entities: 'list'`  | `dungeon.entities`: `{ kind: 'mob' \| 'treasure', x, y, level }[]`, MOBs first. Cells stay unchanged.                                                                                                           |
| `entities: 'baked'` | No `entities` field; MOBs and treasure are written into `cells` (`Mob1-3`, `Treasure1-3`).                                                                                                                      |
| `steps: true`       | `dungeon.steps`: `offsets`, `index` (`y * width + x`) and `cell`. Frame `k` is `index[offsets[k] … offsets[k + 1])`.                                                                                            |

::: warning Entities are upstream demo code
They come from the library's `PlonkDownStuff`, which its author calls demo code. It may place
fewer entities than the design's population asks for; that is logged in `dungeon.diagnostics`.
`level` is the index in the population list. For `'baked'` the level maps to the cell kind:
`level < 2` is `Mob1`/`Treasure1`, `< 4` is `Mob2`/`Treasure2`, everything else
`Mob3`/`Treasure3`. Entities need a map of at least 4x4. Only `'baked'` changes `cells`.
:::

::: warning `steps` can be large
Frame 0 is the start map and holds _every_ cell, so the layer is at least `width * height`
entries long; a 1024x1024 design yields several MB. Replaying all frames yields `cells`. `steps`
needs `showMovie` or `storeMovie` in the design (the `N` record of the raw design text);
otherwise the request is rejected with a `DesignValidationError`.
:::

Unknown keys or wrong values in `output` throw a `TypeError` (a rejection in `create()`).

The cell values and their names are listed in [Orientation and cell values](/guide/orientation).
The [Playground](/) shows all three layers as an overlay and replays the steps.
