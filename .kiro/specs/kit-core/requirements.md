# Requirements Document

## Introduction

The kit core is the contract that every game in this repository follows. A game is plain data plus pure functions. The core runs a game as a session, records it as a replay, and compares states by hash. It also holds the scene types and an SVG painter, so a tool can get a picture without a browser. The conformance package holds nine property tests that any game must pass. Everything else in the kit and both games depend on this spec.

## Requirements

### Requirement 1: Game contract
**User Story:** As a game maker, I want one small contract for a game, so that the same game can be played by a person, a test, a prover and an AI tool.

#### Acceptance Criteria
1. THE SYSTEM SHALL export a `GameDef<S, A>` type with exactly these members: `id`, `title`, `rulesVersion`, `kind`, `ticksPerSecond`, `levels`, `init`, `actions`, `step`, `status`, `observe`, `view`, `encodeAction`, `decodeAction`.
2. THE SYSTEM SHALL accept `kind` values `turn` and `tick` only, and SHALL require `ticksPerSecond` to be an integer from 1 to 120 when `kind` is `tick`.
3. WHEN `validateDef(def)` is called with a definition whose `id` is not lower case letters, digits and `-`, or whose `levels()` is empty or has a repeated id, THEN THE SYSTEM SHALL return a list of problems that names each failing member.
4. THE SYSTEM SHALL keep `kit/core` free of any runtime dependency outside the TypeScript standard library, and a test SHALL fail when `kit/core/package.json` lists a runtime dependency or a file in `kit/core/src` imports a module that is not a relative path.
5. THE SYSTEM SHALL require `observe(state).summary` to be at most 120 characters, and SHALL require the rows of `textMap`, when present, to have equal length.

### Requirement 2: Session
**User Story:** As a tool or a shell, I want to run a game step by step, so that I can apply actions and read the result.

#### Acceptance Criteria
1. WHEN `createSession(def, levelId, seed)` is called with a level id from `def.levels()` and an integer seed from 0 to 2147483647 THEN THE SYSTEM SHALL return a session whose state equals `def.init(levelId, seed)` and whose tick is 0.
2. WHEN `createSession` is called with an unknown level id or a seed outside the range THEN THE SYSTEM SHALL throw a `KitError` with code `unknown_level` or `bad_seed`.
3. WHEN `session.apply(text)` is called with the text of a legal action THEN THE SYSTEM SHALL replace the state with `def.step(state, action)`, add 1 to the tick, and return `{ ok: true, hash, status }`.
4. IF the text does not decode THEN THE SYSTEM SHALL return `{ ok: false, error: "bad_action_text", message }` and SHALL leave the state and the tick unchanged.
5. IF the action decodes but is not in `def.actions(state)` THEN THE SYSTEM SHALL return `{ ok: false, error: "illegal_action", message }` and SHALL leave the state and the tick unchanged.
6. IF the phase is `won` or `lost` THEN THE SYSTEM SHALL return `{ ok: false, error: "game_over", message }` for every text, including a text that does not decode, SHALL leave the state and the tick unchanged, and SHALL make `session.legal()` return an empty list.
7. WHEN `session.legal()` is called THEN THE SYSTEM SHALL return the encoded text of every action from `def.actions(state)` in the same order.
8. WHEN `session.undo()` is called on a turn game THEN THE SYSTEM SHALL keep the last 500 states, and when at least one is kept SHALL restore the latest one, lower the tick by 1 and return `true`. On a tick game, or when no state is kept, it SHALL return `false` and change nothing.

### Requirement 3: Hash
**User Story:** As a prover and a test, I want one stable fingerprint of a state, so that two runs can be compared.

#### Acceptance Criteria
1. THE SYSTEM SHALL export `hashState(state)` that returns exactly 16 lower case hex characters.
2. THE SYSTEM SHALL return the same hash for two states that are deep equal, whatever the order in which object keys were added.
3. WHEN `hashState` receives a value that holds `undefined`, a function, `NaN`, `Infinity`, a `Map`, a `Set` or a `Date` THEN THE SYSTEM SHALL throw a `KitError` with code `not_plain_data` that names the path of the bad value.

### Requirement 4: Replay
**User Story:** As a game maker, I want a small file that replays a whole run, so that a bug or a proof can be shown again.

#### Acceptance Criteria
1. WHEN `session.toReplay()` is called THEN THE SYSTEM SHALL return an object with `format` 1, `game`, `rulesVersion`, `level`, `seed`, `actions`, `finalHash` and `finalPhase`.
2. THE SYSTEM SHALL store consecutive equal actions in a replay as `text*n` with n from 2 to 3600, SHALL split a longer run into several items, and SHALL reject any action text that contains `*`.
3. WHEN `runReplay(def, replay)` is called and every action is legal and the final hash and phase match THEN THE SYSTEM SHALL return `{ ok: true, finalHash, finalPhase }`.
4. IF an action in the replay is not legal THEN THE SYSTEM SHALL return `{ ok: false, error: "illegal_action", mismatchAt }` where `mismatchAt` is the zero based index of that action after expansion. The same shape applies to the errors `bad_action_text` (text does not decode or the `*` form is malformed) and `game_over` (an action follows a `won` or `lost` phase).
5. IF the final hash or the final phase differs THEN THE SYSTEM SHALL return `{ ok: false, error: "hash_mismatch" }` or `{ ok: false, error: "phase_mismatch" }`.
6. IF `replay.game` or `replay.rulesVersion` differs from the definition THEN THE SYSTEM SHALL return `{ ok: false, error: "wrong_game" }` or `{ ok: false, error: "rules_changed" }` without running any action.
7. IF `replay.level` is not a level of the definition or `replay.seed` is outside the seed range THEN THE SYSTEM SHALL return `{ ok: false, error: "unknown_level" }` or `{ ok: false, error: "bad_seed" }` and SHALL NOT throw. `runReplay` never throws on data that comes from a file.

### Requirement 5: Random numbers
**User Story:** As a game maker, I want random numbers that repeat, so that a seeded game is the same every time.

#### Acceptance Criteria
1. THE SYSTEM SHALL export `nextRandom(rngState)` that returns `{ value, state }` where both are integers from 0 to 4294967295.
2. THE SYSTEM SHALL export `randomInt(rngState, n)` that returns `{ value, state }` with `value` an integer from 0 to n minus 1, for n from 1 to 65536.
3. THE SYSTEM SHALL give the same sequence for the same starting state on every run and every platform.

### Requirement 6: Scene and SVG painter
**User Story:** As a tool or a test, I want a picture of a state as text, so that I can look at a game without a browser.

#### Acceptance Criteria
1. THE SYSTEM SHALL export a `Scene` type made of items of kind `rect`, `circle`, `sprite` and `text`, each with a unique `id` and one of the layers `back`, `world`, `actors`, `fx`, `hud`.
2. WHEN `paintSvg(scene)` is called THEN THE SYSTEM SHALL return one SVG document as a string, with items drawn in layer order and then in list order.
3. WHEN a sprite has no entry in the optional sprite map THEN THE SYSTEM SHALL draw a rounded rectangle of the sprite's size with the sprite name in a `title` element.
4. THE SYSTEM SHALL escape `&`, `<`, `>` and `"` in every text and attribute value.
5. WHEN `validateScene(scene)` is called THEN THE SYSTEM SHALL return a list of problems for repeated ids, negative sizes and items fully outside the scene.

### Requirement 7: Conformance suite
**User Story:** As a game maker, I want ready tests for the contract, so that a new game is checked from its first day.

#### Acceptance Criteria
1. THE SYSTEM SHALL export `runConformance(def, options)` from `kit/conformance` that runs nine named properties with fast-check and returns one result for each property.
2. THE SYSTEM SHALL pick the level id and the seed with fast-check and SHALL generate action sequences only from `def.actions(state)`, up to `options.maxActions` (default 60 for turn games and 600 for tick games), over `options.runs` runs (default 100).
3. WHEN a property fails THEN THE SYSTEM SHALL report the property name, the level id, the seed and the shortest failing action list found by shrinking, in replay form.
4. THE SYSTEM SHALL fail each of three broken sample games kept in `kit/conformance/broken/`: one that reads a hidden counter, one that changes its input state, and one that accepts an action it did not list.

### Requirement 8: Sample games
**User Story:** As a kit developer, I want two tiny games inside the kit, so that the kit can be tested without the real games.

#### Acceptance Criteria
1. THE SYSTEM SHALL include a turn game `sample-lights` in `kit/conformance/sample-lights/`: a 3x3 board of lamps, action `press:x,y` flips that lamp and each neighbour above, below, left and right of it that is on the board (a corner flips 3 lamps, an edge 4, the centre 5), the game is won when every lamp is off, and it has 3 levels with ids `l1`, `l2` and `l3`, each with at least one lamp on.
2. THE SYSTEM SHALL include a tick game `sample-hop` in `kit/conformance/sample-hop/`: a runner on a line of 40 cells at 10 ticks a second, actions `none` and `hop`, the runner moves one cell each tick, a hop makes it airborne for 4 ticks and an airborne runner passes any blocked cell, the game is won on reaching cell 39 and lost on arriving on a blocked cell while not airborne, and it has 2 levels with ids `h1` and `h2`.
3. THE SYSTEM SHALL pass `runConformance` for both sample games.

### Requirement 9: Lint rules for rule code
**User Story:** As a kit developer, I want the build to stop on code that cannot repeat, so that determinism does not depend on review.

#### Acceptance Criteria
1. WHEN a file under `kit/core`, `kit/solver`, `kit/conformance` or `apps/*/src/rules` uses `Math.random`, `Date`, `performance`, `setTimeout`, `setInterval` or `requestAnimationFrame` THEN `npm run lint` SHALL fail and name the file and line. The rule SHALL NOT apply to `*.test.ts` files, because the tests for requirement 3.3 must build a `Date`.
2. THE SYSTEM SHALL keep a fixture file `tools/lint-fixtures/bad-rule.ts` that uses `Math.random`, and a test SHALL confirm that lint fails on it.
