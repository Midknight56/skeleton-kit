# Implementation Plan

Rule for every task: when the task is finished, add one row to `docs/kiro-log.md` on the same day and leave the Credits cell empty. The owner fills it. A task that adds a dependency writes its licence in that row. A task changes one folder from the kit-boundary table. Root files, `tools/`, `docs/` and `.kiro/` are outside the table. Do not commit unless the owner asks. Never edit a file in `proofs/` by hand.

- [ ] 1. Scaffold the app and write the failing fixture tests
  - Create `apps/runner` with `package.json` (name `@app/runner`, depends on `@kit/core`, `@kit/solver` and `@kit/conformance`, and `esbuild` 0.28.2 as a dev dependency, MIT), `tsconfig.json` like the one in `apps/garden`, `game.config.ts` with the display title only, `src/rules/constants.ts` and the folders from the design. Do not import a theme. The theme belongs to the `shell-and-site` spec. Link the workspace with `npm install --offline`.
  - Create stub modules for `parseCourse`, `initState`, `actions`, `step`, `status`, `encodeAction`, `decodeAction` and `observe`. Each stub throws `not implemented`, so that the typecheck passes and the tests fail for the right reason.
  - Write `src/rules/fixtures.ts` with fixtures A to G, and `src/rules/step.test.ts` with every expectation of fixtures A, B and C from the table and its note. Run it and see it fail.
  - Verify: `npm run typecheck` passes and `npm test -- apps/runner` fails only with `not implemented`.
  - _Requirements: 1.1, 1.4, 3.2, 3.3, 4.1, 4.3, 4.5_

- [ ] 2. Course parser
  - Write `src/rules/course.test.ts` first, with one test for each problem in requirement 2.3 (each names its column where it has one, counted from 1), one for a character that is not allowed in each row, one good course, and one test that `initState` gives the start state of requirement 1.4 with the candles of the rows. See it fail.
  - Implement `parseCourse` and `initState`.
  - Verify: `npm test -- course` passes.
  - _Requirements: 1.4, 2.1, 2.2, 2.3_

- [ ] 3. One tick
  - Implement `actions`, `step`, `status`, `encodeAction` and `decodeAction` in `src/rules/step.ts`, with step 0 to step 7 of the design in order and the box table as plain functions.
  - Add the tests first and see them fail: the gap test (lost at tick 113), the `air1` candle test (tick 113) and the `air2` candle test (tick 116) of fixture D, the refused action cases (`jump` in the air, any action after `won` and `lost`, same hash), `actions` empty after the end, `decodeAction` returning null for other texts, and `status` with and without a reason.
  - Verify: `npm test -- step` passes for fixtures A to G.
  - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4. Reference check
  - Write the slow reference `step` inside `src/rules/reference.test.ts` and compare it with `step` on 200 random runs over fixtures A to G. The picks come from fast-check or from `randomInt` with a fixed seed, and some picks are `jump` in the air.
  - Verify: `npm test -- reference` passes.
  - _Requirements: 3.2, 3.4_

- [ ] 5. Observation
  - Write `src/rules/observe.test.ts` first: the three summary forms and the won and lost summaries, the examples of the design (fixture B at tick 0 and after `none*20`, fixture A at tick 0, fixture C after 5 ticks), `startsInTicks` equal to 110 at tick 0 of fixture B, every fact of requirement 5.2, the text map of fixture B at tick 0, a map near the end of a course padded with spaces, and a taken candle left out of the map. See it fail.
  - Implement `observe`.
  - Verify: `npm test -- observe` passes.
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Game definition and conformance
  - Create `src/def.ts` with `makeRunnerDef`, the default export, `kind` `tick`, `ticksPerSecond` 60 and a temporary scene of rectangles. Create `src/levels/courses.json` with one draft course: `r01`, the rows of fixture A. Task 10 replaces it. Add `resolveJsonModule` only if the root `tsconfig.json` does not have it, which it does today.
  - Write `src/def.test.ts`: `validateDef` reports no problem, the id is `runner`, `runConformance` passes for the default definition and for `makeRunnerDef` of fixtures A to G, and the extra properties of requirement 8.2 and the correctness properties 1 to 5, 7 and 8 of the design hold. Fix every failure.
  - Verify: `npm test -- def` passes. Record the Vitest duration in the log. Under 90 seconds is a target until it is recorded.
  - _Requirements: 3.3, 8.1, 8.2_

- [ ] 7. Proof checks
  - Write `src/proof.test.ts` first: the window of each of fixtures B, E, F and G equals the brute force count and the hand value (7, 21, 10, 5); a course with pumpkins in columns 10 and 13 fails `spacing_ok`; a course with a 2 column gap and a post right after it is `exhausted` and fails `finishable`; a course of the wrong length fails `length_ok`; and a split window gives the detail `window is split`. See it fail.
  - Implement `levelPlans`, `runChecks` and `levelChecks` in `src/proof.ts` with the checks from the design.
  - Verify: `npm test -- proof` passes.
  - _Requirements: 7.2, 7.4_

- [ ] 8. Scene
  - Write `src/view/scene.test.ts` first: `validateScene` reports no problem at 360 by 640, 1920 by 1080, 320 by 240 and 400 by 300, at tick 0 and after a jump; the numbers of the scene paragraph of the design at 360 by 640 (tile 24, player left 90, 10 whole tiles ahead); no `world` or `actors` item has a top above `safe.top + 56`; the only `hud` item is the score and it sits inside the bar; ids do not repeat. See it fail.
  - Implement `runnerLayout` and `view` in `src/view/scene.ts` and use them in `def.ts`.
  - Verify: `npm test -- scene` passes.
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 9. Build for the prover and the tool door
  - Write `apps/runner/build.mjs` on the pattern of `apps/garden/build.mjs`. It bundles `src/def.ts` to `dist/def.js` and `src/proof.ts` to `dist/proof.js`. Add the `build` script.
  - Change the root script `build:apps` to build both `@app/garden` and `@app/runner`.
  - Write `src/build.test.ts` first, like the one in `apps/garden`: it needs the build, and it fails first because `dist` is missing.
  - Verify: `npm run build:apps` builds both files of the runner, and `node -e "import('./apps/runner/dist/def.js').then(m => console.log(m.default.id))"` prints `runner`. `npm test -- build` passes.
  - _Requirements: 7.5_

- [ ] 10. Six courses
  - Write `src/levels/levels.test.ts` first: each course parses, the ids are `r01` to `r06`, the lengths and obstacle counts are the ones of `levelPlans` (60, 80, 100, 120, 140, 160 columns and 3, 5, 7, 9, 11, 13 obstacles), `r01` and `r02` hold gaps only, `r03` and `r04` hold no posts, and `runChecks` passes every check. See it fail on the draft file.
  - Write `r01` to `r06` in `src/levels/courses.json`. Place candles where a well timed jump takes them. Keep at least 4 plain columns between obstacles, and give each pumpkin and post a window that the test measures. Add the shipped courses to the reference check of task 4, and run the `def`, `scene` and `reference` tests again.
  - Write the smallest window of each course in the log.
  - Verify: `npm test -- levels def scene reference` passes.
  - _Requirements: 2.1, 7.1, 7.4_

- [ ] 11. Prove the courses
  - Add `apps/runner` to `kit.config.json`. Set the `runner` server in `.kiro/settings/mcp.json` to `"disabled": false`. A permission rule refused an edit of `.kiro/settings/` for the garden puzzle. If it refuses this one, write that in the log and leave the value for the owner. Task 13 needs it.
  - Run `npm run prove`. Every course must be solved and pass every check. Leave the files in `proofs/runner/` uncommitted for the owner. This task changes `proofs/` only through the command. Write that in the log row.
  - Verify: `npm run prove -- --check` exits 0.
  - _Requirements: 7.3_

- [ ] 12. Proof replay test
  - Write `src/proof-replays.test.ts`: each file `proofs/runner/<course>.json` holds a replay that `runReplay` accepts with final phase `won`, and `proofs/runner/index.json` lists `r01` to `r06`. The test reads the files and never writes them. It passes on its first run because the files already exist, so write that in the log. Add a negative case on a copy in a temporary folder, with one action removed, that fails `runReplay`.
  - Verify: `npm run verify` passes.
  - _Requirements: 7.3_

- [ ] 13. Kiro plays one course
  - Build the app. With the `playtester` agent, play `r01` to a won status through the `runner` tools, using `observe` and `none*n` to time each jump. Do not read the proof file first. If the `runner` tools do not load in the session, write in the log that this task did not run, and do not write a transcript.
  - Write the list of tool calls and the final score in the log. Compare the number of actions with `proofs/runner/index.json`.
  - If anything in play differs from this spec, save the replay, add it under `tests/replays/` with a test, and fix the rules or the spec.
  - Verify: `npm run verify` passes.
  - _Requirements: 3.1, 5.1, 5.3_
