# Requirements Document

## Introduction

The contrast test (`tests/a11y/contrast.test.ts`, result in `docs/acceptance/a11y/contrast.json`) reads the garland text at 10 px (the level numbers) and 11 px (the note line) at the smallest size. The garland is the strip of lantern pictures at the bottom of the title screen. It shows only when the window is at least 700 px wide and 640 px high. This spec raises both sizes to 12 px or more and adds a test that keeps them there.

Every text a player sees is to be at least 12 px. The steering files in `.kiro/steering/` state 12 px only for the gap between controls, so this spec states the text rule itself. Adding one line for it to `game-standards.md` is a separate task.

## Requirements

### Requirement 1: The text size
**User Story:** As a player with low vision, I want the garland text to be readable on a small screen, so that I can see which level comes next.

#### Acceptance Criteria
1. THE SYSTEM SHALL draw the level numbers (`[data-garland] .number`) at 12 px or more at every size of the look.
2. THE SYSTEM SHALL draw the note line (`[data-garland] .note`) at 12 px or more at every size of the look.
3. THE SYSTEM SHALL keep the size at the large end of the look (`--u` of 2px) no smaller than it is now.

### Requirement 2: The test
**User Story:** As the owner, I want a test that fails when garland text goes under 12 px, so that the size cannot slip back.

#### Acceptance Criteria
1. THE SYSTEM SHALL read the CSS text that `lookCss` builds and check every `font-size` in a rule whose selector starts with `[data-garland]`.
2. THE SYSTEM SHALL check each size at `--u` of 1px and at `--u` of 2px, and fail with the selector and the size in px for any value under 12.
3. THE SYSTEM SHALL fail when it finds no `font-size` in the garland rules, or a value it cannot read.
4. THE SYSTEM SHALL be written first and be seen to fail for the sizes 10 and 11 before the sizes change.
5. THE SYSTEM SHALL NOT weaken or skip the test to make it pass.

### Requirement 3: The layout still holds
**User Story:** As a player, I want the larger text to fit, so that the garland does not cover the play area or a control.

#### Acceptance Criteria
1. THE SYSTEM SHALL keep `e2e/layout.e2e.ts`, `e2e/play-layout.e2e.ts`, `e2e/look.e2e.ts` and `e2e/a11y.e2e.ts` passing, run headless and one file at a time.
2. THE SYSTEM SHALL keep every control above the top edge of the garland and the garland inside the page.
3. THE SYSTEM SHALL keep `tests/a11y/contrast.test.ts` passing and rewrite `docs/acceptance/a11y/contrast.json` by running it.
4. IF a layout test fails because the text no longer fits, THEN THE SYSTEM SHALL change only the garland geometry in `kit/shell/src/look.ts`, by the smallest step.

### Requirement 4: Scope
**User Story:** As the owner, I want a small change, so that it is easy to review.

#### Acceptance Criteria
1. THE SYSTEM SHALL change only `kit/shell`, in `look.ts` and in the look test file.
2. THE SYSTEM SHALL NOT change a colour, a token, a game or a file in `proofs/`.
3. THE SYSTEM SHALL add one row to `docs/kiro-log.md` for each finished task, with the Credits cell empty.
