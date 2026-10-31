# Patches to the vendored DungeonMaker sources

There are no patches yet. Each future patch is a unified diff (`*.patch`) that starts,
before its first `---` line, with this header:

```
Patch: <name>.patch
Applies to: native/vendor/dungeonmaker-2.05/<file>
What: <one sentence: what changes>
Why: <one sentence, with the spec section that requires it>
Date: YYYY-MM-DD
SPDX-License-Identifier: GPL-3.0-or-later
```

Patches are applied by the build to a temporary copy of the sources. The directory
`native/vendor/dungeonmaker-2.05/` itself always stays byte-identical to the upstream
release (see `native/vendor/README.md`), so every modification is visible as a file here.
