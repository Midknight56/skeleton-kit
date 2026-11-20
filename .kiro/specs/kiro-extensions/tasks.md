# Implementation Plan

Rule for every task: write the tests first and see them fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty.

- [x] 1. The power and its tests
  - Write `tests/kiro/extensions.test.ts` for requirements 1 to 4. See it fail because `power/skeleton-kit/` does not exist.
  - Write `plugin.json`, `mcp.json`, `skills/play-and-prove/SKILL.md` and `README.md`.
  - Verify: `npm test -- tests/kiro` passes.
  - _Requirements: 1.1 to 1.5, 2.1 to 2.3, 3.1, 3.2, 4.1_

- [x] 2. Proof that the power ran
  - Add the proof tests (requirement 5) to the test file. See them fail because the folder does not exist.
  - Build with `npm run build:kit` and `npm run build:apps`. Install the power with both variables set. Run one headless session from `D:/Projects/kiroween/skeleton-kit-logs/power-run/`. Save the output. Check the answer against the game. Uninstall `skeleton-kit` only and read `installed.json`.
  - Write `docs/acceptance/power-session/README.md`.
  - Verify: `npm test -- tests/kiro` passes.
  - _Requirements: 5.1 to 5.3_

- [x] 3. README claims
  - Add the README tests (requirement 6) to the test file. See them fail while the section says "Not used in this build."
  - Update the section "Kiro powers" and the first paragraph of `README.md`.
  - Verify: `npm test -- tests/kiro` passes, then `npm run verify` exits 0.
  - _Requirements: 6.1 to 6.3_
