# Design Document

## Overview

The build copies the window of each runner proof into the page. The card text is made by the pure function `describeFacts`, which gets an optional `window` in ticks.

## Components

- `tools/level-facts.mjs`: for each level of the index, reads `proofs/<game>/<id>.json` when it exists. When that proof has `kind` equal to `tick`, it reads the check `window_ok` and takes the number in "smallest window N ticks". A missing check, a failed check or a detail without a whole number throws an error that names the level and says to run `npm run prove`. The number is stored as `window` next to `actions`.
- `kit/shell/src/difficulty.ts`: `LevelFacts` gets `window?: number`. For a tick level with a window the text is "wins in 687 ticks, tightest jump 9 steps, about 150 ms". The milliseconds are `Math.round(window * 1000 / 60)`. A new function `describeWindow` gives the two short lines of the card, for example "10 steps" and "167 ms".
- `kit/shell/src/level-facts.ts`: reads `window` from the page tag and skips a window that is not a whole number.
- `kit/shell/src/screens/levels.ts`: an open tick card with a window adds a block with `data-window`, hidden from the screen reader because the name holds the same numbers. The card also gets `data-window-ticks`.
- `kit/shell/src/styles.ts`: the block uses the style of the moves label, 12 px, on two lines so it fits the 88 px card.

## Tests

- `kit/shell/src/difficulty.test.ts`: 10 gives 10 steps and 167 ms, 9 gives 9 steps and 150 ms.
- `tools/level-facts.test.ts` and `tools/build.test.ts`: all six runner proofs give their `window_ok` value. A wrong or missing detail fails with the level name.
- `kit/shell/src/screens/levels-window.test.ts`: card text and name.
- `e2e/runner-jump-timing.e2e.ts`: the open card of r01 shows the value read from `proofs/runner/r01.json`, and the layout rules hold at 360x640 and 1280x800.
