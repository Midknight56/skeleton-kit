# Implementation Plan

- [ ] 1. Scaffold the shell and the first failing tests
  - Create `kit/shell` with `package.json`, `tsconfig.json`, Vite and the DOM test environment for Vitest. Add Playwright at the root for `e2e/`, headless only. Write each licence in the log.
  - Write `storage.test.ts`, `theme.test.ts` and `layout.test.ts` from the design. Run them and see them fail.
  - Verify: `npm run typecheck` passes and the three test files fail because the code does not exist yet.
  - _Requirements: 1.3, 4.3, 6.3, 9.2_

- [ ] 2. Storage, theme check and layout check
  - Implement `storage.ts` with the memory fallback, `theme.ts` with `checkTheme`, and `layout.ts` with `checkControls`.
  - Verify: `npm test -- storage theme layout` passes.
  - _Requirements: 4.3, 4.4, 6.3, 9.1, 9.2_

- [ ] 3. Canvas painter
  - Write `painter.test.ts` first with a recorded canvas: layer order, device pixel ratio, sprite fallback to a rounded rectangle, and the 120 ms move for an item that keeps its id. See it fail.
  - Implement `painter.ts`.
  - Verify: `npm test -- painter` passes.
  - _Requirements: 6.1, 6.2, 6.5_

- [ ] 4. Play loop
  - Write `play.test.ts` first: the two tick clock tests from the design, input mapping through a fake `InputMap`, undo on a turn game, and the results event when the phase changes. See it fail.
  - Implement `play.ts`.
  - Verify: `npm test -- play` passes.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Screens and router
  - Implement the nine screens as plain DOM with a `data-control` attribute on every button, the router with browser history, pause on focus loss, and the reset confirmation box.
  - Write unit tests for the router and the confirmation box first.
  - Verify: `npm test -- screens router` passes.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 6. Stars, progress and lessons
  - Write tests first for the star rules, for progress that never gets worse, and for the lesson counter. See them fail.
  - Implement them in `play.ts`, `storage.ts` and the how to play screen.
  - Verify: `npm test -- stars lessons` passes.
  - _Requirements: 4.1, 4.2, 5.1, 5.2_

- [ ] 7. Sound
  - Implement `audio.ts` from the recipes. No sound before the first input. Two saved switches.
  - Write a unit test with a fake audio context that checks no node is created before the first input.
  - Verify: `npm test -- audio` passes.
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 8. Mount the garden puzzle
  - Add `apps/garden/src/input.ts` (a tap on a lantern item gives `light:<id>`, a tap on the lit lantern or the wait control gives `wait`, key 1 to 5 and space do the same), three lessons, `theme.ts` and `index.html`.
  - The theme is a first pick of colours with full saturation and contrast checks passing. It is replaced when the owner picks one.
  - Verify: `npm run build` works and the garden puzzle plays level `g01` to a win by hand in a browser.
  - _Requirements: 1.1, 1.2, 9.1, 9.3_

- [ ] 9. Layout and play through tests for the garden puzzle
  - Write `e2e/layout.spec.ts`, `e2e/garden-good-path.spec.ts` and `e2e/garden-bad-path.spec.ts`. Run them and fix every named control.
  - Replace the root `e2e` script with the Playwright run and add it to `verify` behind the variable `E2E=1`.
  - Verify: `E2E=1 npm run verify` passes.
  - _Requirements: 6.4, 10.1, 10.2, 10.3_

- [ ] 10. New game scaffold
  - Write `kit/create/src/new-game.test.ts` first for the three cases in requirement 11. See it fail.
  - Implement the template and the command. Replace the root `new:game` script.
  - Verify: the test passes, and `npm run new:game -- lights` in a temporary copy gives an app that passes `verify` and `prove`.
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 11. A third game written from a spec
  - In a temporary branch, run `npm run new:game -- lights`. Ask Kiro to create a short spec for a 4 by 4 version of the lights game with 6 levels and to implement it.
  - Record in the log: the spec text, the credits used, and the result of `runConformance` and `npm run prove` for the new game.
  - Keep the result under `examples/lights/` with its proof files. It is not a third app for the contest category.
  - Verify: `npm run verify` passes.
  - _Requirements: 11.2_

- [ ] 12. Mount the runner
  - Add `apps/runner/src/input.ts` (a tap anywhere in the play area or the space key gives `jump`), two lessons, `theme.ts` and `index.html`. The theme must differ from the garden theme in palette, button radius and signature shape.
  - Add `e2e/runner-good-path.spec.ts` and `e2e/runner-bad-path.spec.ts`.
  - Verify: `E2E=1 npm run verify` passes.
  - _Requirements: 3.2, 9.3, 10.1, 10.2_

- [ ] 13. Watch mode
  - Write `watch.test.ts` first: a good proof plays to `won` and shows the proved text, and a proof with a changed action shows `This proof is out of date`. See it fail.
  - Implement `watch.ts` and the watch screen with the two speeds and the pointer mark.
  - Verify: `npm test -- watch` passes.
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 14. Site and privacy page
  - Build `site/index.html`: one sentence on who the kit is for, the self playing `g03` with its tool calls beside it, two cards that open the games, and a link to the repository.
  - Build `site/privacy.html` with the beacon events and fields, generated from the same list `beacon.ts` uses.
  - Implement `beacon.ts`. With no `VITE_BEACON_URL` it must send nothing. Add a unit test for both cases.
  - Verify: `npm run build` gives `dist/` with `/`, `/garden/`, `/runner/` and `/privacy/`.
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 15. Version guard and build
  - Add a build step that fails when any `package.json` version is 1.0.0 or higher. Write its test first.
  - Verify: the test passes and `npm run build` passes.
  - _Requirements: 12.5_

- [ ] 16. Art, final themes and log
  - Replace the placeholder sprites with the final art files given for each game. Run `checkTheme` and the layout test again.
  - Add the log rows for this spec with the credits used.
  - Verify: `E2E=1 npm run verify` passes and `npm run prove -- --check` exits 0.
  - _Requirements: 1.2, 6.4, 9.2_
