# The kit contract

This page shows how to write a game for the kit. The example is `kit/conformance/sample-lights/def.ts`, a 3 by 3 board of lamps. A press flips one lamp and its four neighbours. The player wins when every lamp is off.

## 1. State is plain data

State holds only objects, arrays, strings, booleans, finite numbers and null. The example state is `{ lamps: number[]; moves: number }`. A tick game keeps every number an integer.

## 2. Write one `GameDef`

A game is one object of type `GameDef<S, A>` from `@kit/core`. Import only from that package entry.

| Member | What it does |
| --- | --- |
| `id`, `title`, `rulesVersion` | Names the game. Raise `rulesVersion` when a rule changes the result of an old replay. |
| `kind` | `'turn'` or `'tick'`. A tick game also sets `ticksPerSecond`. |
| `levels()` | Lists the level ids and titles. |
| `init(levelId, seed)` | Builds the first state. It throws `KitError('unknown_level', ...)` for a level it does not know. |
| `actions(state)` | Lists the legal actions. It returns an empty list when the game has ended. |
| `step(state, action)` | Returns a new state. It never changes its input. An action that is not listed returns a state with the same hash. |
| `status(state)` | Returns the phase (`playing`, `won` or `lost`) and a score. |
| `observe(state)` | Returns a short summary, an optional text map with a legend, and named facts. |
| `view(state, viewport)` | Returns a `Scene`: a list of rectangles, circles, sprites and text on five layers. |
| `encodeAction`, `decodeAction` | Turn an action into text and back. `decodeAction` returns `null` for text it does not know. The example text is `press:1,1`. An action text never contains `*`. |

## 3. Rule code repeats

Code in `kit/core`, `kit/solver`, `kit/conformance` and `apps/*/src/rules` may not use `Math.random`, `Date`, `performance`, `setTimeout`, `setInterval` or `requestAnimationFrame`. Lint fails on them. A game that needs random numbers keeps one integer in its state and advances it with `nextRandom`. The seed comes only from `init`.

## 4. Play it with a session

```ts
import { createSession } from '@kit/core';
import { sampleLights } from '@kit/conformance';

const session = createSession(sampleLights, 'l1', 1);
session.legal();            // ['press:0,0', 'press:1,0', ...]
session.apply('press:1,1'); // { ok: true, hash, status }
session.status().phase;     // 'won'
session.toReplay();         // seed plus actions plus the final hash
```

`apply` never throws. It returns `{ ok: false, error }` for a text it cannot decode, an action that is not legal, or a game that has ended. A refused action leaves the hash unchanged.

## 5. Replay

A replay holds the game id, the rules version, the level id, the seed, the action texts, the final hash and the final phase. `runReplay(def, replay)` checks all of it and returns a result. It never throws. The same replay always ends in the same state. In a replay, `text*n` means the same action n times, with n from 2 to 3600.

## 6. Run the conformance tests

```ts
import { runConformance, sampleLights } from '@kit/conformance';

const results = runConformance(sampleLights);
```

The call runs nine property tests. A failing result holds the property name, the level id, the seed and a shrunk action list in replay form. A game is ready for the kit when every property passes.

## 7. Folders

The kit never names a game. A game imports from the kit only through each package's `index.ts`. One game never imports from another game.
