# Vendored upstream sources

`dungeonmaker-2.05/` contains files from the DungeonMaker 2.05 source release by
Peter Henningsen (alifegames), <http://dungeonmaker.sourceforge.net>.
They are **byte-identical** to the release tarball. Do not edit them; changes go into
`native/src/` (unity translation unit, bridge) or `native/patches/`.

- Tarball: `dungeonmaker-2.05.tar.gz`
- SHA-256: `3c613a5aca38ed9633189e82596f96a8288f76fac84687db049ef6a5615ec4df`
- The tarball itself lives in the git history (tag `legacy-2014`).

## Included (40 files)

`DungeonMaker.cpp`, `DungeonMaker.h`, the eleven sample designs (`design`, `design2`,
`design3A`, `design3WithTunnelers`, `design4A`, `design5`, `design6`, `design7`,
`designEmpty`, `designEmpty2`, `designOld1`), `DM2_Manual/` (21 files), `AUTHORS`,
`ChangeLog`, `COPYING`, `NEWS`, `README`, `VERSION`.

## Excluded

Autotools files (`configure*`, `aclocal.m4`, `config.*`, `depcomp`, `install-sh`,
`ltmain.sh`, `missing`, `autom4te.cache/`), all `Makefile*`, the native CLI `main.cpp`
and the SDL front end `interactive/`.

## Upstream quirks, deliberately left as they are

- `VERSION` says `2.04`, although the release is 2.05.
- `COPYING` is empty (0 bytes). The license text this project distributes is the root `LICENSE`.
- `AUTHORS` names Peter Henningsen and Aaron Dalton.
