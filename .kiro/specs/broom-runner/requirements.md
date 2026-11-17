# Requirements Document

## Introduction

The runner is the second game built on the kit. It lives in `apps/runner`. It is a real-time game at 60 ticks a second with one button. The player runs to the right at a fixed speed and taps to jump over pumpkins, posts and gaps. The player wins at the gate. This game proves that the kit also handles a tick game: every number in its state is an integer, a run is a replay of `none` and `jump` actions, and the prover shows that each course can be finished and that each jump has a fair time window. This spec covers the rules, the courses, the level checks, the scene and the build of the app for the prover and the tool door. It depends on `kit-core` and `tool-door-and-prover`. The theme and the shell belong to the `shell-and-site` spec.

## Requirements

### Requirement 1: Units and constants
**User Story:** As a kit developer, I want every number in the rules to be an integer, so that a run is the same on every machine.

#### Acceptance Criteria
1. THE SYSTEM SHALL use these constants and no others for motion: 60 ticks a second, tile size 512 units, run speed 44 units a tick, gravity 9 units a tick squared, jump speed 150 units a tick upward, player box 320 units wide and 448 units high. The scene scale is set in requirement 6.
2. THE SYSTEM SHALL keep `x`, `feetY`, `vy`, `tick` and `score` as integers at all times.
3. THE SYSTEM SHALL measure `feetY` as the height of the player's feet, 0 on the ground and negative above it.
4. WHEN a run starts THEN `init` SHALL give `x` 0, `feetY` 0, `vy` 0, `onGround` true, `tick` 0, `score` 0, phase `playing`, and every candle of the course not yet taken. The seed has no effect.

### Requirement 2: Course format
**User Story:** As a course author, I want a course as three short text rows, so that I can read it at a glance.

#### Acceptance Criteria
1. THE SYSTEM SHALL read courses from `apps/runner/src/levels/courses.json`, each with `id`, `title`, and three rows of equal length named `air2`, `air1` and `ground`.
2. THE SYSTEM SHALL accept in `ground` only `_` ground, `.` gap, `p` pumpkin, `P` post and `G` gate, and in the air rows only `.` empty and `c` candle.
3. WHEN a course is shorter than 40 or longer than 200 columns, has rows of different lengths, has no `G` or a `G` that is not the last column, has anything other than plain ground and empty air in its first 6 columns, or has a gap longer than 2 columns THEN `parseCourse` SHALL return a list of problems. A problem that belongs to a column SHALL name the column, counted from 1.

### Requirement 3: One tick
**User Story:** As a player, I want the same tap to always give the same jump, so that the game feels fair.

#### Acceptance Criteria
1. WHILE the phase is `playing` and the player is on the ground THE SYSTEM SHALL offer the actions `none` and `jump`, in that order. WHILE the player is in the air it SHALL offer only `none`. WHILE the phase is `won` or `lost` it SHALL offer no action.
2. WHEN a tick is applied THEN THE SYSTEM SHALL run the steps in the design in that exact order.
3. WHEN the player jumps from the ground and no obstacle, gap or gate lies within 4 tiles ahead of the player's box THEN the player SHALL be in the air at the end of ticks 1 to 32 after the jump, SHALL reach a greatest height of 1176 units at the end of the 16th tick, SHALL land on the 33rd tick, and `x` SHALL have grown by 1452 units at the landing.
4. WHEN `step` gets an action that is not in `actions(state)`, or any action after the phase is `won` or `lost`, THEN it SHALL return a state with the same hash as the state it got.

### Requirement 4: Losing and winning
**User Story:** As a player, I want clear reasons for the end of a run, so that I know what to do better.

#### Acceptance Criteria
1. WHEN the player's box overlaps a pumpkin box (512 by 512 units) or a post box (512 by 640 units) THEN THE SYSTEM SHALL report phase `lost` with reason `hit`.
2. WHEN the player is on the ground or lands, and the tile under the centre of the player's box is a gap, THEN THE SYSTEM SHALL report phase `lost` with reason `fell`.
3. WHEN `x` is at or past the left edge of the gate column THEN THE SYSTEM SHALL report phase `won`.
4. WHEN the player's box overlaps a candle box (256 by 256 units, centred in its tile, in `air1` one tile above the ground or in `air2` two tiles above) THEN THE SYSTEM SHALL remove that candle and add 10 to the score.
5. WHEN the phase becomes `won` THEN THE SYSTEM SHALL add 100 to the score.

### Requirement 5: Observation
**User Story:** As a tool, I want to know what comes next and when, so that I can time a jump with `none*n`.

#### Acceptance Criteria
1. WHILE the phase is `playing` THE SYSTEM SHALL return a summary of the form `Tick 20. On the ground. Next: pumpkin in 90 ticks.` or `Tick 5. In the air. Next: gate in 449 ticks.` The kind is `pumpkin`, `post`, `gap` or `gate`. WHEN the phase is `won` the summary SHALL be `Tick T. Won with score S.` and WHEN it is `lost` the summary SHALL be `Tick T. Lost: hit.` or `Tick T. Lost: fell.`
2. THE SYSTEM SHALL return the facts `tick`, `x`, `feetY`, `vy`, `onGround`, `tile` (the column under the centre of the player's box), `next` (kind and `startsInTicks`, or null when the phase is not `playing`), `candlesLeft` and `score`.
3. THE SYSTEM SHALL compute `startsInTicks` for a pumpkin, a post or a gap as the smallest number of ticks n, from 1, for which the right edge of the player's box would be past the left edge of that run, with the player running and not jumping. For the gate it SHALL be the smallest n, from 0, for which the phase would be `won`. The next run is the first run of non-ground columns whose left edge is at or past the right edge of the player's box.
4. THE SYSTEM SHALL return a text map of three rows (`air2`, `air1`, `ground`) that shows the 24 columns of the course from the player's tile, with candles already taken left out and a space for each column past the end of the course. It SHALL use `:` for a gap and `.` for empty air, and the legend SHALL give each character one meaning.

### Requirement 6: Scene
**User Story:** As a player, I want to see far enough ahead, so that I can react in time.

#### Acceptance Criteria
1. THE SYSTEM SHALL draw the player at a fixed horizontal place, one quarter of the play width from the left, and SHALL scroll the course under it. A tile SHALL be the larger of 1 and the play width divided by 15, rounded down, in px, and one unit SHALL be the tile size divided by 512.
2. THE SYSTEM SHALL show at least 10 whole tiles ahead of the player on a 360 by 640 viewport held upright.
3. THE SYSTEM SHALL draw the score only in a 56 px bar at the top, below the top safe area, outside the play area. The pause control belongs to the shell.
4. THE SYSTEM SHALL put into the scene only items that are at least partly inside it, so that `validateScene` reports no problem.

### Requirement 7: Six proven and fair courses
**User Story:** As a player, I want courses that can be finished by a person, so that a loss is my mistake and not the game's.

#### Acceptance Criteria
1. THE SYSTEM SHALL ship 6 courses with ids `r01` to `r06` and lengths of 60, 80, 100, 120, 140 and 160 columns.
2. THE SYSTEM SHALL export `levelChecks` in `apps/runner/src/proof.ts` with the checks `finishable`, `spacing_ok`, `window_ok` and `length_ok` as defined in the design.
3. WHEN `npm run prove` runs THEN every course SHALL be solved by `solveTick` and SHALL pass every check.
4. THE SYSTEM SHALL require a jump window of at least 9 ticks for every obstacle in `r01` and `r02`, 6 ticks in `r03` and `r04`, and 4 ticks in `r05` and `r06`.
5. THE SYSTEM SHALL build `apps/runner/dist/def.js` and `apps/runner/dist/proof.js` with the root script `build:apps`, so that the prover and the tool door can load them.

### Requirement 8: Kit conformance
**User Story:** As a kit developer, I want the tick game to pass the kit's own tests, so that tools and the shell can rely on it.

#### Acceptance Criteria
1. THE SYSTEM SHALL pass `runConformance` with the default options.
2. THE SYSTEM SHALL pass these extra properties for any legal action list: `x` equals 44 times `tick`, `feetY` is never above 0 after a tick, `onGround` is true exactly when `feetY` is 0 and `vy` is 0, the score never falls, and `x`, `feetY`, `vy`, `tick`, `score` and every candle index are integers.
