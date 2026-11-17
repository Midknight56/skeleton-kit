# Implementation Plan

Rule for every task: when the task is finished, add one row to `docs/kiro-log.md` on the same day and leave the Credits cell empty. The owner fills it. A task that adds a dependency writes its licence in that row. A task changes one folder from the kit-boundary table. Root files, `tools/`, `docs/`, `.kiro/`, `e2e/`, `examples/`, `playwright.config.ts` and `vite.config.ts` are outside the table. Do not commit unless the owner asks. Never edit a file in `proofs/` by hand. Write every file as UTF-8 with no byte order mark and LF line endings, and do not use `Set-Content` or `Out-File` on Windows. A test file in `kit/` uses neutral ids, never a game word. The commands below use no `VAR=1` prefix, because the shell is PowerShell.

- [x] 1. Scaffold the shell package and the first failing tests
  - Folder: `kit/shell`, and root files.
  - Create `kit/shell` with `package.json` (name `@kit/shell`, depends on `@kit/core`), `tsconfig.json`, `src/index.ts`, and stub modules for `storage`, `theme` and `layout` that throw `not implemented`. Add `vite`, `jsdom` and `@playwright/test` as root dev dependencies, with `npm install --offline`. Add `e2e/**/*.ts` and `site/**/*.ts` to `include` in the root `tsconfig.json`. Write each licence in the log: Vite MIT, jsdom MIT, Playwright Apache-2.0. If a package is not in the offline cache, write that in the log and stop.
  - Write `storage.test.ts`, `theme.test.ts` and `layout.test.ts` from the design, with the `checkControls` numbers of the design. Files that need the DOM start with `// @vitest-environment jsdom`. Run them and see them fail.
  - Verify: `npm run typecheck` passes and the three test files fail only with `not implemented`.
  - _Requirements: 4.3, 6.3, 9.2_

- [x] 2. Storage, theme check and layout check
  - Folder: `kit/shell`.
  - Implement `storage.ts` with the memory fallback and the monotone `stars` and `best`, `theme.ts` with `checkTheme` (HSL saturation and WCAG contrast on `#rrggbb`), and `layout.ts` with `checkControls`, including the play area overlap.
  - Verify: `npm test -- storage theme layout` passes.
  - _Requirements: 4.3, 4.4, 6.3, 9.1, 9.2_

- [x] 3. Canvas painter, hit test and effects
  - Folder: `kit/shell`.
  - Write `painter.test.ts` first with a recorded canvas: layer order, device pixel ratio, sprite fallback to a rounded rectangle, the 120 ms move for an item that keeps its id, a new action that ends a running move, the hit test cases of the design, and shake and flash off when reduced motion is on. See it fail.
  - Implement `painter.ts` with `itemIdsAt`, the effects and the `data-scene` list.
  - Verify: `npm test -- painter` passes.
  - _Requirements: 3.1, 6.1, 6.2, 6.5_

- [x] 4. Play loop
  - Folder: `kit/shell`.
  - Write `play.test.ts` first, with a small fake game that has neutral names and a fake `InputMap`: the five tick clock cases of the design (50 frames of 20 ms gives 60 actions, 500 ms gives 5 and drops, 84 ms gives 5 and keeps 40, 100 ms gives 5 and drops, 4 times speed), the property of tick count, one input that counts for one tick only, `idle` when there is none, a null and an illegal text that change nothing, a key event ignored while a button has focus, a pointer event outside the play area ignored, undo on a turn game, seed 1, and the results event when the phase changes. See it fail.
  - Implement `play.ts`.
  - Verify: `npm test -- play` passes.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

- [x] 5. Screens and router
  - Folder: `kit/shell`.
  - Write unit tests first for the router, the confirmation box, pause on `blur` and on `visibilitychange`, the play strip numbers of the design (controls from 580 to 624 at 360 by 640), the level select tiles (locked after the first unfinished level, stars shown), the one time notice on the title screen when storage is blocked, the results screen with a reason text and no next button after the last level, and the credits screen. See them fail.
  - Implement the eight screens other than watch as plain DOM with a `data-screen` attribute on each root and a `data-control` attribute on every button, the router with browser history, pause on focus loss, the reset confirmation box and the play strip.
  - Verify: `npm test -- screens router` passes.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.5, 3.6, 4.4, 6.6_

- [x] 6. Stars, progress and lessons
  - Folder: `kit/shell`.
  - Write tests first for the star rules with the numbers of the design (par 4, and the runner counts), for progress that never gets worse, for the lesson counter (a first level started 4 times) and for the hint boxes (at most 2 words, removed at the first action, listed on the how to play screen with the keys). See them fail.
  - Implement them in `play.ts`, `storage.ts` and the how to play screen.
  - Verify: `npm test -- stars lessons` passes.
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2_

- [x] 7. Sound
  - Folder: `kit/shell`.
  - Write a unit test with a fake audio context first: no node is created before the first input, the two switches are saved and kept, and music loops from the music recipe. See it fail.
  - Implement `audio.ts` from the recipes and the sound names of the design.
  - Verify: `npm test -- audio` passes.
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 8. Mount a game
  - Folder: `kit/shell`.
  - Write `mount.test.ts` first, with the neutral fake game: `mountGame` shows the title screen, throws an `Error` that names `theme` when there is no theme, and `destroy` removes the DOM and the listeners. See it fail.
  - Implement `mount.ts`, and export `mountGame`, `checkTheme`, `checkControls`, `itemIdsAt` and the types of the design from `src/index.ts` only.
  - Verify: `npm test -- mount` passes.
  - _Requirements: 1.1, 1.2_

- [x] 9. Watch mode
  - Folder: `kit/shell`.
  - Write `watch.test.ts` first: a good proof plays to `won` and shows the proved text of a turn level and of a tick level, a proof with a changed action shows `This proof is out of date` and no proved text, a failed check hides the proved text, the pointer mark follows `anchorFor`, `?watch=<levelId>` starts at once, a bad level id is ignored, and the run starts again 3 seconds after the end. See it fail.
  - Implement `watch.ts` and the watch screen with the two speeds and the pointer mark. Read the replay with `expandActions` and check it with `runReplay` before the run.
  - Verify: `npm test -- watch` passes.
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Usage beacon
  - Folder: `kit/shell`.
  - Write `beacon.test.ts` first: with no `VITE_BEACON_URL` nothing is sent, with a url each of the four events sends the exact body of the design as `text/plain`, `open` has no `level`, only `level_end` has `result`, and no other field is ever present. See it fail.
  - Implement `beacon-events.ts` and `beacon.ts`, call the beacon from `mount.ts` and `play.ts`, and declare `import.meta.env` for the typecheck.
  - Verify: `npm test -- beacon` passes.
  - _Requirements: 12.3_

- [x] 11. Garden puzzle input, lessons and texts
  - Folder: `apps/garden`. This task changes no file that `garden-puzzle` made except by adding the new files below.
  - Write `src/input.test.ts` first, with the input cases of the design on the real first level, the anchors, the idle value, the button `wait`, the three lessons of requirement 15.1 (unique ids, at most 2 words), and a check that every anchor is `lantern-<k>` of an item in `view` of the start state of `g01` or the button id. See it fail.
  - Write `src/input.ts` (the input map and the lessons) and `src/results.ts` (the two reason texts).
  - Verify: `npm test -- input` passes.
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 15.1, 15.3, 15.4_

- [x] 12. Garden puzzle theme and page
  - Folder: `apps/garden`.
  - Write `theme.ts` (a first pick of colours with full saturation, a button radius, the signature `leaf`, sprite names `hedge`, `web`, `flower`, `lantern`, `lantern_lit`, `moth`, `moth_caught`, `moth_home`, sound recipes and a music recipe), `index.html` and `src/main.ts` that call `mountGame` with a `ProofSet` that fetches `../proofs/garden/` from the built site. The app does not import from `proofs/`. Write the credits lines. Write `src/theme.test.ts` first: `checkTheme` has no problem, and the fill of the `text` item of `hud-turn` in the first scene of `g01` (white, `#ffffff`) has a contrast of at least 4.5 on the theme background. See it fail. Do not change `game.config.ts`.
  - Verify: `npm test -- theme` passes and `npm run typecheck` passes.
  - _Requirements: 1.1, 9.1, 9.2_

- [x] 13. Build tooling
  - Folder: root files and `tools/`.
  - Write a test first for `tools/check-versions.mjs` (a fixture with 0.9.9 passes, 1.0.0 and 1.2.0 fail with the file name). See it fail.
  - Write `vite.config.ts`, `tools/build.mjs` (builds `site/` to `dist/`, and each app that has an `index.html` to `dist/<id>/` with a relative base, copies `proofs/` to `dist/proofs/`, runs the version guard), and `tools/build-apps.mjs` (builds every app of `kit.config.json` that is under `apps/` with its own `build` script). Replace the root scripts `build` and `build:apps`. The `build:apps` change must keep both `garden` and `runner` built, and the `runner` build exists only after `broom-runner` task 9.
  - Write a test of the build output: no load from another site (requirement 1.3), and the files `dist/garden/index.html` exist. The page of the runner and the site are added to it by tasks 17 and 21.
  - Verify: `npm run build` gives `dist/garden/index.html`, and `npm test -- check-versions build` passes.
  - _Requirements: 1.3, 11.2, 12.5_

- [x] 14. Garden puzzle play through tests
  - Folder: `e2e/`, and root files.
  - Write `playwright.config.ts` (headless, `testMatch` `**/*.e2e.ts`, a web server that serves `dist/`). Write `e2e/layout.e2e.ts` (all nine screens at the seven viewports, the control padding, no control outside the viewport), `e2e/garden-good-path.e2e.ts`, `e2e/garden-bad-path.e2e.ts` and `e2e/garden-keyboard.e2e.ts` with the steps of requirement 10, a fixture that fails a test on any page error or console error, and the `data-` attributes of the design. Run them and fix every named control in the owner folder of that control.
  - Add the root scripts `e2e` (Playwright) and `verify:e2e` (`npm run verify`, then `npm run e2e`).
  - If the Playwright browser cannot be installed, write that in the log and mark the task not done.
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 6.4, 10.1, 10.2, 10.3, 10.4_

- [x] 15. Garden puzzle watch address
  - Folder: `apps/garden`.
  - Write `src/watch-url.test.ts` first: `main.ts` hands the search text of the page address to `mountGame`, and `g03` is a level of the game, so that `?watch=g03` starts watch mode. See it fail, then change `main.ts`.
  - Verify: `npm test -- watch-url` passes.
  - _Requirements: 8.4, 12.2_

- [x] 16. Runner input, lessons and texts
  - Folder: `apps/runner`. Start only after `broom-runner` tasks 1 to 12 are checked, so that `src/def.ts`, `src/proof.ts` and `proofs/runner/` exist. If `levelPlans` is not exported from `src/proof.ts`, stop and say so, and do not change that file.
  - Write `src/input.test.ts` first: the input cases of requirement 14.1 and 14.2, the two lessons of requirement 15.2 (unique, at most 2 words, anchors `player` and `hud-score` exist in `view` of the start state of `r01`), the star cases of the design (4 candles, 3 candles, 0 candles), `fairTicks` equal to the `minWindow` of each plan (9, 9, 6, 6, 4, 4) and null for an unknown level, and the reason texts. See it fail.
  - Write `src/input.ts` and `src/results.ts`. Check that the page bundle of the runner holds no solver code. If `proof.ts` pulls it in, copy the six numbers into `results.ts` and keep a test that they equal `levelPlans`.
  - Verify: `npm test -- input` passes.
  - _Requirements: 3.3, 4.2, 14.1, 14.2, 14.3, 14.4, 14.5, 15.2, 15.3, 15.4_

- [x] 17. Runner theme and page
  - Folder: `apps/runner`.
  - Write `theme.ts` (a palette, button radius and signature shape that differ from the garden theme), `index.html` and `src/main.ts`, and the credits lines. Write `src/theme.test.ts` first: `checkTheme` has no problem, and every `text` item of the first scene of `r01` has a contrast of at least 4.5 on the theme background. See it fail.
  - Write `tools/themes.test.ts` (folder `tools/`, a second file in this task) that imports both `theme.ts` files and checks that `palette.primary`, `buttonRadius` and `signature` differ.
  - Extend the build output test with `dist/runner/index.html`.
  - Verify: `npm test -- theme` passes and `npm run build` gives `dist/runner/index.html`.
  - _Requirements: 1.1, 9.1, 9.2, 9.3_

- [x] 18. Runner play through tests
  - Folder: `e2e/`.
  - Add the runner to `e2e/layout.e2e.ts`. Write `e2e/runner-good-path.e2e.ts` (with `page.clock.install()` and 16 ms frames as in the design, after checking that the fake clock calls the frame callback every 16 ms), `e2e/runner-bad-path.e2e.ts` (a lost level with `Fell in a gap` or `Hit an obstacle`) and `e2e/runner-keyboard.e2e.ts`.
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 6.4, 10.1, 10.2, 10.3, 10.4_

- [x] 19. New game scaffold
  - Folder: `kit/create`, and root files.
  - Write `kit/create/src/new-game.test.ts` first, for the three cases of requirement 11, with the printed commands, no byte order mark and no CR in created files, and the copy of the repository linked with a junction. See it fail.
  - Implement the template (`.tpl` files, with the rules of `sample-lights`, three levels, tests, `build.mjs`, `theme.ts`, `input.ts`, `results.ts`, `index.html` and `main.ts`) and the command. Replace the root `new:game` script. The template has no game word of the repository.
  - Verify: the test passes, and in the temporary copy `npm run new:game -- lights`, then `npm run prove`, then `npm run verify` all exit 0.
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 20. A third game written from a spec
  - Folder: `examples/lights/`, and a temporary copy of the repository outside it.
  - In a temporary copy, run `npm run new:game -- lights`. Ask Kiro to write a short spec for a 4 by 4 version of the lights game with 6 levels and to implement it there. Copy the result into `examples/lights/` with its proof files and the spec text. Remove the temporary copy. Do not make a branch or a commit.
  - Record in the log: the spec text, what Kiro did, and the result of `runConformance` and `npm run prove` for the new game. Leave the Credits cell empty. If Kiro cannot run in the copy, write that and stop.
  - Verify: `npm run verify` passes in the repository.
  - _Requirements: 11.2_

- [x] 21. Site and privacy page
  - Folder: `site/`, with `tools/build.mjs`.
  - Build `site/index.html` and `site/landing.ts`: one sentence on who the kit is for, a frame that loads `garden/?watch=g03`, the tool calls from `proofs/garden/g03.json` beside it (`new_game` with level `g03` and seed 1, `act` with the actions of the replay, `replay`), two cards that open the games, and a link to the repository.
  - Build `site/privacy.html` with a place for the beacon events. `tools/build.mjs` fills it from `kit/shell/src/beacon-events.ts` and writes the storage key and the line about the address of the request.
  - Write `e2e/site.e2e.ts` and add the four pages to the build output test.
  - Verify: `npm run build` gives `dist/` with `/`, `/garden/`, `/runner/` and `/privacy/`, and `npm run verify:e2e` passes.
  - _Requirements: 12.1, 12.2, 12.4_

- [x] 22. Garden puzzle art
  - Folder: `apps/garden`.
  - Put the final art files given for the garden puzzle in `apps/garden/assets/` and point `theme.ts` at them. Every file must be original work made for this repository. If no files are given, leave the placeholders and write that in the log. Run `checkTheme`, the layout test and the garden play through tests again.
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 1.2, 6.4, 9.2_

- [x] 23. Runner art
  - Folder: `apps/runner`.
  - Do the same for the runner.
  - Verify: `npm run verify:e2e` passes.
  - _Requirements: 1.2, 6.4, 9.2_

- [x] 24. Final check and log
  - Folder: `docs/`.
  - Run `npm run verify:e2e` and `npm run prove -- --check`, and write the real results in the log. Name a hook in the log only if it was seen to fire.
  - Verify: both commands exit 0.
  - _Requirements: 6.4, 10.1, 10.2_
