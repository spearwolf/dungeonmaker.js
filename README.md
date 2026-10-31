# dungeonmaker.js

An **unofficial** WebAssembly port of [DungeonMaker 2.05](http://dungeonmaker.sourceforge.net/)
by Peter Henningsen, a procedural dungeon generator. It ships as the npm package
[`dungeonmaker-js`](packages/dungeonmaker-js): WebAssembly core, Web Worker client, render and
export helpers, and a Node CLI. The same design and seed give the same dungeon on every platform.

- **Demo, guides and API reference:** <https://spearwolf.github.io/dungeonmaker.js/>
- **npm:** <https://www.npmjs.com/package/dungeonmaker-js>
- **Package README** (install and quick start): [`packages/dungeonmaker-js`](packages/dungeonmaker-js/README.md)
- **Changelog:** [`packages/dungeonmaker-js/CHANGELOG.md`](packages/dungeonmaker-js/CHANGELOG.md)
- **Design of the package:** [`docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md`](docs/superpowers/specs/2026-10-31-dungeonmaker-package-design.md)

## Development

The toolchain is pnpm with versions pinned in `mise.toml`; run tools through `mise x -- …` if they
are not on your `PATH`.

```sh
pnpm lint            # Biome and SPDX headers
pnpm typecheck
pnpm test            # Vitest: package, scripts and site
pnpm build           # the package
pnpm site:dev        # builds the package, then serves the site
pnpm site:build      # production build of the site
sh native/test/run.sh   # native tests (GCC and clang) against the golden hashes
sh native/build.sh      # rebuilds the wasm in a pinned Emscripten container
```

`CLAUDE.md` has the full command list, the determinism contract and the gotchas of the vendored
library. Releases are described in [`RELEASING.md`](RELEASING.md).

## Legacy

The original 2014 asm.js version is preserved at the git tag `legacy-2014`, its demo at
`legacy-2014-demo`.

## License

GPL-3.0-or-later; includes a modified version of DungeonMaker 2.05 © Peter Henningsen.
See `LICENSE` and `NOTICE`.
