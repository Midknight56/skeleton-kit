# Implementation Plan

Rule for every task: write the tests first and see them fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty.

- [x] 1. The test and the two sizes (`kit/shell`)
  - Write the `garland text` test in `kit/shell/src/look.test.ts`, as the design says. It reads the CSS of `lookCss` and checks each garland `font-size` at `--u` of 1px and of 2px.
  - Run `npm test -- look`. See it fail for the sizes 10 and 11, naming `.number` and `.note` at the small end.
  - Change `L(10, 13)` to `L(12, 13)` and `L(11, 14)` to `L(12, 14)` in `kit/shell/src/look.ts`. Change nothing else.
  - Run `npm test -- look` and `npm run typecheck`.
  - Verify: `npm test -- look` and `npm run typecheck` both exit 0.
  - _Requirements: 1.1 to 1.3, 2.1 to 2.5, 4.1 to 4.3_

- [ ] 2. The end to end files and the contrast test
  - Run `npm run build`. Then run `npx playwright test e2e/layout.e2e.ts`, `e2e/play-layout.e2e.ts`, `e2e/look.e2e.ts` and `e2e/a11y.e2e.ts`, one command for each file, headless.
  - Run `npm test -- contrast`. It rewrites `docs/acceptance/a11y/contrast.json`. Check that the two garland rows now say 12px.
  - If a layout test fails because the larger text no longer fits, change only the garland geometry in `kit/shell/src/look.ts`, as the design says. Keep the failing case, change the geometry, and run the file again. Then run the other three files again.
  - Verify: the four end to end files and the contrast test each exit 0, and `look.e2e.ts` still shows every control above the garland.
  - _Requirements: 3.1 to 3.4, 4.1 to 4.3_
