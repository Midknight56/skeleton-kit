# Implementation Plan

- [ ] 1. Scaffold the workspace
  - Create the root `package.json` with npm workspaces for `kit/*` and `apps/*`, a base `tsconfig.json` with `strict` on, Vitest, fast-check and ESLint. Pin each version and write each licence in the log row.
  - Add the root scripts `typecheck`, `lint`, `test`, `prove`, `verify`, `build`, `e2e` and `new:game`. `prove`, `e2e`, `build` and `new:game` print `not built yet` and exit 0 until their specs replace them.
  - Add `LICENSE` (MIT), `README.md` with three lines, `.gitignore` for `node_modules` and `dist`, and `docs/kiro-log.md` from the log template. Do not ignore `.kiro`.
  - Add `tools/hooks/protect-proofs.mjs` that reads all of STDIN, and exits 2 with a one line message on STDERR when the text holds a path that starts with `proofs/` or contains `/proofs/`. Otherwise it exits 0.
  - Verify: `npm run verify` exits 0. Save one TypeScript file and end one turn, and write in the log whether `typecheck-on-save` and `verify-on-stop` fired.
  - _Requirements: 1.4, 9.1_

- [ ] 2. Write the contract types
  - Create `kit/core/src/types.ts` and `kit/core/src/errors.ts` exactly as in the design.
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
  - Create `kit/conformance/sample-lights/` and `kit/conformance/sample-hop/` as in requirement 8, each with `def.ts` and `def.test.ts`.
  - Tests first: `press:1,1` wins level `l1` of `sample-lights`. A `sample-hop` run with no hop is lost at the first blocked cell.
  - Verify: `npm test -- sample` passes.
  - _Requirements: 8.1, 8.2_

- [ ] 7. Definition check
  - Write `validate.test.ts` first for each problem in requirement 1.3 and for `ticksPerSecond`. See it fail.
  - Implement `validate.ts`.
  - Verify: `npm test -- validate` passes.
  - _Requirements: 1.2, 1.3_

- [ ] 8. Session
  - Write `session.test.ts` first with `sample-lights` and `sample-hop`: creation, each refused case with the hash unchanged, `legal()` order, `undo` on both kinds, and the 500 entry cap. See it fail.
  - Implement `session.ts`.
  - Verify: `npm test -- session` passes.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 9. Replay
  - Write `replay.test.ts` first: a good replay, a changed action, a changed hash, a changed phase, a wrong game id and a changed rules version. See it fail.
  - Implement `toReplay` in the session and `replay.ts`.
  - Verify: `npm test -- replay` passes.
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6_

- [ ] 10. Scene check and SVG painter
  - Write `scene.test.ts` first: layer order, the placeholder for a sprite with no map entry, escaping, and each problem from `validateScene`. See it fail.
  - Implement `scene.ts`.
  - Verify: `npm test -- scene` passes.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 11. Conformance suite
  - Create the three broken samples in `kit/conformance/broken/`.
  - Write `conformance.test.ts` first: both samples pass all nine properties, and each broken sample fails the property named in the design. See it fail.
  - Implement `runConformance` with the nine properties from the design.
  - Verify: `npm test -- conformance` passes in under 60 seconds.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.3_

- [ ] 12. Property tests from the spec
  - In the Kiro IDE, open this spec and use the spec correctness feature to generate property tests from the acceptance criteria.
  - Compare the generated properties with the nine in `kit/conformance`. Keep each generated property that checks something new in `kit/core/src/spec-properties.test.ts`. Remove none of the nine.
  - Write in the log which properties were added and any failure they found.
  - Verify: `npm test` passes.
  - _Requirements: 2.3, 3.2, 4.3, 5.3_

- [ ] 13. Lint rules for rule code
  - Add the ESLint rule block for the folders in requirement 9.1 and the fixture `tools/lint-fixtures/bad-rule.ts`.
  - Add `tools/lint-fixtures/lint.test.ts` that runs ESLint on the fixture and expects a failure that names `Math.random`.
  - Verify: `npm run lint` passes on the workspace and the fixture test passes.
  - _Requirements: 9.1, 9.2_

- [ ] 14. Export file and contract page
  - Create `kit/core/src/index.ts` and `kit/conformance/src/index.ts` as the only export files.
  - Write `docs/kit-contract.md`: how to write a game in one page, with `sample-lights` as the example.
  - Add the log rows for this spec with the credits used.
  - Verify: `npm run verify` passes.
  - _Requirements: 1.1, 7.1_
