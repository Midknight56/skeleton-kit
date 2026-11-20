# Requirements Document

## Introduction

Three pieces of work were merged and `npm test` shows 3 failures of 1323. This spec mends them, finishes task 2 of `garland-text`, and brings the README in line with the IDE session proof in `docs/acceptance/ide-session/`.

## Requirements

### Requirement 1: The contrast test reads CSS with comments
1. THE SYSTEM SHALL read the rules of `lookCss` and `themeCss` in `tests/a11y/contrast.test.ts` with CSS comments ignored.
2. THE SYSTEM SHALL hold a small test of that reader, seen failing before the fix.
3. THE SYSTEM SHALL have no comment line above the first `[data-garland]` rule of `kit/shell/src/look.ts`. The 12 px floor stays held by `describe('garland text')` in `kit/shell/src/look.test.ts`.

### Requirement 2: The README numbers are read from the files
1. THE SYSTEM SHALL give the counts of specs, tasks, log rows, unit tests, contrast pairs and end to end tests as the files give them on the day.
2. THE SYSTEM SHALL NOT weaken a test of `tests/docs/readme-claims.test.ts`.

### Requirement 3: `new:game` keeps passing
1. THE SYSTEM SHALL keep the case "makes a game with new:game that passes prove and then verify with no edit" passing, with no skip and no weaker check.

### Requirement 4: The garland task 2
1. THE SYSTEM SHALL run the build and four end to end files, one at a time and headless, and the contrast test, and show 12px in the two garland rows of `docs/acceptance/a11y/contrast.json`.

### Requirement 5: The README says what the IDE proof says
1. THE SYSTEM SHALL describe the IDE session, name `typecheck-on-save` as seen to fire with its proof file, and say that the garland text was raised to 12 px.
2. THE SYSTEM SHALL test that the README names `docs/acceptance/ide-session/` and has no sentence that says `typecheck-on-save` was not seen to fire.

### Requirement 6: Limits
1. THE SYSTEM SHALL NOT edit `proofs/` or any file in `docs/acceptance/` except `docs/acceptance/a11y/contrast.json`.
