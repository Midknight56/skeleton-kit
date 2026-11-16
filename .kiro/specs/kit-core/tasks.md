# Implementation Plan

Rule for every task: when the task is finished, add one row to `docs/kiro-log.md` on the same day and leave the Credits cell empty. The owner fills it. A task that adds a dependency writes its licence in that row. A task changes one folder from the kit-boundary table. Files outside the table (root files, `tools/`, `docs/`) go in the scaffold, lint and contract tasks only.

- [ ] 1. Scaffold the workspace
  - Create the root `package.json` with version `0.1.0` and npm workspaces for `kit/*` and `apps/*`, a base `tsconfig.json` with `strict` on, TypeScript, typescript-eslint, ESLint, Vitest and fast-check. Pin each version and write each licence in the log row. Run Vitest with `--passWithNoTests` until tests exist.
  - Add the root scripts `typecheck`, `lint`, `test`, `prove`, `verify`, `build`, `e2e` and `new:game`. `verify` runs `typecheck`, `lint` and `test`. `prove`, `e2e`, `build` and `new:game` print `not built yet` and exit 0 until their specs replace them. That output is not a pass of any proof or end to end check.
  - Add `LICENSE` (MIT), `README.md` with three lines, `.gitignore` for `node_modules` and `dist`, and `docs/kiro-log.md` from the log template. Do not ignore `.kiro`.
  - Add `tools/hooks/protect-proofs.mjs` that reads all of STDIN, and exits 2 with a one line message on STDERR when the text holds a path that starts with `proofs/` or `proofs\`, or contains `/proofs/` or `\proofs\`. Otherwise it exits 0. Add a test with one path in each of the four forms and one path that is allowed.
  - Verify: `npm run verify` exits 0. If the hooks `typecheck-on-save` and `verify-on-stop` exist in `.kiro/hooks`, save one TypeScript file and end one turn, and write in the log whether each fired. If they do not exist, write that.
  - _Requirements: none (setup for 9.1)_

- [ ] 2. Write the contract types
  - Create `kit/core/package.json` (no runtime dependencies), `kit/core/tsconfig.json`, `kit/core/src/types.ts` and `kit/core/src/errors.ts` exactly as in the design. Create `kit/core/src/index.ts` that exports them. Every later task in this spec that adds an export adds it to this file, so other packages can import from it from task 6 on.
  - Add `kit/core/src/types.test.ts` with one tiny game definition that must type check, and one `// @ts-expect-error` line for a definition with a missing member.
  - Verify: `npm run typecheck` passes.
  - _Requirements: 1.1, 1.2_

- [ ] 3. Canonical JSON and hash
  - Write `canonical.test.ts` and `hash.test.ts` first: key order, 16 hex characters, the slow reference hash on 200 random values, and one test for each bad value in requirement 3.3. Run them and see them fail.
  - Implement `canonical.ts` and `hash.ts`.
  - Verify: `npm test -- hash canonical` passes.
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Random numbers
  - Write `random.test.ts` first: the reference loop, the value ranges, and equal sequences for equal states. See it fail.
  - Implement `random.ts`.
  - Verify: `npm test -- random` passes.
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 5. Run length coding for actions
  - Write `rle.test.ts` first: round trip on 100 random lists, the limits 2 and 3600, and the refused forms. See it fail.
  - Implement `rle.ts`.
  - Verify: `npm test -- rle` passes.
  - _Requirements: 4.2_

- [ ] 6. The two sample games
  - Create `kit/conformance/package.json` (depends on `kit/core` and fast-check; licence MIT in the log row), `kit/conformance/sample-lights/` and `kit/conformance/sample-hop/` as in requirement 8 and the design fixture, each with `def.ts` and `def.test.ts`. Import `kit/core` only through its `index.ts`.
  - Tests first: `sample-lights` has levels `l1`, `l2`, `l3` and `press:1,1` wins `l1`. `sample-hop` has levels `h1`, `h2` and the design replay `['none*6','hop','none*32']` wins `h1` in 39 ticks. A run with no hop is lost on cell 10 at tick 10.
  - Verify: `npm test -- sample` passes.
  - _Requirements: 8.1, 8.2_

- [ ] 7. Definition check
  - Write `validate.test.ts` first for each problem in requirement 1.3 and for `ticksPerSecond`. See it fail.
  - Implement `validate.ts`.
  - Verify: `npm test -- validate` passes.
  - _Requirements: 1.2, 1.3_

- [ ] 8. Session
  - Write `session.test.ts` first with `sample-lights` and `sample-hop`: creation, each refused case with the hash and the tick unchanged, `game_over` for an undecodable text, `legal()` empty after the game ends, `legal()` order, `undo` on both kinds, and the 500 entry cap (after 501 applies on a turn game, 500 undos return `true` and the next returns `false`). See it fail.
  - Implement `session.ts`.
  - Verify: `npm test -- session` passes.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 9. Replay
  - Write `replay.test.ts` first: a good replay, a changed action, a changed hash, a changed phase, a wrong game id, a changed rules version, an unknown level, a bad seed, an undecodable text, a malformed `*` item, an action after the game ended, and a run of 3601 equal actions that compresses to two items. Check that none of these throws. See it fail.
  - Implement `toReplay` in the session and `replay.ts`.
  - Verify: `npm test -- replay` passes.
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 10. Scene check and SVG painter
  - Write `scene.test.ts` first: layer order, the placeholder for a sprite with no map entry, escaping, and each problem from `validateScene`. See it fail.
  - Implement `scene.ts`.
  - Verify: `npm test -- scene` passes.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 11. Conformance suite
  - Create the three broken samples in `kit/conformance/broken/`.
  - Write `conformance.test.ts` first: both samples pass all nine properties, each broken sample fails the property named in the design (hidden counter: 1, changed input: 5, unlisted action: 3), and a failing result holds the property name, the level id, the seed and a shrunk action list in replay form. See it fail.
  - Implement `runConformance` with the nine properties from the design. Export it and the two samples from `kit/conformance/src/index.ts`, the only export file.
  - Verify: `npm test -- conformance` passes. Record the duration that Vitest prints. The 60 second limit is a target, and the log row states the printed duration or says it was not measured.
  - _Requirements: 1.5, 7.1, 7.2, 7.3, 7.4, 8.3_

- [ ] 12. Property tests from the spec
  - In the Kiro IDE, open this spec and use the spec correctness feature to generate property tests from the acceptance criteria.
  - Compare the generated properties with the nine in `kit/conformance`. Keep each generated property that checks something new in `kit/core/src/spec-properties.test.ts`. Remove none of the nine.
  - Write in the log which properties were added and any failure they found.
  - Verify: `npm test` passes.
  - _Requirements: 2.3, 3.2, 4.3, 5.3_

- [ ] 13. Lint rules for rule code
  - Add the ESLint rule block for the folders in requirement 9.1, excluding `*.test.ts`, and the fixture `tools/lint-fixtures/bad-rule.ts`. Exclude `tools/lint-fixtures/` from the normal `npm run lint` run, or the workspace lint can never pass.
  - Add `tools/lint-fixtures/lint.test.ts` that runs ESLint on the fixture with the rule block applied by an explicit override, because the fixture is outside the folders in 9.1, and expects a failure that names `Math.random` and a line. Make sure Vitest includes `tools/**`.
  - Verify: `npm run lint` passes on the workspace and the fixture test passes.
  - _Requirements: 9.1, 9.2_

- [ ] 14. Boundary test and contract page
  - Add `kit/core/src/boundary.test.ts`: `kit/core/package.json` lists no runtime dependency, and every import in `kit/core/src` is a relative path or a Node-free standard module. Check that `index.ts` is the only file `kit/conformance` imports from `kit/core`.
  - Add `kit/core/src/game-words.test.ts`: no file under `kit/` contains a word from the game list in `kit-boundary` as a whole word, in any letter case. `navigate` must not count as `gate`. Add one test case that shows a planted whole word is found.
  - Write `docs/kit-contract.md`: how to write a game in one page, with `sample-lights` as the example. Use no word from the game list in `kit-boundary`.
  - Verify: `npm run verify` passes.
  - _Requirements: 1.1, 1.4, 7.1_
