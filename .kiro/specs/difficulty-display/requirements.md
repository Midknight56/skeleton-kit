# Requirements Document

## Introduction

This spec shows the proven facts of each level on the level select screen of the game shell. For a turn level the facts are the fewest actions that win (`actions` in `proofs/<game>/index.json`) and how many of the legal first moves can still win (`firstMoves`, written by the `first-moves` spec). The garden puzzle has 12 turn levels with both facts. The runner has tick levels that have only `actions`. The screen states facts of the proof. It does not say how hard a level is for people. The build reads the numbers from the proof index. The player's browser computes nothing and fetches nothing new for this. The request names a "What's next" item, a proof of how hard each level is. No file in this repository has that heading, so this spec cites only the first-moves spec. It changes `kit/shell`, then the build files outside the folder table, then tests and docs.

## Requirements

### Requirement 1: The facts as numbers and text
**User Story:** As a player, I want a picture of how many first moves can win, so that I see how forgiving a level is before I pick it.

#### Acceptance Criteria
1. THE SYSTEM SHALL turn `{ actions, firstMoves? }` into a count of filled and empty pips and a label text, with a pure function that reads no page and no clock.
2. WHEN `firstMoves` exists THEN THE SYSTEM SHALL give at most 8 pips in total. Filled pips stand for the winning first moves and empty pips for the rest. Filled never exceeds the total. Filled is 0 only when `winning` is 0. Every pip is filled only when `winning` equals `legal`.
3. THE SYSTEM SHALL write both exact numbers in the label text, for example "wins in 4, 2 of 5 first moves win", even when the pips are capped.
4. THE SYSTEM SHALL use no word of opinion ("easy", "hard", "tough", "safe") in any text of this feature.

### Requirement 2: The numbers come from the build
**User Story:** As a game maker, I want the numbers to come from the proof, so that the screen cannot show a number the prover did not find.

#### Acceptance Criteria
1. WHEN a game page is built THEN THE SYSTEM SHALL embed, for each level of `proofs/<game>/index.json`, its `actions` and its `firstMoves` when present, in the page, so the player's browser reads the numbers from the page it already has.
2. THE SYSTEM SHALL copy a number as it is. No number is computed, rounded or guessed at run time.
3. IF `proofs/<game>/index.json` is missing, is not valid, or an item has no whole number `actions` THEN THE SYSTEM SHALL fail the build with a message that names the file and says "run npm run prove".
4. THE SYSTEM SHALL embed only what exists. A tick level gets `actions` and no `firstMoves`.

### Requirement 3: The level select shows them
**User Story:** As a player, I want the level cards to stay clear and few in words, so that I can pick a level in one look.

#### Acceptance Criteria
1. WHEN a level is open (not locked) and has facts THEN THE SYSTEM SHALL show the pips on its card, under the stars, and put the label text in the accessible name of the card after the stars.
2. WHEN a level is locked THEN THE SYSTEM SHALL show no pips and say only that it is locked, as it does now.
3. THE SYSTEM SHALL show no number as visible text on the card. The pips are the picture, and the exact numbers are in the accessible name and in `data-actions`, `data-first-legal` and `data-first-win` of the card.
4. WHEN a level has no `firstMoves` THEN THE SYSTEM SHALL show no pips. The runner cards look as they do now. Their accessible name ends with the `actions` of the proof as ticks, such as "wins in 687 ticks".
5. THE SYSTEM SHALL keep 16 px inside the screen, 12 px between cards, 8 px padding inside a card, nothing over the play area, and no new vertical scroll, at 360x640, 768x1024 and 1920x1080.
6. THE SYSTEM SHALL use no animation or transition on the pips, so reduced motion changes nothing, and SHALL use only colours of the theme palette.

### Requirement 4: Honest claims
**User Story:** As the owner, I want the screen to claim only what the proof shows.

#### Acceptance Criteria
1. THE SYSTEM SHALL word the label as facts of the proof. The README paragraph SHALL say the proof shows that a level can be won, and that the numbers say nothing about how it feels to people.
2. THE SYSTEM SHALL keep the words of `kit/` free of the game words in the kit boundary rule.
3. THE SYSTEM SHALL add no package, and SHALL leave `docs/kit-contract.md` unchanged because the contract of a game does not change.
