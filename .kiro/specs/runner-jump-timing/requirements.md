# Requirements Document

## Introduction

An open course card of the runner says how many ticks the proof needs to win. A player cares more about the tightest jump. Each runner proof already holds it in the check `window_ok`, for example "smallest window 10 ticks, the plan needs 9" in `proofs/runner/r02.json`. This spec shows that measured window on each open runner course card. The garden cards, the game rules, the level files and the proofs do not change.

## Requirements

### Requirement 1: The window on the card
**User Story:** As a player, I want to see the tightest jump of a course before I pick it, so that I know how exact my taps must be.

#### Acceptance Criteria
1. WHEN an open runner course card has a proven window THEN THE SYSTEM SHALL show it as plain words: the number of steps and the time in milliseconds at 60 ticks a second, rounded to the nearest millisecond. 10 steps is 167 ms. 9 steps is 150 ms.
2. THE SYSTEM SHALL write the same numbers in the accessible name of the card.
3. THE SYSTEM SHALL show nothing new on a locked card or on a garden card.
4. THE SYSTEM SHALL keep text at 12 px or more, keep every card 12 px from the next, and let nothing overflow its card, at 360x640 and at 1280x800.

### Requirement 2: The number comes from the proof
**User Story:** As a game maker, I want the number to come from the proof files, so that nobody types it by hand.

#### Acceptance Criteria
1. WHEN the runner page is built THEN THE SYSTEM SHALL read the window from the `window_ok` check of each runner proof file and copy it into the page with the other level facts.
2. IF a runner proof has no `window_ok` check, or its detail text does not hold the window as a whole number THEN THE SYSTEM SHALL fail the build with a message that names the level.
3. THE SYSTEM SHALL compute no window in the browser from anything but the copied number.
