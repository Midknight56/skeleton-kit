# Requirements Document

## Introduction

The garden puzzle is the first of the two games built on the kit. It lives in `apps/garden`. It is a turn based puzzle on a small grid. The player lights one lantern at a time. Each turn every moth flies one step toward the lit lantern. The player wins when every moth rests on a flower, and loses when a moth flies into a web or the turns run out. This spec covers the rules, the levels, the level checks for the prover and the scene. The shell, the theme art and sound belong to the `shell-and-site` spec. This spec depends on `kit-core` and `tool-door-and-prover`.

## Requirements

### Requirement 1: Level format
**User Story:** As a level author, I want levels as short text rows, so that I can read and edit a level in any editor.

#### Acceptance Criteria
1. THE SYSTEM SHALL read levels from `apps/garden/src/levels/levels.json`, each with `id`, `title`, `maxTurns` and `rows`.
2. THE SYSTEM SHALL accept only these characters in `rows`: `.` grass, `#` hedge, `w` web, `f` flower, `m` a moth on grass, and `1` to `5` a lantern post with that id.
3. WHEN a level has rows of different lengths, a width over 9, a height over 7, no moth, more than 4 moths, no lantern, a repeated lantern id, or fewer flowers than moths THEN `parseLevel` SHALL return a list of problems that names the row and column where one applies.
4. THE SYSTEM SHALL number moths from 1 in reading order: top row first, left to right.

### Requirement 2: Actions
**User Story:** As a player, I want one simple choice each turn, so that the puzzle is about planning.

#### Acceptance Criteria
1. WHILE the phase is `playing` THE SYSTEM SHALL offer the action `light:<k>` for every lantern id k that is not lit now, in ascending id order, followed by `wait` when a lantern is lit.
2. THE SYSTEM SHALL offer no action when the phase is `won` or `lost`.
3. THE SYSTEM SHALL encode actions exactly as `light:1` to `light:5` and `wait`, and SHALL decode any other text to null.

### Requirement 3: Movement
**User Story:** As a player, I want moths to move by one clear rule, so that I can predict a turn before I take it.

#### Acceptance Criteria
1. WHEN an action is applied THEN THE SYSTEM SHALL first set the lit lantern for `light:<k>`, and SHALL then compute, once for the turn, the step distance from every cell to the lit lantern over cells that are not hedge, moving up, right, down or left.
2. THE SYSTEM SHALL move moths in id order. A moth that is home, is caught, stands on the lit lantern, or has no path SHALL stay.
3. THE SYSTEM SHALL move each other moth one step to the neighbouring cell whose distance is one less than its own, taking the first such cell in the order up, right, down, left.
4. IF that cell holds another moth that is neither home nor caught THEN THE SYSTEM SHALL leave the moth where it is for this turn.
5. THE SYSTEM SHALL add 1 to the turn count after all moths were handled.

### Requirement 4: Flowers and webs
**User Story:** As a player, I want clear results when a moth reaches a flower or a web, so that winning and losing are obvious.

#### Acceptance Criteria
1. WHEN a moth moves onto a flower that holds no home moth THEN THE SYSTEM SHALL mark the moth as home, and the moth SHALL never move again.
2. WHEN a moth moves onto a flower that already holds a home moth THEN THE SYSTEM SHALL let it stand there without becoming home.
3. WHEN a moth moves onto a web THEN THE SYSTEM SHALL mark the moth as caught.

### Requirement 5: Status
**User Story:** As a player and as a tool, I want one clear status, so that the end of a level is never in doubt.

#### Acceptance Criteria
1. IF any moth is caught THEN THE SYSTEM SHALL report phase `lost` with reason `web`.
2. IF no moth is caught and every moth is home THEN THE SYSTEM SHALL report phase `won`.
3. IF neither holds and the turn count has reached `maxTurns` THEN THE SYSTEM SHALL report phase `lost` with reason `turns`.
4. THE SYSTEM SHALL report the turn count as the score.

### Requirement 6: Observation
**User Story:** As a tool, I want the state in words and in a text map, so that I can choose an action without a picture.

#### Acceptance Criteria
1. THE SYSTEM SHALL return a summary of the form `Turn 3 of 11. Lantern 2 is lit. 1 of 2 moths home.` and `No lantern is lit.` when none is lit.
2. THE SYSTEM SHALL return a text map with the level's size that uses `#`, `.`, `w`, `f`, `F` for a flower with a home moth, `1` to `5` for an unlit lantern, `*` for the lit lantern and `m` for a moth that is not home, and a legend for each of these characters.
3. THE SYSTEM SHALL return the facts `turn`, `maxTurns`, `lit`, `moths` (id, x, y, home, caught), `lanterns` (id, x, y) and `flowersFree`.

### Requirement 7: Scene
**User Story:** As a player, I want the board drawn clearly at any screen size, so that I can read it on a phone.

#### Acceptance Criteria
1. THE SYSTEM SHALL return a scene with one `world` item for each hedge, web, flower and lantern, one `actors` item for each moth, one `fx` item for the glow of the lit lantern, and `hud` items for the turn counter.
2. THE SYSTEM SHALL fit the whole board inside the viewport minus the safe area and a 56 px bar at the top for the `hud` items, with square cells of at least 32 px on a 360 by 640 viewport.
3. THE SYSTEM SHALL give every scene item an id that stays the same between turns for the same thing, so that the shell can animate a move.

### Requirement 8: Twelve proven levels
**User Story:** As a player, I want levels that grow harder and are never impossible, so that I trust the game.

#### Acceptance Criteria
1. THE SYSTEM SHALL ship 12 levels with ids `g01` to `g12`.
2. THE SYSTEM SHALL export `levelChecks` in `apps/garden/src/proof.ts` with the checks `size_ok`, `length_in_band`, `turn_limit`, `needs_switch` and `web_matters` as defined in the design.
3. WHEN `npm run prove` runs THEN every one of the 12 levels SHALL be solved and SHALL pass every check that applies to it.
4. THE SYSTEM SHALL set each level's `maxTurns` to its shortest solution length plus 4.

### Requirement 9: Kit conformance
**User Story:** As a kit developer, I want the game to pass the kit's own tests, so that tools and the shell can rely on it.

#### Acceptance Criteria
1. THE SYSTEM SHALL pass `runConformance` with the default options.
2. THE SYSTEM SHALL pass these extra properties for any legal action list: the number of moths never changes, no moth stands on a hedge, a home moth never changes position, and the turn count rises by exactly 1 for each action.
