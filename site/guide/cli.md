# Command line

The package ships a `dungeonmaker-js` command. Run it without installing:

::: code-group

```sh [pnpm]
pnpm dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj --out ./dungeons
pnpm dlx dungeonmaker-js generate --design ./my-cave.json --seeds 1..50 --format json --name "cave-{seed}"
pnpm dlx dungeonmaker-js generate --design ./old-design.txt --count 10 --rooms --entities list
```

```sh [npm]
npx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj --out ./dungeons
npx dungeonmaker-js generate --design ./my-cave.json --seeds 1..50 --format json --name "cave-{seed}"
npx dungeonmaker-js generate --design ./old-design.txt --count 10 --rooms --entities list
```

```sh [yarn]
yarn dlx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj --out ./dungeons
yarn dlx dungeonmaker-js generate --design ./my-cave.json --seeds 1..50 --format json --name "cave-{seed}"
yarn dlx dungeonmaker-js generate --design ./old-design.txt --count 10 --rooms --entities list
```

```sh [bun]
bunx dungeonmaker-js generate --preset design3A --seed 42 --format json,png,tmj --out ./dungeons
bunx dungeonmaker-js generate --design ./my-cave.json --seeds 1..50 --format json --name "cave-{seed}"
bunx dungeonmaker-js generate --design ./old-design.txt --count 10 --rooms --entities list
```

:::

The other commands:

::: code-group

```sh [pnpm]
pnpm dlx dungeonmaker-js presets                      # list the eleven presets
pnpm dlx dungeonmaker-js validate ./my-cave.json      # exit code 1 on errors
pnpm dlx dungeonmaker-js convert ./old-design.txt     # legacy text -> design JSON
pnpm dlx dungeonmaker-js schema dungeon > dungeon.schema.json
```

```sh [npm]
npx dungeonmaker-js presets                      # list the eleven presets
npx dungeonmaker-js validate ./my-cave.json      # exit code 1 on errors
npx dungeonmaker-js convert ./old-design.txt     # legacy text -> design JSON
npx dungeonmaker-js schema dungeon > dungeon.schema.json
```

```sh [yarn]
yarn dlx dungeonmaker-js presets                      # list the eleven presets
yarn dlx dungeonmaker-js validate ./my-cave.json      # exit code 1 on errors
yarn dlx dungeonmaker-js convert ./old-design.txt     # legacy text -> design JSON
yarn dlx dungeonmaker-js schema dungeon > dungeon.schema.json
```

```sh [bun]
bunx dungeonmaker-js presets                      # list the eleven presets
bunx dungeonmaker-js validate ./my-cave.json      # exit code 1 on errors
bunx dungeonmaker-js convert ./old-design.txt     # legacy text -> design JSON
bunx dungeonmaker-js schema dungeon > dungeon.schema.json
```

:::

`dungeonmaker-js --help` lists every option of `generate`: `--seed`, `--seeds`
(`1..50,99`, at most 10 000), `--count`, `--format`, `--out`, `--name` (`{name}` and `{seed}`;
`{seed}` is required for several seeds), `--rooms`, `--entities list|baked`, `--steps`,
`--manifest`, `--embed-design`, `--scale`. Existing files are overwritten; the output is
reproducible.

## Exit codes

| Code | Meaning                                                                                 |
| ---- | --------------------------------------------------------------------------------------- |
| `0`  | Success.                                                                                |
| `1`  | Design, validation, generation or file error.                                           |
| `2`  | Usage error: unknown command, missing or conflicting options, invalid seeds or formats. |

Legacy design text is checked with `parseDesignText` first, so text the parser rejects (for
example an `N` record with `showMovie` and `storeMovie` both `0`) has to be fixed before the CLI
generates it; `dungeonmaker-js/core` takes raw text directly.

## From a build script

The same from a build script (Node only):

```js
import { generateToFiles } from 'dungeonmaker-js/node';

await generateToFiles({
  preset: 'design3A',
  seeds: [1, 2, 3],
  formats: ['json', 'png'],
  outDir: './dungeons',
  output: { rooms: true },
});
```

The files are the ones described in [Rendering and export](/guide/render-export). The
[Playground](/) shows the matching command for every dungeon it displays: copy it and the CLI
writes the very same files.
