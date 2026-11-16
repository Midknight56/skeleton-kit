# Implementation Plan

- [ ] 1. Scaffold the app and write the failing fixture tests
  - Create `apps/garden` with `package.json`, `tsconfig.json`, `game.config.ts` and the folders from the design.
  - Write `src/rules/fixtures.ts` with fixtures A, B and C, and `src/rules/step.test.ts` with every expectation from the fixture table. Run it and see it fail.
  - Verify: `npm run typecheck` passes and `npm test -- apps/garden` fails only because the rules do not exist yet.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

- [ ] 2. Level parser
  - Write `src/rules/level.test.ts` first, with one test for each problem in requirement 1.3 and one for the moth numbering. See it fail.
  - Implement `parseLevel` and `init`.
  - Verify: `npm test -- level` passes.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Actions, step and status
  - Implement `actions`, `step`, `status`, `encodeAction` and `decodeAction` in `src/rules/step.ts`, following the step order in the design.
  - Add the tie order test and the turn limit test from the design.
  - Verify: `npm test -- step` passes for fixtures A, B and C.
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

- [ ] 4. Reference check
  - Write the slow reference `step` inside `src/rules/reference.test.ts` and compare it with `step` on 300 random runs over the fixtures.
  - Verify: `npm test -- reference` passes.
  - _Requirements: 3.1, 3.3_

- [ ] 5. Observation
  - Write `src/rules/observe.test.ts` first: the two summary forms, the text map of fixture C after action 2 (`.m.F.f.1` becomes `.m.F.f.*` because lantern 1 is lit), and the facts. See it fail.
  - Implement `observe`.
  - Verify: `npm test -- observe` passes.
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. Game definition and conformance
  - Create `src/def.ts` with a temporary scene that draws one rectangle for each cell.
  - Write `src/def.test.ts` that runs `runConformance` and the extra properties from the design. Fix every failure.
  - Verify: `npm test -- def` passes in under 60 seconds.
  - _Requirements: 9.1, 9.2_

- [ ] 7. Proof checks
  - Write `src/proof.test.ts` first: fixture A passes `size_ok` and fails `needs_switch`, fixture B is unsolved, and a hand made two lantern level passes `needs_switch`. See it fail.
  - Implement `turnOptions` and `levelChecks` in `src/proof.ts` with the checks and the band table from the design.
  - Add `apps/garden` to `kit.config.json` and set the `garden` server in `.kiro/settings/mcp.json` to `"disabled": false`.
  - Verify: `npm test -- proof` passes.
  - _Requirements: 8.2_

- [ ] 8. Level search helper
  - Implement `tools/find-levels.ts`: it builds random boards from a seed, runs `parseLevel`, `solveTurn` and `levelChecks`, and prints each board that passes for a given level id, with its seed.
  - Verify: `npx tsx apps/garden/tools/find-levels.ts --level g05 --seeds 1-2000` prints at least one board.
  - _Requirements: 8.2_

- [ ] 9. Twelve levels
  - Choose 12 boards with the helper, edit them by hand where a board reads better, and write them to `src/levels/levels.json` with ids `g01` to `g12` and short titles.
  - Set each `maxTurns` to the shortest solution length plus 4.
  - Run `npm run prove`. Every level must be solved and pass every check. Commit the files in `proofs/garden/`.
  - Write the seed of each chosen board in the log.
  - Verify: `npm run prove -- --check` exits 0.
  - _Requirements: 8.1, 8.3, 8.4_

- [ ] 10. Scene
  - Write `src/view/scene.test.ts` first: `validateScene` reports no problem for every shipped level at 360 by 640 and at 1920 by 1080, cells are at least 32 px at 360 by 640, no `world` or `actors` item overlaps the 56 px top bar, and item ids stay equal across one turn. See it fail.
  - Implement `view` in `src/view/scene.ts` and use it in `def.ts`.
  - Verify: `npm test -- scene` passes.
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 11. Kiro plays two levels
  - Build the app. With the `playtester` agent, play `g01` and `g07` to a won status through the `garden` tools. Do not read the proof files first.
  - Compare the number of actions used with par from `proofs/garden/index.json` and write both in the log with the list of tool calls.
  - If anything in play differs from this spec, save the replay, add it under `tests/replays/` with a test, and fix the rules or the spec.
  - Verify: `npm run verify` passes.
  - _Requirements: 2.1, 5.2, 6.1, 6.2_

- [ ] 12. Log
  - Add the log rows for this spec with the credits used.
  - Verify: `npm run verify` passes.
  - _Requirements: 8.3_
