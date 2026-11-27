# Implementation Plan

Rule for every task: write the tests first and see them fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` on the same day.

- [x] 1. Spell the product name Skeleton Kit
  - Write `tests/docs/product-name.test.ts`. See it fail because "Skeleton kit" is in the six places.
  - Change the six places. Search the rest of `site/`, `power/`, `apps/`, `kit/` and `tools/` and fix any other hit.
  - Verify: the new test passes, then `npm run verify`, `npm run build` and `npm run e2e`.
  - _Requirements: 1.1 to 1.5_
