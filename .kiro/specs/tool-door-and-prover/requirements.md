# Requirements Document

## Introduction

This spec adds two ways for a program to play a game built on the kit. The tool door is an MCP server with five tools, so an AI coding tool can start, play, look at and replay a game. The prover is a plain search that shows each level can be finished and writes a proof file. The prover calls no AI model. Both use only `kit/core`. This spec depends on the `kit-core` spec.

A game folder (`<appDir>`) is opened through one file, `<appDir>/dist/def.js`. It is a self-contained ES module whose default export is the game definition. The tool door and the prover both load it at run time.

## Requirements

### Requirement 1: Start the tool door
**User Story:** As a game maker, I want one command that opens my game to tools, so that I do not write server code for each game.

#### Acceptance Criteria
1. WHEN `node kit/mcp/dist/server.js --game <appDir>` runs, `<appDir>` is resolved from the current folder, and `<appDir>/dist/def.js` has a valid game definition as its default export THEN THE SYSTEM SHALL serve MCP over standard input and output and list exactly five tools: `new_game`, `act`, `observe`, `render`, `replay`.
2. IF the `--game` argument is missing, the file is missing, the file has no default export, or `validateDef` reports a problem THEN THE SYSTEM SHALL print one line on standard error that names the problem and exit with code 1.
3. THE SYSTEM SHALL write nothing to standard output except MCP messages.
4. IF a tool input has a missing required field, a field of the wrong type, or a value outside the listed choices THEN THE SYSTEM SHALL return an error result with code `bad_input` and change no session.
5. IF a tool handler throws THEN THE SYSTEM SHALL return an error result with code `internal_error`, write the stack to standard error, and keep serving.

### Requirement 2: new_game
**User Story:** As a tool, I want to list levels and start one, so that I can begin a run.

#### Acceptance Criteria
1. WHEN `new_game` is called with no `level` THEN THE SYSTEM SHALL return the game id, the kind and the list of levels, and SHALL create no session.
2. WHEN `new_game` is called with a known `level` and an optional `seed` (an integer from 0 to 2147483647, default 1) THEN THE SYSTEM SHALL create a session and return `session`, `level`, `seed`, `tick`, `status`, `observation` and `legal`.
3. IF the level is unknown or the seed is not an integer from 0 to 2147483647 THEN THE SYSTEM SHALL return an error result with code `unknown_level` or `bad_seed`.
4. WHEN a ninth session is created THEN THE SYSTEM SHALL drop the session that was used least recently. A session is used when it is created and on every `act`, `observe`, `render` or `replay` call that names it.

### Requirement 3: act
**User Story:** As a tool, I want to send one or many actions in one call, so that a long run needs few calls.

#### Acceptance Criteria
1. WHEN `act` is called with a session and 1 to 600 action items THEN THE SYSTEM SHALL expand `text*n` items, apply the actions in order, and return `applied`, `stoppedBy`, `tick`, `status`, `hash`, `observation` and `legal`. `applied` is the number of actions applied, counted after expansion.
2. IF an action is refused THEN THE SYSTEM SHALL stop at that action, keep the actions applied before it, and set `stoppedBy` to `bad_action_text`, `illegal_action` or `game_over`. An item with a malformed `*` form counts as one action and stops the run with `bad_action_text` when it is reached.
3. IF the items expand to more than 3600 actions, or there are more than 600 items, THEN THE SYSTEM SHALL apply nothing and return an error result with code `too_many_actions`. IF the list is empty THEN THE SYSTEM SHALL apply nothing and return an error result with code `bad_input`.
4. IF the session id given to `act`, `observe`, `render` or `replay` is unknown THEN THE SYSTEM SHALL return an error result with code `unknown_session`.

### Requirement 4: observe
**User Story:** As a tool, I want to read the current state without changing it, so that I can decide the next action.

#### Acceptance Criteria
1. WHEN `observe` is called with a session THEN THE SYSTEM SHALL return `tick`, `status`, `hash`, `observation` and `legal` and SHALL leave the session unchanged.

### Requirement 5: render
**User Story:** As a tool or a person reading a report, I want a picture of the state, so that I can see what the numbers mean.

#### Acceptance Criteria
1. WHEN `render` is called with `format` `svg` THEN THE SYSTEM SHALL return the SVG text from `paintSvg` for a 960 by 540 viewport with a safe area of 0 on every side.
2. WHEN `render` is called with `format` `text` THEN THE SYSTEM SHALL return the observation summary and, when the game gives one, the text map with one row on each line and the legend below it.

### Requirement 6: replay
**User Story:** As a game maker, I want to take a replay out of a session and check a replay file, so that a failure can be kept and shown again.

#### Acceptance Criteria
1. WHEN `replay` is called with a session THEN THE SYSTEM SHALL return the replay object for that session.
2. WHEN `replay` is called with a session and `save` true THEN THE SYSTEM SHALL also write the replay to `<appDir>/tests/replays/<game>-<level>-<finalHash>.json` and return the file path. This is the only file the tool door writes.
3. WHEN `replay` is called with a replay object THEN THE SYSTEM SHALL run it and return the result of `runReplay`.
4. IF the call has both a session and a replay, or neither, THEN THE SYSTEM SHALL return an error result with code `bad_input`.

### Requirement 7: Search for turn games
**User Story:** As a game maker, I want the shortest solution of a level, so that I know the level can be finished and what par is.

#### Acceptance Criteria
1. WHEN `solveTurn(def, levelId, seed, options)` finds a state with phase `won` THEN THE SYSTEM SHALL return `solved` true with an action list of the smallest possible length. Among lists of that length it SHALL return the first one in the order of `def.actions`. If the start state is already won, the list is empty.
2. THE SYSTEM SHALL visit each distinct key at most once, where the key is `options.key(state)` when given and the state itself otherwise. `nodes` is the number of distinct keys visited, counting the start state.
3. IF no winning state exists within `maxDepth` (default 60) THEN THE SYSTEM SHALL return `solved` false with reason `depth_limit` when it left states at depth `maxDepth` unexpanded, and reason `exhausted` otherwise. IF more than `maxNodes` (default 200000) states are visited THEN it SHALL return reason `node_limit`.
4. WHEN `options.allow` is given THEN THE SYSTEM SHALL use only the legal actions for which `allow(actionText)` is true.

### Requirement 8: Search for tick games
**User Story:** As a game maker, I want to know that a real-time course can be finished, so that I never ship an impossible course.

#### Acceptance Criteria
1. WHEN `solveTick(def, levelId, seed, options)` runs THEN THE SYSTEM SHALL expand all states of one tick before the next tick, in the order of the previous tick and then the order of `def.actions`, keep only the first state for each distinct hash, drop states with phase `lost`, and stop at the first state with phase `won`. `nodes` is the number of states kept, counting the start state and the won state.
2. IF the set of states becomes empty THEN THE SYSTEM SHALL return `solved` false with reason `exhausted`. IF one tick holds more than `maxStatesPerTick` (default 5000) states THEN it SHALL return reason `node_limit`. IF the states of tick `maxTicks` (default 7200) hold no won state THEN it SHALL return reason `depth_limit`.

### Requirement 9: Prove command
**User Story:** As a game maker, I want one command that proves every level of every game, so that an unfinishable level stops the build.

#### Acceptance Criteria
1. WHEN `npm run prove` runs THEN THE SYSTEM SHALL read the game folders from `kit.config.json`, solve every level, run each solution through `runReplay`, run the game's own level checks when `<appDir>/dist/proof.js` exports `levelChecks`, and write one proof file for each level plus `proofs/<game>/index.json`, where `<game>` is the definition's `id`.
2. THE SYSTEM SHALL write proof files with sorted keys, two space indent, a final new line, and no date or time, so that the same input always gives the same bytes.
3. IF any level is not solved, any replay check fails, or any level check fails THEN THE SYSTEM SHALL print the game, the level and the reason, change no file in `proofs/`, and exit with code 1.
4. WHEN `npm run prove -- --check` runs THEN THE SYSTEM SHALL write nothing. It SHALL exit with code 0 when every fresh proof equals the file in `proofs/`, and otherwise exit with code 2 and name the first level whose fresh proof differs or has no file.
5. The target is that `npm run prove` finishes for both sample games in under 10 seconds. It counts as met only when a recorded run with a named tool shows it.

### Requirement 10: Proof files are protected
**User Story:** As a reviewer, I want proof files that only the prover can change, so that a proof is never edited to hide a failure.

#### Acceptance Criteria
1. WHEN an agent tries to write a file under `proofs/` with a write tool THEN the `protect-proofs` hook SHALL block the write and show the message `Blocked: proofs/ may only be changed by npm run prove.`
2. THE SYSTEM SHALL keep a test that feeds the hook script a sample event with a `proofs/` path and expects exit code 2, a sample event with another path and expects exit code 0, and a sample event with another path whose file content holds the text `proofs/` and expects exit code 0.
