---

layout: page
title: Design editor
---

<div class="vp-doc dm-home">

# Design editor

Write your own design as JSON. Completion (<kbd>Ctrl</kbd>+<kbd>Space</kbd>) and hover help come
from `design.schema.json`; the diagnostics come from the package's own validation, so the editor
reports exactly what `validateDesign`, `toDesignText` and the CLI report. **Generate** stays
disabled while there are problems. The text is kept in your browser's local storage.

Got a design file from DungeonMaker 2.05? **Import legacy text** turns it into JSON. Downloads
include `design.json`, and the copied CLI command reads it from the current directory.

<ClientOnly>
  <DesignEditor />
</ClientOnly>

</div>
