# Requirements Document

## Introduction

The shell turns any game definition into a complete game in the browser. It lives in `kit/shell`. It draws the scene on a canvas, turns taps and keys into actions, and gives every game the same full set of screens. It also plays a proof replay by itself, which is the watch mode. This spec also covers the `new:game` scaffold in `kit/create`, the landing page and privacy page in `site/`, the usage beacon and the build.

This spec owns, for both games, the page, the theme, the input map, the control lessons, the end reason texts, and the star rule of a tick game. These files live in `apps/garden` and `apps/runner`. The `garden-puzzle` and `broom-runner` specs leave them to this spec, and their tasks do not change.

It depends on `kit-core` and `tool-door-and-prover`. The watch mode and the star rating need proof files from `tool-door-and-prover`. The work on `apps/runner` starts after the `broom-runner` tasks that build `def.ts`, `proof.ts` and `proofs/runner/`.

## Requirements

### Requirement 1: Mount a game
**User Story:** As a game maker, I want one call that runs my game in a page, so that I write no page code.

#### Acceptance Criteria
1. WHEN `mountGame(element, options)` is called with a game definition, a theme, an input map, proofs and texts THEN THE SYSTEM SHALL show the title screen of that game inside the element.
2. THE SYSTEM SHALL take all colours, the button shape and the type sizes from the `theme` object, and SHALL have no default theme. WHEN `mountGame` is called with no theme THEN it SHALL throw an `Error` whose text names `theme`.
3. THE SYSTEM SHALL load no font, script, style or image from another site. A test SHALL scan every built page and script for a `src`, a stylesheet `href`, a `url()` or an `@import` that starts with `http:`, `https:` or `//`. A plain link in an `<a href>` and an XML namespace text are not loads.

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
1. WHEN a pointer or key event arrives during play THEN THE SYSTEM SHALL pass it to the game's `input.toAction` function. A pointer event SHALL carry the ids of the scene items under the pointer, top item first, without items of the layers `fx` and `hud` and without text items. A pointer event SHALL count only inside the play area. A key event SHALL count only while no button has focus.
2. WHEN `toAction` returns an action text that is in `session.legal()` THEN THE SYSTEM SHALL apply it to the session. WHEN it returns null or a text that is not legal THEN THE SYSTEM SHALL change nothing.
3. WHILE a tick game is in play THE SYSTEM SHALL apply exactly one action for each tick at the game's `ticksPerSecond`, using a fixed time step that does not depend on the frame rate. The action SHALL be the last one given by `toAction` since the previous tick, or the game's `idle` action when there was none. An input SHALL count for one tick only.
4. WHEN a tick game falls more than 5 ticks behind in one frame THEN THE SYSTEM SHALL apply 5 ticks in that frame and SHALL drop the rest of the time owed. It SHALL never apply more than 5 ticks in one frame.
5. WHEN a turn game is in play THEN THE SYSTEM SHALL offer an undo control that calls `session.undo()`.
6. WHEN the phase becomes `won` or `lost` THEN THE SYSTEM SHALL open the results screen with the reason text that the game gives for `status.reason`, the stars for a win, and the buttons next, retry and levels. The next button SHALL be absent after the last level.
7. THE SYSTEM SHALL start every level with seed 1, the seed of the prover, so that a proof replay is valid in the shell.

### Requirement 4: Stars and progress
**User Story:** As a player, I want my progress kept, so that I can come back later.

#### Acceptance Criteria
1. THE SYSTEM SHALL give 3 stars for a won turn level at par or better, 2 stars within 2 actions of par, and 1 star otherwise. Par is the `actions` of that level in the proof index, and the actions used are `session.tick`.
2. THE SYSTEM SHALL give stars for a won tick level by the game's `tickStars` function, which takes the start state and the end state.
3. THE SYSTEM SHALL save progress and settings in `localStorage` under `kit.<gameId>.v1`, and a better result SHALL never lower the stored stars or the stored best of a level.
4. IF storage is not available THEN THE SYSTEM SHALL keep working and SHALL say once, on the title screen, that progress will not be saved.

### Requirement 5: Lessons
**User Story:** As a new player, I want to learn by doing in the first level, so that I never read a manual.

#### Acceptance Criteria
1. THE SYSTEM SHALL show each control lesson given by the game as a hint of at most 2 words next to the scene item or button it is about, from the start of the first level until the first action is applied.
2. THE SYSTEM SHALL count one showing each time a level start displays a lesson, SHALL show one lesson at most 3 times in total, counted in storage, and SHALL list every lesson and every key on the how to play screen.

### Requirement 6: Painter and layout
**User Story:** As a player on a phone, I want every control inside the screen and apart from the others, so that I never miss a tap.

#### Acceptance Criteria
1. THE SYSTEM SHALL draw the scene from `def.view` on a canvas sized for the device pixel ratio, in layer order.
2. THE SYSTEM SHALL animate an item that keeps its id between two states from its old place to its new place over 120 ms for a turn game.
3. THE SYSTEM SHALL keep every control at least 16 px inside the viewport and the safe area, at least 12 px from the next control, at least 44 px in both width and height, with at least 8 px between its text and its edge, and outside the play area.
4. THE SYSTEM SHALL pass the layout test at 360x640, 375x667, 390x844, 412x915, 768x1024, 1280x720 and 1920x1080 for every screen, and the test SHALL name the screen and the control that fails. No screen of these sizes SHALL need scrolling to reach a control.
5. WHEN the system asks for reduced motion THEN THE SYSTEM SHALL turn off shake, flashes and parallax.
6. THE SYSTEM SHALL put every control of the play screen in a strip under the play area. The strip is 72 px high plus the bottom safe area. THE SYSTEM SHALL call `def.view` with a viewport that is the play area, that is the page without the strip.

### Requirement 7: Sound
**User Story:** As a player, I want sound that I can turn off, so that I can play anywhere.

#### Acceptance Criteria
1. THE SYSTEM SHALL make every sound in code with WebAudio from short recipes given by the theme, one for each sound name and one looping music recipe, and SHALL load no sound file.
2. THE SYSTEM SHALL start no sound before the first tap or key.
3. THE SYSTEM SHALL offer separate switches for sound and music on the settings screen and SHALL save both.

### Requirement 8: Watch mode
**User Story:** As a visitor with one minute, I want to see a level play by itself, so that I understand the game without playing.

#### Acceptance Criteria
1. WHEN watch mode starts for a level THEN THE SYSTEM SHALL run that level's proof replay through a normal session at 1 times or 4 times speed and SHALL show a pointer mark at each action, on the item or button that the game's `anchorFor` names for that action.
2. WHEN every check in the proof file has passed THEN THE SYSTEM SHALL show the text `Proved in N actions` for a turn level, with N from `stats.actions` of the proof file, and `Proved: every jump has N ticks or more` for a tick level, with N from the game's `fairTicks` function.
3. IF `runReplay` does not accept the proof replay, or the replay does not end in phase `won`, THEN THE SYSTEM SHALL show `This proof is out of date` and SHALL not show the proved text.
4. WHEN the page address has `?watch=<levelId>` for a level of the game THEN THE SYSTEM SHALL start watch mode for that level at once with no tap, and SHALL start it again 3 seconds after it ends.

### Requirement 9: Themes
**User Story:** As a game maker, I want each game to look like itself, so that two games from one kit do not look the same.

#### Acceptance Criteria
1. THE SYSTEM SHALL require a theme with a palette of 8 named colours written as `#rrggbb`, a button radius, a type scale, a signature shape, sound recipes and a music recipe.
2. THE SYSTEM SHALL fail a test when a theme's `primary` or `secondary` colour has an HSL saturation below 0.25, or when its `text` colour on its `background` colour has a contrast ratio below 4.5. A test for each game SHALL also fail when the fill of a `text` item in the first scene of its first level has a contrast ratio below 4.5 on the theme's `background`.
3. THE SYSTEM SHALL ship two themes, one in each app folder, that differ in palette, button radius and signature shape, and a test SHALL check that.

### Requirement 10: Play through tests
**User Story:** As a maker, I want the whole game played in a real browser on each change, so that a broken screen never ships.

#### Acceptance Criteria
1. THE SYSTEM SHALL run a good path test for each game in a headless browser: title, how to play, every level won by sending the proof replay as real input events, results, settings changed and kept after reload.
2. THE SYSTEM SHALL run a bad path test for each game: a lost level with its reason shown, retry, pause on focus loss, reset with cancel and with confirm, and play with storage blocked.
3. THE SYSTEM SHALL fail either test on any page error or console error.
4. THE SYSTEM SHALL run a keyboard test for each game: with the Tab key alone, every control of the title, level select, pause, settings and results screens gets focus in turn, and each shows a focus mark.

### Requirement 11: New game scaffold
**User Story:** As a game maker, I want a third game started in one command, so that I can see how little a game needs.

#### Acceptance Criteria
1. WHEN `npm run new:game -- <id>` runs with an id of lower case letters, digits and `-` that is not in use THEN THE SYSTEM SHALL create `apps/<id>` from the template with a working copy of `sample-lights`, add it to `kit.config.json`, and print the next three commands: `npm install`, `npm run prove` and `npm run verify`.
2. THE SYSTEM SHALL create an app that passes `npm run prove` and then `npm run verify` with no edit. The root build scripts SHALL build every app listed in `kit.config.json`.
3. IF the id is in use or not valid THEN THE SYSTEM SHALL change nothing and exit with code 1.
4. THE SYSTEM SHALL write every created file as UTF-8 with no byte order mark and with LF line endings.

### Requirement 12: Site, privacy and build
**User Story:** As a judge, I want one link that shows the idea at once, so that I do not need to install anything.

#### Acceptance Criteria
1. THE SYSTEM SHALL build a static site with a landing page at `/`, the garden puzzle at `/garden/`, the runner at `/runner/` and a privacy page at `/privacy/`.
2. THE SYSTEM SHALL start a watch mode run of garden level `g03` in the first screen of the landing page with no tap needed, next to the list of the tool calls from its proof. The landing page SHALL show it with a frame that loads `/garden/?watch=g03`.
3. THE SYSTEM SHALL send a usage beacon only when the build variable `VITE_BEACON_URL` is set, and then only these events with no user id, no time of day and no other data: `open` with the game id, `level_start` and `watch_start` with the game id and the level id, and `level_end` with the game id, the level id and `won` or `lost`.
4. THE SYSTEM SHALL list every beacon event and its fields on the privacy page, SHALL list the storage key, and SHALL say that the receiving server sees the address of the request, as any server does.
5. THE SYSTEM SHALL keep the version in every `package.json` of the repository below 1.0.0, and the build SHALL fail otherwise.

### Requirement 13: Input of the garden puzzle
**User Story:** As a player, I want to light a lantern with one tap or one key, so that the puzzle is about planning and not about the controls.

#### Acceptance Criteria
1. WHEN the pointer holds the item `lantern-<k>` and lantern k is not lit THEN `toAction` SHALL return `light:<k>`. WHEN it holds the item of the lit lantern THEN it SHALL return `wait`. The first lantern item in the list of ids counts, so a moth standing on a lantern post does not hide the lantern. For any other pointer event it SHALL return null.
2. WHEN the key is `1` to `5` THEN `toAction` SHALL act as a tap on that lantern, and SHALL return null when the level has no such lantern. WHEN the key is a space and a lantern is lit THEN it SHALL return `wait`. For any other key, or a space with no lantern lit, it SHALL return null.
3. THE SYSTEM SHALL give the garden puzzle one button with the id `wait` that applies `wait`, and `anchorFor` SHALL name `lantern-<k>` for `light:<k>` and `wait` for `wait`.
4. THE SYSTEM SHALL give the garden puzzle the end reason texts `Caught in a web` for `web` and `Out of turns` for `turns`, and its `idle` SHALL be null.

### Requirement 14: Input of the runner
**User Story:** As a player, I want one tap anywhere to jump, so that I can play with one thumb.

#### Acceptance Criteria
1. WHEN any pointer event arrives, with any list of ids, THEN `toAction` SHALL return `jump`. WHEN the key is a space it SHALL return `jump`. For any other key it SHALL return null.
2. THE SYSTEM SHALL give the runner `idle` `none`, no buttons, and `anchorFor` SHALL name `player` for `jump` and null for `none`.
3. THE SYSTEM SHALL give the runner the end reason texts `Hit an obstacle` for `hit` and `Fell in a gap` for `fell`.
4. THE SYSTEM SHALL give a won runner level 3 stars when every candle was taken, 2 stars when at least half were taken, and 1 star otherwise. A course with no candle gives 3 stars. The candles taken are the candles of the start state minus the candles of the end state.
5. THE SYSTEM SHALL give the runner a `fairTicks` function that returns `minWindow` of the level from `levelPlans` in `apps/runner/src/proof.ts`, and null for a level that has no plan.

### Requirement 15: Control lessons of the two games
**User Story:** As a new player, I want one or two short hints on the first level, so that I know what to press without a manual.

#### Acceptance Criteria
1. THE SYSTEM SHALL give the garden puzzle these lessons, in this order: `tap-lantern` with the text `Tap lantern` on `lantern-1`, `wait-turn` with the text `Then wait` on the button `wait`, and `switch-lantern` with the text `Or switch` on `lantern-2`.
2. THE SYSTEM SHALL give the runner these lessons, in this order: `jump` with the text `Tap: jump` on `player`, and `candles` with the text `Take candles` on `hud-score`.
3. THE SYSTEM SHALL keep every lesson id unique, every lesson text at most 2 words, and the number of lessons of a game at most 4.
4. A test for each game SHALL check that every anchor names an item in the first scene of its first level, or a button of the input map.
