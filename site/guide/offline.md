# Generate offline, ship data

`dungeonmaker-js` is GPL-3.0-or-later (see [License](/license)). That matters most when the code
travels with your product, and it does not have to.

## The catch with web bundles

A web page that imports the package ships JavaScript and WebAssembly to every visitor. That is
distribution of GPL-licensed object code. For code that imports the package and runs in the same
bundle, the Free Software Foundation reads the combination as one work, so the application should
be released under a GPL-compatible license. The `postMessage` boundary of the worker is a grey
area; do not build a business model on it.

The conservative rule of thumb: if you build this package into an application you ship (a web
bundle counts), assume that the application must be released under a GPL-compatible license.

## The recipe

Generated files are program output and are not covered by the GPL. So run the generator on your
machine and ship only the result:

1. Generate the dungeons at build time, with the [CLI](/guide/cli) or `generateToFiles` from
   `dungeonmaker-js/node` in a build script.
2. Import the files in your game with your own code. The [dungeon file format](/reference/dungeon-format)
   is released under CC0-1.0, and a Tiled `.tmj` or a raw `.bin` needs no package at all.
3. Ship the data files, not the package.

```sh
npx dungeonmaker-js generate --preset design3A --seeds 1..100 --format json --out ./assets/dungeons
```

```js
import { generateToFiles } from 'dungeonmaker-js/node';

await generateToFiles({
  preset: 'design3A',
  seeds: [1, 2, 3],
  formats: ['json', 'tmj'],
  outDir: './assets/dungeons',
});
```

## Three rules for export files

The exporters follow these rules, and tests guard them:

1. **No code in export files.** Only map, layers, metadata and legend. The legend holds names like
   `"open"` or `"door"`: facts, not code.
2. **Upstream designs by reference only.** The eleven presets come from the GPL distribution of
   DungeonMaker, so a file names a preset (`"source": { "preset": "design3A" }`) and never embeds
   it. Your own designs appear only as a hash, unless you pass `--embed-design`.
3. **The format is free, the library is not.** The specification and `dungeon.schema.json` are
   CC0-1.0, so anyone can write an importer in any language under any license.

::: info Not legal advice
This page describes how the files are built and how the project reads the license. It is not
legal advice. If your product depends on the answer, ask a lawyer.
:::
