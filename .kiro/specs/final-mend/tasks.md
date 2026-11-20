# Implementation Plan

Rule for every task: write the test first and see it fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty.

- [x] 1. The contrast reader ignores CSS comments
  - Move `rulesOf` to `tests/a11y/css-rules.ts` unchanged, write `tests/a11y/css-rules.test.ts`, see it fail on the comment, then strip comments in the reader. Remove the comment line above the first `[data-garland]` rule of `kit/shell/src/look.ts`.
  - Verify: `npm test -- css-rules contrast look` exits 0.
  - _Requirements: 1.1 to 1.3_

- [x] 2. The README numbers
  - Read the counts again and change `README.md` so the two failing cases of `tests/docs/readme-claims.test.ts` pass.
  - Verify: `npm test -- readme-claims`.
  - _Requirements: 2.1, 2.2_

- [x] 3. `new:game` copy verifies
  - Run `npm test -- new-game`. If it fails, find the cause from the copy's output.
  - _Requirements: 3.1_

- [x] 4. Task 2 of `garland-text`
  - Build, four end to end files one at a time, contrast test, check `contrast.json`, tick it there.
  - _Requirements: 4.1_

- [x] 5. The README says what the IDE proof says
  - Add the two checks to `tests/docs/readme-claims.test.ts`, see them fail, then change the README.
  - _Requirements: 5.1, 5.2_

- [x] 6. Final checks
  - `npm run verify` exits 0. Then `npm run e2e` once, headless.
  - _Requirements: 6.1_
