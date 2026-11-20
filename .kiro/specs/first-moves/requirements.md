# Requirements Document

## Introduction

This spec adds one pair of numbers to the proof of each turn game level: how many of the legal first actions can still lead to a win. A level with 5 legal first actions where only 2 of them can lead to a win gets legal 5 and winning 2. Tick games get nothing. The count uses the same search as `solveTurn` and gives the same numbers on every run. This spec depends on the `tool-door-and-prover` spec and changes only `kit/solver`, plus the proof files that `npm run prove` writes.

## Requirements

### Requirement 1: Count the first moves
**User Story:** As a game maker, I want to know how many first moves still win, so that I can see how forgiving the start of a level is.

#### Acceptance Criteria
1. WHEN `countFirstMoves(def, levelId, seed, options)` runs on a turn game level THEN THE SYSTEM SHALL return `legal`, the number of actions in `def.actions` of the start state that pass `options.allow`, and `winning`, the number of those actions after which a state with phase `won` can be reached within `maxDepth` actions in total, counting the first action.
2. THE SYSTEM SHALL decide each first action with its own search that uses the same breadth first order, `key`, `allow`, `maxNodes` and `maxDepth` rules as `solveTurn`. A first action counts as winning when that search finds a won state. Two first actions that reach the same state are both counted.
3. IF the start state is already won THEN THE SYSTEM SHALL return `legal` 0 and `winning` 0.
4. IF the search for any first action stops with `node_limit` before it finds a won state THEN THE SYSTEM SHALL report that level as undecided and `npm run prove` SHALL treat it as a failed level (exit code 1). A search that ends with `exhausted` or `depth_limit` counts as not winning.
5. THE SYSTEM SHALL return `winning` at most `legal`, and at least 1 for any level that `solveTurn` solves.
6. IF `countFirstMoves` gets a game that is not a turn game THEN THE SYSTEM SHALL throw a plain `Error` whose message starts with "countFirstMoves needs a turn game".

### Requirement 2: Write the numbers into the proofs
**User Story:** As a reviewer, I want the numbers in the proof files, so that I can read them without running a search.

#### Acceptance Criteria
1. WHEN `npm run prove` writes the proof file of a turn game level THEN THE SYSTEM SHALL write `stats.firstMoves` as `{ "legal": <number>, "winning": <number> }` next to `actions` and `nodes`.
2. WHEN `npm run prove` writes `proofs/<game>/index.json` for a turn game THEN THE SYSTEM SHALL add `firstMoves` with the same two numbers to each item of `levels`.
3. THE SYSTEM SHALL write no `firstMoves` key in the proof file or the index item of a tick game level.
4. THE SYSTEM SHALL keep the existing rules for proof files: sorted keys, two space indent, a final new line, no date or time. Two runs on the same tree SHALL give the same bytes, and `npm run prove -- --check` SHALL exit 2 until the proofs are regenerated.
5. THE SYSTEM SHALL call `solveTurn` and `countFirstMoves` with the same `turnOptions` from the game's `dist/proof.js`.
