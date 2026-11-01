# Changelog

All notable changes to `dungeonmaker-js` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The README shows the DungeonMaker.js logo.

### Fixed

- `author` carries the homepage URL again; the name in 1.0.1 contained parentheses, which npm
  reads as the URL part.

## [1.0.1] - 2026-11-01

### Fixed

- The schema description of `behaviour.patience` now says what the generator does with it: a
  double-spawning tunneler builds a room only when a roll of 0 … 100 exceeds `patience` (it was
  described as the steps a builder tolerates without progress).

### Changed

- README and `author` credit the port to spearwolf (<https://www.spearwolf.de>) next to the
  upstream authors.

## [1.0.0] - 2026-11-01

### Added

- JSON designs: `parseDesignText`, `toDesignText` and `extendDesign` in the main entry, plus the
  eleven upstream designs as JSON in `dungeonmaker-js/presets`.
- `dungeonmaker-js/schema` (`validateDesign`, TypeBox model) and the generated
  `dungeonmaker-js/design.schema.json`; designs are checked semantically before they reach the
  generator.
- Web Worker client: `createDungeon` and `createDungeonMaker` with a lazy worker, FIFO queue,
  timeout and `AbortSignal` support, and typed errors (`DesignValidationError`,
  `GenerationError`, `TimeoutError`, `WorkerError`).
- Output layers: `rooms`, `entities` (`'list'` or `'baked'`) and `steps`, available in the client
  and in `core.generate`.
- `dungeonmaker-js/render`: `toAscii`, `toTiles`, `toRgba`, `toImageData` and `drawToCanvas`.
- `dungeonmaker-js/export`: self-describing dungeon JSON (specified by
  `dungeonmaker-js/dungeon.schema.json`, CC0-1.0), PNG with a deterministic deflate, Tiled `.tmj`
  with its tileset, ASCII and raw output.
- `dungeonmaker-js/node` (`generateToFiles`) and the `dungeonmaker-js` CLI with the commands
  `generate`, `presets`, `validate`, `convert` and `schema`.
- Documentation site on GitHub Pages: playground, design editor, guides, config and file-format
  reference, and a TypeDoc API reference.
- This changelog, shipped in the package, and a tarball compliance check that runs before every
  publish.

### Changed

- The package README is short; the long-form documentation moved to the site.
- `homepage` points to the documentation site.

## [0.0.2] - 2026-10-31

### Added

- Release pipeline: npm Trusted Publishing from GitHub Actions with provenance, version check
  against npm, git tag `v<version>` and a GitHub release carrying the tarball and
  `source.tar.gz` as corresponding source.

## [0.0.1] - 2026-10-31

### Added

- Placeholder release that reserves the package name, with the `dungeonmaker-js/core` entry
  (`loadCore()`, `generate(designText, seed)`) on top of the WebAssembly build of DungeonMaker 2.05.
