# Implementation Plan

Rule for every task: write the test first and see it fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` dated 2026-11-24. Leave the Credits cell empty.

- [x] 1. Try a turn limit on garden level g03 on the landing page
  - Unit test of the search wrapper at limits 8, 3, 4 and Restore. Headless e2e test with the network blocked after load.
  - _Requirements: 1.1 to 1.7_

- [x] 2. Both games on the first phone screen and in the README image
  - e2e test of the two links at 360x640 and 1280x800. Test of the capture plan. Run the capture, headless and muted.
  - _Requirements: 2.1 to 2.3_

- [x] 3. The README image alt text test names the true panels
  - Change the alt text asserts in `tests/docs/hero.test.ts`: it must match landing page, in play, runner, jump and lantern, and must not match level select or pips. Run only that file and see it fail on the old README text. The README text is written after this task.
  - _Requirements: 2.4_
