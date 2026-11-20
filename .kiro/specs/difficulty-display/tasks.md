# Implementation Plan

Rule for every task: write the test first and see it fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. Name no hook unless it was seen to fire. No task adds a package. Never edit a file in `proofs/` by hand. Keep the game words of the kit boundary rule out of `kit/`.

- [x] 1. The pure function (folder: `kit/shell`)
  - This task stands alone. A person can run only `npm test -- difficulty` in an editor.
  - Write `kit/shell/src/difficulty.test.ts` first. Cases: 2 of 5 with actions 4 gives 2 filled of 5 and `wins in 4, 2 of 5 first moves win`. 1 of 1 gives `1 of 1 first move wins`. 3 of 12 gives total 8 and filled from 1 to 7. 12 of 12 gives 8 of 8. 0 of 4 gives 0 of 4. No `firstMoves` gives total 0 and `wins in 687`, and with kind `tick` `wins in 687 ticks`. One `fast-check` property: for `legal` 0 to 60 and `winning` 0 to `legal`, filled is at most total, total is at most 8, and the text holds `actions`, `winning` and `legal`. Run it and see it fail because `difficulty.ts` does not exist.
  - Write `difficulty.ts` and export `describeFacts`, `LevelFacts` and `Difficulty` from `kit/shell/src/index.ts`.
  - Verify: `npm test -- difficulty` and `npm run typecheck` pass.
  - _Requirements: 1.1 to 1.4_

- [x] 2. Build wiring (outside the table: `tools/` and `vite.config.ts`)
  - Reason: the page build lives in the root `vite.config.ts` and `tools/`. No table folder builds a page, and no game file changes.
  - Write `tools/level-facts.test.ts` first, with a temporary `proofs/` tree. Cases: a turn index gives `actions` and `firstMoves`. A tick index gives `actions` only. `<` in an id becomes `\u003c`. A missing index, broken JSON, or an item without whole number `actions` throws a message that names the file and `npm run prove`. Add to `tools/build.test.ts`: `dist/garden/index.html` holds the `kit-level-facts` tag equal to `proofs/garden/index.json` for all 12 levels, `dist/runner/index.html` holds no `firstMoves`, and `dist/index.html` holds no tag. See them fail.
  - Write `tools/level-facts.mjs` and `tools/level-facts.d.mts`, and list `levelFactsPlugin` in `vite.config.ts`.
  - Verify: `npm test -- level-facts` passes. After `npm run build`, `npm test -- build` passes. The missing file case is tested in the temporary tree, never by moving a real proof file.
  - _Requirements: 2.1 to 2.4_

- [x] 3. The level select shows the facts (folder: `kit/shell`)
  - Write the tests first. `level-facts.test.ts`: the tag parses, and a missing or damaged tag gives an empty map. In `screens/screens.test.ts`: an open card with facts holds the pips (`filled` of them with `data-on`, row `aria-hidden`), the three `data-` numbers, and a name ending in the text. A locked card has no pips and its name ends `locked`. A card without `firstMoves` has no pips. The card text holds no digit besides the level number. A CSS check that the pip rules have no `transition` or `animation` and use palette values only. See them fail.
  - Write `level-facts.ts`. Change `screens/levels.ts`, `mount.ts`, `styles.ts` and `types.ts`. Sizes and colours are in design.md. The garden shows pips on 12 cards. The runner shows none and its names end with the tick count.
  - Verify: `npm test -- shell` passes, with the layout and menu card tests unchanged.
  - _Requirements: 3.1 to 3.6, 4.1, 4.2_

- [x] 4. End to end (outside the table: `e2e/`, `tests/a11y/`)
  - Reason: browser tests live in `e2e/` and the contrast test in `tests/a11y/`. They only read the built site.
  - Write `e2e/level-facts.e2e.ts` first, for both games at 360x640, 768x1024 and 1920x1080, with all levels open. It reads `proofs/<game>/index.json` and compares, for each card, `data-actions`, `data-first-legal`, `data-first-win` and the numbers parsed from the name with the index. It compares the pip count with `describeFacts`. It measures: the pip row inside its card with at least 8 px padding and no overlap with the level number or stars, cards at least 12 px apart, 16 px inside the screen, no card over the Back button, no new page scroll. A case with one expected number changed in memory must report a mismatch. Run it before the screen is wired in a build and see it fail.
  - Add one pair (filled pip and empty pip border against the card surface) to `tests/a11y/contrast.test.ts`, with theme colours only.
  - Verify: after `npm run build`, `npm run e2e` passes with `a11y.e2e.ts`, `layout.e2e.ts` and `menu-card.e2e.ts` unchanged, and `npm test -- contrast` passes.
  - _Requirements: 2.2, 3.1 to 3.6_

- [x] 5. README and docs (outside the table: `README.md`, `docs/`)
  - Write `tests/docs/difficulty.test.ts` first: the README paragraph names `proofs/garden/index.json`, `kit/shell/src/difficulty.ts` and `tools/level-facts.mjs`, says the numbers are facts of the proof, and holds none of `easy`, `hard` or `fun`. See it fail.
  - Add one short paragraph after the Innovation paragraph of the judging block: the prover finds the fewest actions and the first moves that can still win, `npm run prove` writes them, the build copies them into the page, and the level select shows them as pips. It says the proof shows a level can be won, not how it feels. Add "level facts" to the `kit/shell` row of "The kit" table. `docs/kit-contract.md` stays unchanged, and the log row says so.
  - Verify: `npm run verify` passes. The log row lists which checks ran and which did not.
  - _Requirements: 4.1, 4.3_
