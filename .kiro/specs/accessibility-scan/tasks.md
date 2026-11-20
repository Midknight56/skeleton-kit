# Implementation Plan

Rule for every task: write the tests first and see them fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty.

- [x] 1. The tool and its licence rule
  - Change the one dependency line of `.kiro/steering/kit-boundary.md`. Check `npm view` first.
  - Install `@axe-core/playwright@4.11.3` as an exact devDependency. Check that no build file imports it.
  - _Requirements: 1.1 to 1.3_

- [x] 2. The scan test and the first run
  - Write `e2e/a11y.e2e.ts`. Run it on the unfixed shell. Save the first report as `docs/acceptance/a11y/report-before.json`.
  - _Requirements: 2.1 to 2.6_

- [x] 3. The fixes
  - Fix every serious and critical violation. Run the scan until it passes. Run the six other e2e files alone.
  - _Requirements: 3.1 to 3.4_

- [x] 4. The README
  - Add the paragraphs with the counts from the two reports.
  - Verify: `npm run verify` exits 0.
  - _Requirements: 4.1 to 4.3_
