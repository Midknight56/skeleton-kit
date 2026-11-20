# Implementation Plan

Rule for every task: write the test first and see it fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` on the same day. Leave the Credits cell empty. Name no hook unless it was seen to fire. No task adds a package. Never edit a file in `proofs/` or `docs/acceptance/` by hand.

- [x] 1. The capture tool and the image (outside the table: `tools/`, `tests/docs/`, `docs/img/`)
  - Reason: a tool that writes an image has no folder in the table.
  - Write `tests/docs/hero.test.ts` first: `docs/img/hero.png` exists, has the PNG signature, is at least 1600 wide and 900 high, and the source of `tools/capture-hero.mjs` shows headless, `--mute-audio`, a free memory read, `serve-dist.mjs`, no use of 4173 or 4177 as the port, and no build command. See it fail because the file and the tool do not exist.
  - Write `tools/capture-hero.mjs`. Run `npm run build`, then the tool. Check the picture by looking at it.
  - Verify: `npm test -- tests/docs/hero` passes for the PNG and tool cases.
  - _Requirements: 1.1 to 1.3_

- [x] 2. The picture in the README (outside the table: `README.md`, `tests/docs/`)
  - Add to `tests/docs/hero.test.ts` first: the first 25 lines of `README.md` hold the image link to `docs/img/hero.png` with alt text that names the landing page, a level in play and the level select, the play link and the video link. See it fail.
  - Put the image under the title and keep the links in the first lines.
  - Verify: `npm test -- tests/docs/hero` passes.
  - _Requirements: 1.4_

- [x] 3. The write up (outside the table: `README.md`, `tests/docs/`)
  - Write `tests/docs/readme-claims.test.ts` first: every backticked `docs/acceptance/` path exists; no "not used" in any case; no dash between words; no fake or sandbox word; no claim of a user test; the five criteria in the contest's order and first after the picture and links; the sections of the Kiro write up in the order of the questions; the spec and task counts, the log row counts and the level counts equal what the files say; the public number and its source are written. See the failing cases.
  - Rewrite the Kiro write up and the judging block from the files. Merge the accessibility text into one section. Read the numbers again and fix the wrong ones.
  - Verify: `npm test -- tests/docs tests/kiro`, then `npm run verify` exits 0. `e2e/site.e2e.ts` runs only if `site/` changed.
  - _Requirements: 2.1 to 2.5_
