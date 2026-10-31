# License

`dungeonmaker-js` is released under the **GPL-3.0-or-later**. The package contains a modified
version of DungeonMaker 2.05, copyright Peter Henningsen (alifegames), published under the same
license. The full text is in the `LICENSE` file of the package, the attribution in `NOTICE`.

The package is an unofficial WebAssembly port of
[DungeonMaker 2.05](http://dungeonmaker.sourceforge.net/); it is not endorsed by or affiliated
with the upstream author.

## What this means if you use the package

- **Open source projects** that are GPL-compatible can use the package as they like.
- **Applications you ship** (a web bundle counts as shipping, since the browser receives the code)
  should be assumed to need a GPL-compatible license when they include this package. The
  conservative rule: if you build the package into an application you distribute, release that
  application under a GPL-compatible license.
- **Generated data is not code.** Dungeons generated offline and shipped as plain data files are
  program output, not GPL-covered code. See [Generate offline, ship data](/guide/offline) for the
  recipe and the three rules the export files follow.
- **Presets** come from the GPL distribution of DungeonMaker. Export files therefore name a preset
  and never embed its content.

None of this is legal advice.

## Corresponding Source

The Corresponding Source of every published version is the git tag `v<version>` of
<https://github.com/spearwolf/dungeonmaker.js>, where `<version>` is the version of the package.
For example, `dungeonmaker-js@1.0.0` corresponds to the tag `v1.0.0`. The tag contains the
unmodified upstream sources, our patches against them, and the build script that produces the
WebAssembly file; a rebuild from the tag is bit-for-bit reproducible.

## The dungeon file format is CC0

The specification of the dungeon file format (the page [Dungeon file format](/reference/dungeon-format)
and the JSON Schema `dungeon.schema.json`) is released under **CC0-1.0**. You can write an importer
for it in any language under any license, without this package.

## Credits

- **Peter Henningsen** wrote DungeonMaker and published it as free software through alifegames.
- **Aaron Dalton** contributed to the upstream project.
- The WebAssembly port, the TypeScript package and this site are by the dungeonmaker.js
  contributors.
