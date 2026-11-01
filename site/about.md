# About

`dungeonmaker-js` brings a dungeon generator from 2001 to today's browsers and to Node. Two
people's work stands behind the generator itself, and one person's behind everything around it.

## Where DungeonMaker comes from

**DungeonMaker** was written by **Dr. Peter Henningsen** (alifegames) and published as free
software under the GPL, with its home at [dungeonmaker.sourceforge.net](http://dungeonmaker.sourceforge.net/).
It does not draw dungeons from a template. It grows them: small autonomous builders walk across
the map, **crawlers** raising walls into labyrinths, **tunnelers** carving corridors and rooms,
spawning offspring generation after generation. A design file sets their genes, and the dungeon
emerges from what they do. The [design concepts](/guide/design-concepts) explain the details.

**Aaron Dalton** contributed to the upstream project and prepared release **2.05** in 2005: he
merged the changes from a forked project (the `generate()` method, designs passed as text instead
of files, accessors for rooms, monsters and treasure) and moved the project to the GNU build
system. Release 2.05 is the last one upstream, and it is the version this port is built on.

The upstream sources, the manual and the eleven sample designs are part of this repository,
byte-identical to the 2.05 release tarball, in
[`native/vendor/dungeonmaker-2.05`](https://github.com/spearwolf/dungeonmaker.js/tree/master/native/vendor/dungeonmaker-2.05).
The few changes the port needs live next to them as small, documented patches.

## Who carries it on

The WebAssembly port, the npm package, the command line tool and this site are created and
maintained by [spearwolf](https://www.spearwolf.de).

I continued DungeonMaker because I enjoy generating dungeons and mazes, and I enjoy JavaScript,
and this generator sits right where the two meet. Upstream has been quiet since 2005, and it seemed a shame to leave such a
generator lying around orphaned. So I first ported it to the browser in 2014, compiled to asm.js
with Emscripten (still preserved at the git tag `legacy-2014`). In 2026 I turned that experiment
into a proper package: a WebAssembly core that produces the same dungeon for the same design and
seed on every platform, a Web Worker client, JSON designs with a schema, render and export
helpers, a CLI, and the [playground](/) and [editor](/editor) on this site.

This is an **unofficial** port: it is not endorsed by or affiliated with the upstream author.
Issues and ideas are welcome at
[github.com/spearwolf/dungeonmaker.js](https://github.com/spearwolf/dungeonmaker.js).

## License

DungeonMaker 2.05 is © 2001 Dr. Peter Henningsen. The port, the package and this site are by
[spearwolf](https://www.spearwolf.de). All of it is released under the GPL-3.0-or-later; the
[license page](/license) explains what that means for you.
