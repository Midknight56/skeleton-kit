# Implementation Plan

Rule: write the test first and see it fail because the text is absent. Tick the task and add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. No package is added. No file in `proofs/` is edited.

- [x] 1. Show the tightest jump on each open runner course card (folder: `kit/shell`, with the build in `tools/` and the browser test in `e2e/`)
  - Write the failing tests: the card text unit test, the build test for six proofs and for a wrong or missing `window_ok`, and the browser test for the card of r01.
  - Write the build reader, the pure text, the page reader, the card and its style.
  - Verify: `npm run verify` and `npm run e2e`.
  - _Requirements: 1.1 to 1.4, 2.1 to 2.3_
