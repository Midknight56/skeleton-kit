# Implementation Plan

Rule for every task: when the task is finished, add one row to `docs/kiro-log.md` on the same day and leave the Credits cell empty. The owner fills it. A task that adds a dependency writes its licence in that row. A task changes one folder from the kit-boundary table. Root files, `tools/`, `docs/` and `.kiro/` are outside the table. Do not commit unless the owner asks.

- [x] 1. Scaffold the app and write the failing fixture tests
  - Create `apps/garden` with `package.json` (name `@app/garden`, depends on `@kit/core`, `@kit/solver` and `@kit/conformance`), `tsconfig.json`, `game.config.ts` with the display title only, and the folders from the design. Do not import a theme. The theme belongs to the `shell-and-site` spec.
  - Create stub modules for `parseLevel`, `step`, `observe` and the other functions of the design. Each stub throws `not implemented`, so that the typecheck passes and the tests fail for the right reason.
  - Write `src/rules/fixtures.ts` with fixtures A, B, C and D and the two tie boards, and `src/rules/step.test.ts` with every expectation from the fixture table. Run it and see it fail.
  - Verify: `npm run typecheck` passes and `npm test -- apps/garden` fails only with `not implemented`.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

- [x] 2. Level parser
  - Write `src/rules/level.test.ts` first, with one test for each problem in requirement 1.3 (including a character that is not allowed and a `maxTurns` of 0 and of 100), a test that a good level gives no problem, and one for the moth numbering. See it fail.
  - Implement `parseLevel` and `initState`.
  - Verify: `npm test -- level` passes.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Actions, step and status
  - Add tests first, and see them fail: the action list in order for a level with three lanterns, no action in phase `won` and `lost`, the strict decode cases, the unlisted action cases (same hash), the turn limit case, the tie order cases, and the score.
  - Implement `actions`, `step`, `status`, `encodeAction` and `decodeAction` in `src/rules/step.ts`, following the step order in the design, including step 0.
  - Verify: `npm test -- step` passes for fixtures A, B, C and D.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

- [x] 4. Reference check
  - Write the slow reference `step` inside `src/rules/reference.test.ts` and compare it with `step` on 300 runs over fixtures A to D. The picks come from fast-check or from `randomInt` with a fixed seed. Task 11 adds the shipped levels.
  - Verify: `npm test -- reference` passes.
  - _Requirements: 3.1, 3.3_

- [x] 5. Observation
  - Write `src/rules/observe.test.ts` first: the two summary forms, the text map of fixture C after action 2 (`.m.F.f.1` becomes `.m.F.f.*` because lantern 1 is lit), the map of a caught moth and of a moth on a lantern post, the facts including `flowersFree`, and the legend. See it fail.
  - Implement `observe`.
  - Verify: `npm test -- observe` passes.
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. Game definition and conformance
  - Create `src/def.ts` with `makeGardenDef`, the default export and a temporary scene that draws one rectangle for each cell. Create `src/levels/levels.json` with one draft level: `g01`, the rows of fixture A, `maxTurns` 6. Task 11 replaces it.
  - Write `src/def.test.ts`: `validateDef` reports no problem, the id is `garden`, `runConformance` passes for the default definition and for `makeGardenDef` of fixtures A to D, and the extra properties from requirement 9.2 hold. Fix every failure.
  - Verify: `npm test -- def` passes. Record the Vitest duration in the log. Under 60 seconds is a target until it is recorded.
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 7. Proof checks
  - Write `src/proof.test.ts` first, with the proof tests from the design: fixture A passes `size_ok` and fails `needs_switch`, fixture B is not solved, and fixture D passes every check. See it fail.
  - Implement `turnOptions`, `levelPlans`, `runChecks` and `levelChecks` in `src/proof.ts` with the checks and the band table from the design.
  - Verify: `npm test -- proof` passes.
  - _Requirements: 8.2_

- [x] 8. Scene
  - Write `src/view/scene.test.ts` first: `validateScene` reports no problem for fixtures A to D and the draft level at 360 by 640, at 1920 by 1080, and on the two conformance viewports; item counts as in requirement 7.1; cells are at least 32 px at 360 by 640 on a 9 by 7 board with side safe areas of 36; no `world` or `actors` item starts above `safe.top + 56`; item ids stay equal across one turn. See it fail.
  - Implement `boardLayout` and `view` in `src/view/scene.ts` and use them in `def.ts`.
  - Verify: `npm test -- scene` passes.
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Build for the prover and the tool door
  - Write `apps/garden/build.mjs` on the pattern of `kit/mcp/build.mjs`. It bundles `src/def.ts` to `dist/def.js`, `src/proof.ts` to `dist/proof.js` and `tools/find-levels.ts` to `dist/find-levels.js` when that file exists. Add `esbuild` 0.28.2 as a dev dependency (MIT, already used by `kit/mcp` and `kit/solver`) and a `build` script.
  - Add a root script `build:apps` that runs the `build` script of `@app/garden`. Change the root `verify` script to run `build:apps` before `test`, and the root `prove` script to run it before the solver build, so that the prover never reads a stale `dist`.
  - Verify: `npm run build:apps` builds both files, and `node -e "import('./apps/garden/dist/def.js').then(m => console.log(m.default.id))"` prints `garden`.
  - _Requirements: 9.4_

- [x] 10. Level search helper
  - Implement `tools/find-levels.ts`: it builds random boards from a seed with `randomInt` from `kit/core` (never `Math.random`), runs `parseLevel`, then `solveTurn` with `turnOptions` and a `maxTurns` of 99, then `runChecks` with the plan of the requested level, and prints each board that passes, with its seed and its solution. The final `maxTurns` is the length plus 4.
  - Verify: `node apps/garden/dist/find-levels.js --level g01 --seeds 1-2000` prints at least one board. For each of `g02` to `g12`, run it with `--seeds 1-20000` and write the number of boards found in the log. If a level has none, write that level by hand in task 11 and solve it with the search.
  - _Requirements: 8.2_

- [x] 11. Twelve levels
  - Choose 12 boards with the helper, edit them by hand where a board reads better, and write them to `src/levels/levels.json` with ids `g01` to `g12` and short titles. Set each `maxTurns` to the shortest solution length plus 4.
  - Write `src/levels/levels.test.ts` first: every level parses, the ids are `g01` to `g12`, and `levelChecks` with `solveTurn` passes every check that applies. See it fail on the draft file. Add the shipped levels to the reference check of task 4, and run the `def`, `scene` and `reference` tests again.
  - Write the seed and the solution of each chosen board in the log.
  - Verify: `npm test -- levels def scene reference` passes.
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 12. Prove the levels
  - Add `apps/garden` to `kit.config.json` and set the `garden` server in `.kiro/settings/mcp.json` to `"disabled": false`.
  - Run `npm run build:apps` and `npm run prove`. Every level must be solved and pass every check. Never edit a file in `proofs/` by hand. Leave the files in `proofs/garden/` uncommitted for the owner.
  - This task changes `proofs/` only through the command. Write that in the log row.
  - Verify: `npm run prove -- --check` exits 0.
  - _Requirements: 8.3_

- [x] 13. Proof replay test
  - Write `src/proof-replays.test.ts`: each file `proofs/garden/<level>.json` holds a replay that `runReplay` accepts with final phase `won`, and `proofs/garden/index.json` lists `g01` to `g12`. The test reads the files and never writes them. It passes on its first run because the files already exist, so write that in the log. Add a negative case on a copy in a temporary folder, with one action removed, that fails `runReplay`.
  - Verify: `npm run verify` passes.
  - _Requirements: 8.3_

- [ ] 14. Kiro plays two levels
  - Build the app. With the `playtester` agent, play `g01` and `g07` to a won status through the `garden` tools. Do not read the proof files first. If the `garden` tools do not load in the session, write in the log that this task did not run, and do not write a transcript.
  - Compare the number of actions used with par from `proofs/garden/index.json` and write both in the log with the list of tool calls.
  - If anything in play differs from this spec, save the replay, add it under `tests/replays/` with a test, and fix the rules or the spec.
  - Verify: `npm run verify` passes.
  - _Requirements: 2.1, 5.2, 6.1, 6.2_
