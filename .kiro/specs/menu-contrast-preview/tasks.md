# Implementation Plan

Rule for every task: write the tests first and see them fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` on the same day.

- [x] 1. The shared calculation
  - Write a test that imports `pairsOf` from `tests/a11y/contrast-pairs.ts`. See it fail because the file does not exist.
  - Move `pairsOf` and its helpers out of `tests/a11y/contrast.test.ts`. Add `measuredPairsOf` with the full precision ratio.
  - Verify: `npm test -- tests/a11y` passes and `docs/acceptance/a11y/contrast.json` is unchanged.
  - _Requirements: 2.1 to 2.3_

- [x] 2. Package and launch
  - Write the package and launch tests. See them fail because the package is absent.
  - Write `plugin.json`, `mcp.json`, the skill and a `server.mjs` with the one tool.
  - Verify: the new tests pass.
  - _Requirements: 1.1 to 1.5_

- [x] 3. Real colour changes
  - Write the tests for the garden glow and the runner accent. See them fail because the tool does not calculate yet.
  - Build the calculation in `server.mjs`.
  - Verify: the new tests pass.
  - _Requirements: 2.4 to 2.6_

- [x] 4. Read only and invalid input
  - Write the tests for the current glow, a bad game, field and colour, and the unchanged files. See them fail.
  - Add the input checks to `server.mjs`.
  - Verify: the new tests pass, then `npm run verify` exits 0.
  - _Requirements: 3.1 to 3.4_

- [x] 5. Tests for the two power README
  - Change `tests/kiro/extensions.test.ts` and `tests/docs/readme-claims.test.ts` so they require "two powers", both power folders in `README.md`, and the saved proof in `docs/acceptance/menu-contrast-preview/README.md`. See them fail because `README.md` still says one power. The README text is written in a later run.
  - Verify: only these two test files run. The README asserts fail and the proof asserts pass.
  - _Requirements: 4.1 to 4.2_