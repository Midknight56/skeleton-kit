# Requirements Document

## Introduction

The runner is the second game built on the kit. It lives in `apps/runner`. It is a real-time game at 60 ticks a second with one button. The player runs to the right at a fixed speed and taps to jump over pumpkins, posts and gaps. The player wins at the gate. This game proves that the kit also handles a tick game: every number in its state is an integer, a run is a replay of `none` and `jump` actions, and the prover shows that each course can be finished and that each jump has a fair time window. This spec covers the rules, the courses, the level checks and the scene. It depends on `kit-core` and `tool-door-and-prover`.

## Requirements

### Requirement 1: Units and constants
**User Story:** As a kit developer, I want every number in the rules to be an integer, so that a run is the same on every machine.

#### Acceptance Criteria
1. THE SYSTEM SHALL use these constants and no others for motion: 60 ticks a second, 16 units for 1 px, tile size 512 units, run speed 44 units a tick, gravity 9 units a tick squared, jump speed 150 units a tick upward, player box 320 units wide and 448 units high.
2. THE SYSTEM SHALL keep `x`, `feetY`, `vy`, `tick` and `score` as integers at all times.
3. THE SYSTEM SHALL measure `feetY` as the height of the player's feet, 0 on the ground and negative above it.

### Requirement 2: Course format
**User Story:** As a course author, I want a course as three short text rows, so that I can read it at a glance.

#### Acceptance Criteria
1. THE SYSTEM SHALL read courses from `apps/runner/src/levels/courses.json`, each with `id`, `title`, and three rows of equal length named `air2`, `air1` and `ground`.
2. THE SYSTEM SHALL accept in `ground` only `_` ground, `.` gap, `p` pumpkin, `P` post and `G` gate, and in the air rows only `.` empty and `c` candle.
3. WHEN a course is shorter than 40 or longer than 200 columns, has rows of different lengths, has no `G` or a `G` that is not the last column, has anything other than plain ground and empty air in its first 6 columns, or has a gap longer than 2 columns THEN `parseCourse` SHALL return a list of problems that names the column.

### Requirement 3: One tick
**User Story:** As a player, I want the same tap to always give the same jump, so that the game feels fair.

#### Acceptance Criteria
1. WHILE the player is on the ground THE SYSTEM SHALL offer the actions `none` and `jump`. WHILE the player is in the air it SHALL offer only `none`.
2. WHEN a tick is applied THEN THE SYSTEM SHALL run the seven steps in the design in that exact order.
3. WHEN the player jumps from the ground and no obstacle is near THEN the player SHALL be in the air for exactly 33 ticks, SHALL reach a greatest height of 1176 units at the 16th tick, and SHALL travel 1452 units before landing.

### Requirement 4: Losing and winning
**User Story:** As a player, I want clear reasons for the end of a run, so that I know what to do better.

#### Acceptance Criteria
1. WHEN the player's box overlaps a pumpkin box (512 by 512 units) or a post box (512 by 1024 units) THEN THE SYSTEM SHALL report phase `lost` with reason `hit`.
2. WHEN the player is on the ground or lands, and the tile under the centre of the player's box is a gap, THEN THE SYSTEM SHALL report phase `lost` with reason `fell`.
3. WHEN `x` is at or past the left edge of the gate column THEN THE SYSTEM SHALL report phase `won`.
4. WHEN the player's box overlaps a candle box (256 by 256 units, centred in its tile, in `air1` one tile above the ground or in `air2` two tiles above) THEN THE SYSTEM SHALL remove that candle and add 10 to the score.
5. WHEN the phase becomes `won` THEN THE SYSTEM SHALL add 100 to the score.

### Requirement 5: Observation
**User Story:** As a tool, I want to know what comes next and when, so that I can time a jump with `none*n`.

#### Acceptance Criteria
1. THE SYSTEM SHALL return a summary of the form `Tick 120. On the ground. Next: pumpkin in 38 ticks.` or `In the air.` or `Next: gate in 12 ticks.`
2. THE SYSTEM SHALL return the facts `tick`, `x`, `feetY`, `vy`, `onGround`, `tile`, `next` (kind and `startsInTicks`), `candlesLeft` and `score`.
3. THE SYSTEM SHALL compute `startsInTicks` as the number of ticks until the right edge of the player's box reaches the left edge of the next obstacle or gap ahead.
4. THE SYSTEM SHALL return a text map of three rows that shows the next 24 columns of the course from the player's tile.

### Requirement 6: Scene
**User Story:** As a player, I want to see far enough ahead, so that I can react in time.

#### Acceptance Criteria
1. THE SYSTEM SHALL draw the player at a fixed horizontal place, one quarter of the play width from the left, and SHALL scroll the course under it.
2. THE SYSTEM SHALL show at least 10 tiles ahead of the player on a 360 by 640 viewport held upright.
3. THE SYSTEM SHALL draw the score and the pause control only in a 56 px bar at the top, outside the play area.

### Requirement 7: Six proven and fair courses
**User Story:** As a player, I want courses that can be finished by a person, so that a loss is my mistake and not the game's.

#### Acceptance Criteria
1. THE SYSTEM SHALL ship 6 courses with ids `r01` to `r06` and lengths of 60, 80, 100, 120, 140 and 160 columns.
2. THE SYSTEM SHALL export `levelChecks` in `apps/runner/src/proof.ts` with the checks `finishable`, `spacing_ok`, `window_ok` and `length_ok` as defined in the design.
3. WHEN `npm run prove` runs THEN every course SHALL be solved by `solveTick` and SHALL pass every check.
4. THE SYSTEM SHALL require a jump window of at least 12 ticks for every obstacle in `r01` and `r02`, 9 ticks in `r03` and `r04`, and 6 ticks in `r05` and `r06`.

### Requirement 8: Kit conformance
**User Story:** As a kit developer, I want the tick game to pass the kit's own tests, so that tools and the shell can rely on it.

#### Acceptance Criteria
1. THE SYSTEM SHALL pass `runConformance` with the default options.
2. THE SYSTEM SHALL pass these extra properties for any legal action list: `x` equals 44 times `tick`, `feetY` is never above 0 after a tick, `onGround` is true exactly when `feetY` is 0 and `vy` is 0, and the score never falls.
