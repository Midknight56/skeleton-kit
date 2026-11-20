# Requirements Document

## Introduction

This spec adds an automated accessibility scan of every screen of the game shell, the fixes it asks for, and one recorded result. The tool is axe-core 4.11.3 through `@axe-core/playwright` 4.11.3. The scan is a test tool only. It does not replace a test with real people.

## Requirements

### Requirement 1: The tool and its licence
**User Story:** As the owner, I want the scan tool to be allowed by the dependency rule, so that the repository stays consistent.

#### Acceptance Criteria
1. THE SYSTEM SHALL say in `.kiro/steering/kit-boundary.md` that a dependency used only by tests, never shipped in a build and never linked into one, may also use MPL-2.0 when the log row names the package, the licence and says it is a test only tool.
2. THE SYSTEM SHALL list `@axe-core/playwright` as a devDependency with the exact version 4.11.3.
3. THE SYSTEM SHALL keep every file of the package out of `dist/` and out of the build tools.

### Requirement 2: The scan
**User Story:** As a judge, I want to see a recorded accessibility check, so that the claim has a source.

#### Acceptance Criteria
1. THE SYSTEM SHALL run axe with the tags `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` on title, level select, play, pause, results (won), settings, how to play, credits and the confirm box before a progress reset.
2. THE SYSTEM SHALL do this for the garden puzzle and the runner at 360x640, 768x1024 and 1920x1080.
3. THE SYSTEM SHALL fail the test on any violation with impact serious or critical, and print the rule id, the impact, the selector and the screen.
4. THE SYSTEM SHALL write `docs/acceptance/a11y/report.json` with screen, viewport, game, counts by impact, the rule ids of the violations and the rule ids that axe reports as incomplete.
5. THE SYSTEM SHALL list moderate and minor violations in the report without failing the test.
6. THE SYSTEM SHALL NOT hide an element from the scan or turn a rule off.

### Requirement 3: The fixes
**User Story:** As a player who uses a keyboard or a screen reader, I want every screen to pass the scan, so that I can play.

#### Acceptance Criteria
1. WHEN the scan on the unfixed shell finds a serious or critical violation, THE SYSTEM SHALL fix its cause in `kit/shell` or in the apps and keep the look of the paper puppets.
2. THE SYSTEM SHALL keep colour tokens in `kit/shell/src/tokens.ts` and the log SHALL name any token that changed, from what to what.
3. THE SYSTEM SHALL keep the first run saved as `docs/acceptance/a11y/report-before.json`.
4. THE SYSTEM SHALL keep the layout, shell, look, menu card, play layout and motion e2e files passing.

### Requirement 4: The write up
**User Story:** As a judge, I want the README to state what was checked and what was not.

#### Acceptance Criteria
1. THE SYSTEM SHALL add a short paragraph to the Design paragraph of the judging block in `README.md` and an Accessibility line under "How Kiro was used".
2. THE SYSTEM SHALL read the violation counts before and after from the two report files.
3. THE SYSTEM SHALL say that axe does not replace a test with real people and cannot read a canvas.
