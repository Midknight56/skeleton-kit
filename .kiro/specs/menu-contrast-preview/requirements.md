# Requirements Document

## Introduction

This spec adds one Kiro power, `power/menu-contrast-preview/`, in the Agent Plugins format. It gives a game maker one tool, `preview_menu_contrast`. The tool takes a proposed theme colour for the garden puzzle or the runner and says which menu labels, icons and borders would fall below their contrast limit. It changes no file. The folders `power/` and `tests/` are outside the kit boundary table.

This run does not cover the README text and the saved proof session. A later run does.

## Requirements

### Requirement 1: The package
**User Story:** As a game maker, I want to install one power, so that Kiro can answer a colour question before I edit a theme.

#### Acceptance Criteria
1. THE SYSTEM SHALL hold `power/menu-contrast-preview/plugin.json` with the same schema URL as `power/skeleton-kit/plugin.json`, the name `menu-contrast-preview`, version `0.1.0`, the author `Adrian Ferguson`, a description, four keywords, and the repository and licence of the existing power.
2. THE SYSTEM SHALL hold `power/menu-contrast-preview/mcp.json` with one stdio server named `contrast`, started with `node`, that runs `power/menu-contrast-preview/server.mjs` from the checkout named by `SKELETON_KIT_ROOT`.
3. WHEN `SKELETON_KIT_ROOT` is missing, THE launcher SHALL print a readable message on standard error and exit with code 1.
4. THE SYSTEM SHALL hold the skill `preview-menu-colour` with the description and the three steps of the design.
5. THE server SHALL offer exactly one tool, `preview_menu_contrast`.

### Requirement 2: The calculation
**User Story:** As a game maker, I want the preview to use the same colour check as the test, so that both give the same answer.

#### Acceptance Criteria
1. THE SYSTEM SHALL hold `pairsOf` and its helpers in `tests/a11y/contrast-pairs.ts`, used by `tests/a11y/contrast.test.ts` and by the power.
2. THE SYSTEM SHALL keep `docs/acceptance/a11y/contrast.json` byte for byte the same. Only the test writes it.
3. THE pass or fail result SHALL use the ratio at full precision. Only the shown ratio is cut to 2 decimals.
4. THE tool SHALL check 27 pairs for each game.
5. WHEN the garden `glow` is `#ff8a1f4d`, THE tool SHALL report exactly three new failures at 4.06 against 4.50: the storage notice, the result reason and the watch proof line, all on the sky.
6. WHEN the runner `palette.accent` is `#33285c`, THE tool SHALL report the filled level marker at 1.00 against 3.00.

### Requirement 3: Input and safety
**User Story:** As a game maker, I want a clear error and no changed file, so that I can trust the preview.

#### Acceptance Criteria
1. THE tool SHALL accept `game` `garden` or `runner`, `field` `glow` or a name in `Theme.palette`, and `colour` as `#RRGGBB`, or `#RRGGBBAA` for `glow` only.
2. WHEN `game`, `field` or `colour` is not valid, THE tool SHALL return an error that names that field.
3. WHEN the proposed colour equals the current one, THE tool SHALL report zero new failures.
4. THE tool SHALL write no file, and SHALL need no account, key, network or paid service.

### Requirement 4: The README and the proof
**User Story:** As a reader, I want the README to match the files, so that its counts are true.

#### Acceptance Criteria
1. THE tests SHALL require that `README.md` says two powers and names `power/skeleton-kit/` and `power/menu-contrast-preview/`.
2. THE tests SHALL require that `docs/acceptance/menu-contrast-preview/README.md` holds the tool call line, a later completed line and the three garden rows 4.51, 4.06 and 4.5.