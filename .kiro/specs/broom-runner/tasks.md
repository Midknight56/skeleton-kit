# Implementation Plan

- [ ] 1. Scaffold the app and write the failing fixture tests
  - Create `apps/runner` with `package.json`, `tsconfig.json`, `game.config.ts`, `src/rules/constants.ts` and the folders from the design.
  - Write `src/rules/fixtures.ts` with fixtures A, B and C, and `src/rules/step.test.ts` with every expectation from the fixture table and its note. Run it and see it fail.
  - Verify: `npm run typecheck` passes and `npm test -- apps/runner` fails only because the rules do not exist yet.
  - _Requirements: 1.1, 3.2, 3.3, 4.1, 4.3_

- [ ] 2. Course parser
  - Write `src/rules/course.test.ts` first, with one test for each problem in requirement 2.3. See it fail.
  - Implement `parseCourse` and `init`.
  - Verify: `npm test -- course` passes.
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. One tick
  - Implement `actions`, `step`, `status`, `encodeAction` and `decodeAction` in `src/rules/step.ts`, with the seven steps of the design in order and the box table as plain functions.
  - Add the gap test and the candle test from the design.
  - Verify: `npm test -- step` passes for fixtures A, B and C.
  - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4. Reference check
  - Write the slow reference `step` inside `src/rules/reference.test.ts` and compare it with `step` on 200 random runs over the fixtures.
  - Verify: `npm test -- reference` passes.
  - _Requirements: 3.2_

- [ ] 5. Observation
  - Write `src/rules/observe.test.ts` first: the three summary forms, `startsInTicks` equal to 110 at tick 0 of fixture B, and a text map of 3 rows by 24 columns. See it fail.
  - Implement `observe`.
  - Verify: `npm test -- observe` passes.
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Game definition and conformance
  - Create `src/def.ts` with `kind` `tick`, `ticksPerSecond` 60 and a temporary scene of rectangles.
  - Write `src/def.test.ts` that runs `runConformance` and the extra properties from the design. Fix every failure.
  - Verify: `npm test -- def` passes in under 90 seconds.
  - _Requirements: 8.1, 8.2_

- [ ] 7. Proof checks
  - Write `src/proof.test.ts` first: the window of a lone pumpkin equals the brute force count, a course with two obstacles 2 columns apart fails `spacing_ok`, and a course with a post right after a 2 column gap fails `finishable` or `window_ok`. See it fail.
  - Implement `levelChecks` in `src/proof.ts` with the checks from the design.
  - Add `apps/runner` to `kit.config.json` and set the `runner` server in `.kiro/settings/mcp.json` to `"disabled": false`.
  - Verify: `npm test -- proof` passes.
  - _Requirements: 7.2, 7.4_

- [ ] 8. Six courses
  - Write `r01` to `r06` in `src/levels/courses.json` with the lengths from requirement 7.1. Use 3, 5, 7, 9, 11 and 13 obstacles. Place candles where a well timed jump takes them.
  - Run `npm run prove`. Every course must be solved and pass every check. Commit the files in `proofs/runner/`.
  - Write the smallest window of each course in the log.
  - Verify: `npm run prove -- --check` exits 0.
  - _Requirements: 7.1, 7.3, 7.4_

- [ ] 9. Scene
  - Write `src/view/scene.test.ts` first: `validateScene` reports no problem at 360 by 640 and 1920 by 1080, the player item sits at one quarter of the play width, at least 10 tiles ahead are inside the scene at 360 by 640, and no `world` or `actors` item overlaps the 56 px top bar. See it fail.
  - Implement `view` in `src/view/scene.ts` and use it in `def.ts`.
  - Verify: `npm test -- scene` passes.
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 10. Kiro plays one course
  - Build the app. With the `playtester` agent, play `r01` to a won status through the `runner` tools, using `observe` and `none*n` to time each jump. Do not read the proof file first.
  - Write the list of tool calls and the final score in the log.
  - If anything in play differs from this spec, save the replay, add it under `tests/replays/` with a test, and fix the rules or the spec.
  - Verify: `npm run verify` passes.
  - _Requirements: 3.1, 5.1, 5.3_

- [ ] 11. Log
  - Add the log rows for this spec with the credits used.
  - Verify: `npm run verify` passes.
  - _Requirements: 7.3_
