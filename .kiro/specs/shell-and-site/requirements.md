# Requirements Document

## Introduction

The shell turns any game definition into a complete game in the browser. It lives in `kit/shell`. It draws the scene on a canvas, turns taps and keys into actions, and gives every game the same full set of screens. It also plays a proof replay by itself, which is the watch mode. This spec also covers the `new:game` scaffold in `kit/create`, the landing page and privacy page in `site/`, the usage beacon, and the build. It depends on `kit-core`. The watch mode and the star rating need proof files from `tool-door-and-prover`.

## Requirements

### Requirement 1: Mount a game
**User Story:** As a game maker, I want one call that runs my game in a page, so that I write no page code.

#### Acceptance Criteria
1. WHEN `mountGame(element, { def, theme, input, proofs })` is called THEN THE SYSTEM SHALL show the title screen of that game inside the element.
2. THE SYSTEM SHALL take all colours, the button shape and the type sizes from the `theme` object, and SHALL have no default theme.
3. THE SYSTEM SHALL load no font, script, style or image from another site.

### Requirement 2: Screens
**User Story:** As a player, I want every screen a finished game has, so that the game feels complete.

#### Acceptance Criteria
1. THE SYSTEM SHALL provide these screens: title, level select, play, pause, results, settings, how to play, credits and watch.
2. WHEN the page loses focus or is hidden during play THEN THE SYSTEM SHALL open the pause screen and stop the tick clock.
3. WHEN the player chooses to reset progress THEN THE SYSTEM SHALL ask for confirmation in a box with two buttons before it deletes anything.
4. THE SYSTEM SHALL let the player reach every screen and every control with the keyboard alone, with a visible focus mark.
5. THE SYSTEM SHALL show the level select with one tile for each level, locked tiles for levels after the first unfinished one, and the stars earned.

### Requirement 3: Play
**User Story:** As a player, I want my taps and keys to act at once, so that the game responds.

#### Acceptance Criteria
1. WHEN a pointer or key event arrives during play THEN THE SYSTEM SHALL pass it to the game's `input.toAction` function and SHALL apply the returned action text, if any, to the session.
2. WHILE a tick game is in play THE SYSTEM SHALL apply exactly one action for each tick at the game's `ticksPerSecond`, using a fixed time step that does not depend on the frame rate, and SHALL apply `none` when the player gave no input.
3. WHEN a tick game falls more than 5 ticks behind THEN THE SYSTEM SHALL pause the tick clock for that frame and SHALL not skip or batch more than 5 ticks.
4. WHEN a turn game is in play THEN THE SYSTEM SHALL offer an undo control that calls `session.undo()`.
5. WHEN the phase becomes `won` or `lost` THEN THE SYSTEM SHALL open the results screen with the reason, the stars, and the buttons next, retry and levels.

### Requirement 4: Stars and progress
**User Story:** As a player, I want my progress kept, so that I can come back later.

#### Acceptance Criteria
1. THE SYSTEM SHALL give 3 stars for a won turn level at par or better, 2 stars within 2 actions of par, and 1 star otherwise, with par read from the proof index.
2. THE SYSTEM SHALL give stars for a won tick level from the share of candles taken: 3 stars for all, 2 for at least half, 1 otherwise.
3. THE SYSTEM SHALL save progress and settings in `localStorage` under `kit.<gameId>.v1`.
4. IF storage is not available THEN THE SYSTEM SHALL keep working and SHALL say once, on the title screen, that progress will not be saved.

### Requirement 5: Lessons
**User Story:** As a new player, I want to learn by doing in the first level, so that I never read a manual.

#### Acceptance Criteria
1. THE SYSTEM SHALL show each control lesson given by the game as a short hint next to the thing it is about, during the first level.
2. THE SYSTEM SHALL show one lesson at most 3 times in total, counted in storage, and SHALL list every lesson on the how to play screen.

### Requirement 6: Painter and layout
**User Story:** As a player on a phone, I want every control inside the screen and apart from the others, so that I never miss a tap.

#### Acceptance Criteria
1. THE SYSTEM SHALL draw the scene from `def.view` on a canvas sized for the device pixel ratio, in layer order.
2. THE SYSTEM SHALL animate an item that keeps its id between two states from its old place to its new place over 120 ms for a turn game.
3. THE SYSTEM SHALL keep every control at least 16 px inside the viewport and the safe area, at least 12 px from the next control, and at least 44 px in both width and height.
4. THE SYSTEM SHALL pass the layout test at 360x640, 375x667, 390x844, 412x915, 768x1024, 1280x720 and 1920x1080 for every screen, and the test SHALL name the screen and the control that fails.
5. WHEN the system asks for reduced motion THEN THE SYSTEM SHALL turn off shake, flashes and parallax.

### Requirement 7: Sound
**User Story:** As a player, I want sound that I can turn off, so that I can play anywhere.

#### Acceptance Criteria
1. THE SYSTEM SHALL make every sound in code with WebAudio from short recipes given by the theme, and SHALL load no sound file.
2. THE SYSTEM SHALL start no sound before the first tap or key.
3. THE SYSTEM SHALL offer separate switches for sound and music on the settings screen and SHALL save both.

### Requirement 8: Watch mode
**User Story:** As a visitor with one minute, I want to see a level play by itself, so that I understand the game without playing.

#### Acceptance Criteria
1. WHEN watch mode starts for a level THEN THE SYSTEM SHALL run that level's proof replay through a normal session at 1 times or 4 times speed and SHALL show a pointer mark at each action.
2. THE SYSTEM SHALL show the text `Proved in N actions` for a turn level and `Proved fair: every jump has N ticks or more` for a tick level, with N read from the proof file.
3. IF a proof replay does not end in phase `won` THEN THE SYSTEM SHALL show `This proof is out of date` and SHALL not show the proved text.

### Requirement 9: Themes
**User Story:** As a game maker, I want each game to look like itself, so that two games from one kit do not look the same.

#### Acceptance Criteria
1. THE SYSTEM SHALL require a theme with a palette of 8 named colours, a button radius, a type scale, a signature shape and sound recipes.
2. THE SYSTEM SHALL fail a test when a theme's `primary` or `secondary` colour has an HSL saturation below 0.25, or when text on its background has a contrast ratio below 4.5.
3. THE SYSTEM SHALL ship two themes, one in each app folder, that differ in palette, button radius and signature shape.

### Requirement 10: Play through tests
**User Story:** As a maker, I want the whole game played in a real browser on each change, so that a broken screen never ships.

#### Acceptance Criteria
1. THE SYSTEM SHALL run a good path test for each game in a headless browser: title, how to play, every level won by sending the proof replay as real input events, results, settings changed and kept after reload.
2. THE SYSTEM SHALL run a bad path test for each game: a lost level with its reason shown, retry, pause on focus loss, reset with cancel and with confirm, and play with storage blocked.
3. THE SYSTEM SHALL fail either test on any page error or console error.

### Requirement 11: New game scaffold
**User Story:** As a game maker, I want a third game started in one command, so that I can see how little a game needs.

#### Acceptance Criteria
1. WHEN `npm run new:game -- <id>` runs with an id of lower case letters, digits and `-` that is not in use THEN THE SYSTEM SHALL create `apps/<id>` from the template with a working copy of `sample-lights`, add it to `kit.config.json`, and print the next three commands.
2. THE SYSTEM SHALL create an app that passes `npm run verify` and `npm run prove` with no edit.
3. IF the id is in use or not valid THEN THE SYSTEM SHALL change nothing and exit with code 1.

### Requirement 12: Site, privacy and build
**User Story:** As a judge, I want one link that shows the idea at once, so that I do not need to install anything.

#### Acceptance Criteria
1. THE SYSTEM SHALL build a static site with a landing page at `/`, the garden puzzle at `/garden/`, the runner at `/runner/` and a privacy page at `/privacy/`.
2. THE SYSTEM SHALL start a watch mode run of garden level `g03` in the first screen of the landing page with no tap needed, next to the list of the tool calls from its proof.
3. THE SYSTEM SHALL send a usage beacon only when the build variable `VITE_BEACON_URL` is set, and then only these events with no id, no time of day and no other data: `open`, `level_start`, `level_end`, `watch_start`, each with the game id and the level id.
4. THE SYSTEM SHALL list every beacon event and its fields on the privacy page.
5. THE SYSTEM SHALL keep the version in every `package.json` below 1.0.0, and the build SHALL fail otherwise.
