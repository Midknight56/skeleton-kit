---
inclusion: fileMatch
fileMatchPattern: ["kit/core/**", "kit/solver/**", "kit/conformance/**", "apps/*/src/rules/**"]
---
# Determinism

These rules apply to the kit core, the solver, the conformance tests and every game's `src/rules/` folder.

## State
- State is plain JSON data: objects, arrays, strings, booleans, finite numbers and null. No functions, classes, Maps, Sets, Dates, `undefined`, `NaN` or `Infinity`.
- In a tick game every number in state is an integer. Positions and speeds use fixed point units named in that game's spec.
- `step(state, action)` returns a new state and never changes its input.
- `step(state, action)` called with an action that is not in `actions(state)` returns a state with the same hash as `state`. Conformance property 3 checks this.

## Forbidden in rule code
- `Math.random`, `Date`, `performance`, `setTimeout`, `setInterval`, `requestAnimationFrame`.
- Reading the DOM, storage, the network or the file system.
- Module level variables that change.
- Iterating an object whose key order was not fixed by the code that built it.

The ESLint config enforces the first two lines for these folders. A lint failure is a build failure.

## Randomness
- A game that needs random numbers keeps the generator state as one integer field in its own state and advances it with `nextRandom` from `kit/core`.
- The seed comes only from `init(levelId, seed)`.

## Hash and replay
- `hashState` is the only way to compare states. It is 16 lower case hex characters.
- A replay holds the game id, the rules version, the level id, the seed, the action texts, the final hash and the final phase.
- An action text never contains `*`. In a replay and in the `act` tool, `text*n` means the same action n times, with n from 2 to 3600.
- When a rule changes the result of any existing replay, raise `rulesVersion` in that game and run `npm run prove`.

## Tests come first
- Write the failing test before the rule. Run it and see it fail. Then write the rule.
- Every bug found by play becomes a replay file under that game's `tests/replays/` and a test that runs it.
