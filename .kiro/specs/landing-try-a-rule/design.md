# Design Document

## Overview

- Search wrapper. `site/try-rule.ts` builds the garden definition from the level list with only g03 changed (a copy, in memory), runs `solveTurn` with the same options as `npm run prove` (`turnOptions` of the garden proof file) plus a node cap, then replays the winning moves in a session to read the final hash. It reads no file and calls no network.
- Page. `site/index.html` gets a small box under the demo with a number field, a Run button, a Restore button and a result line. `site/landing.ts` wires them. The result holds `data-won`, `data-count` and `data-hash` for the tests.
- Cost. The search on g03 visits about a dozen states. The limit is capped at 1 to 20 and the search at 20000 states, so it ends in milliseconds and runs in the page with no worker. A unit test records the time of the largest limit.
- Phone links. The two game links move into the first screen on a phone. They keep `data-card` and the text "Play Moth Garden" and "Play Broom Runner", each with a short label for the kind of game.
- Capture plan. `tools/capture-hero.mjs` exports `CAPTURE_PLAN`, a list of frames. The runner frame is played through the page with real key presses until the broom is in the air. The module runs its capture only when started from the command line.

- Hero test. `tests/docs/hero.test.ts` checks the alt text of the README image against the three panels of `CAPTURE_PLAN`.

## Limits

The wrapper imports the garden level list and rules and `kit/solver`, because the search must run on the real level. The page is built by the normal site build. Each log row names the folders touched.

## Update 2026-11-27
The generic Play in the browser anchor (`data-link=play-now`) is removed. The intro keeps the Get the kit button and the two named game links. Demo, judge replay, film, Devpost and counts are unchanged.
