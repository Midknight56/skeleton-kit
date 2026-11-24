# Design Document

## Overview

```text
power/menu-contrast-preview/
  plugin.json
  mcp.json
  server.mjs
  skills/preview-menu-colour/SKILL.md
tests/a11y/contrast-pairs.ts        pairsOf and its helpers, moved out of contrast.test.ts
tests/power/menu-contrast-preview.test.ts
```

## The server

`server.mjs` uses the MCP SDK and `zod`, the tool library of `kit/mcp/src/server.ts`. On each call it bundles `tests/a11y/contrast-pairs.ts`, `apps/garden/theme.ts` and `apps/runner/theme.ts` in memory with the installed `esbuild`, with `.svg` read as text, and loads the result from a data URL. No file is written. It copies the theme, sets the proposed colour, and measures the pairs twice, before and after.

`mcp.json` follows the launcher of `power/skeleton-kit/`: `node -e` checks `SKELETON_KIT_ROOT`, prints a message and exits 1 when it is missing, and otherwise imports `server.mjs` from that checkout.

## Calculation

`contrast-pairs.ts` exports `pairsOf` (the report shape, unchanged) and `measuredPairsOf`, which also holds the full precision ratio. Pass or fail comes from the full precision ratio. The shown ratio is cut to 2 decimals, as in the report. `rulesOf` and `themeCss` stay the source of the menu styles.

## Answer

One JSON text: `game`, `field`, `current`, `proposed`, `pairsChecked`, `newFailures`, `rows` (name, both ratios, minimum, both results) and the names of failures that already existed. An error is `{ error, field, message }` with `isError`.

## Tests

`tests/power/menu-contrast-preview.test.ts` starts the configured server from an empty folder with an MCP client. It covers the package and launch, the real colour changes, and the read only and bad input cases. It compares the theme files and the report before and after.

## README tests

The power count is read from the folders in `power/`. The server count stays the count of `.kiro/settings/mcp.json`, because the new power starts its server from its own `mcp.json`.