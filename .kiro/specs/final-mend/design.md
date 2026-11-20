# Design Document

## Overview

- Comment reader. The rule reader of the contrast test moves to `tests/a11y/css-rules.ts` (`rulesOf`) and strips `/* ... */` before it splits the rules. `tests/a11y/css-rules.test.ts` holds the small test. The comment line in `kit/shell/src/look.ts` is removed as well, so both checks hold.
- README numbers. Each number is read again from `.kiro/specs/`, `docs/kiro-log.md`, a test run, `docs/acceptance/a11y/contrast.json` and `playwright test --list`. The README text is changed to match.
- `new:game`. The copy runs `npm run verify`. The cause is found from the copy's printed output after items 1 and 2 are mended.
- Garland task 2. As in `.kiro/specs/garland-text/design.md`.
- README IDE text. Short sentences from `docs/acceptance/ide-session/README.md`. `tests/docs/readme-claims.test.ts` gets the two new checks, and the two old cases that said typecheck-on-save has no proof file and that the IDE has one task are changed to match the new facts, with the old intent kept (the claim must have a proof file that exists).

## Limits

The task list crosses several folders on the owner's request. The final check is `npm run verify`, then `npm run e2e` once.
