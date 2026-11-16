# Design Document

## Overview

`apps/garden` holds one game definition built on `kit/core`. The rules are small enough to prove by breadth first search. All game words stay in this folder.

## Architecture

```
apps/garden/game.config.ts        display title and theme import (the only place for the product name)
apps/garden/src/def.ts            the GameDef, default export
apps/garden/src/rules/level.ts    parseLevel
apps/garden/src/rules/state.ts    GardenState, init
apps/garden/src/rules/step.ts     actions, step, status, encode, decode
apps/garden/src/rules/observe.ts  observe
apps/garden/src/view/scene.ts     view
apps/garden/src/levels/levels.json
apps/garden/src/proof.ts          turnOptions and levelChecks for the prover
apps/garden/tools/find-levels.ts  level search helper, not part of the build
apps/garden/tests/replays/        replay files kept as regression tests
```

## Components and Interfaces

```ts
export interface Moth { id: number; x: number; y: number; home: boolean; caught: boolean }
export interface GardenState {
  level: string;
  w: number; h: number;
  cells: string[];      // rows with '.', '#', 'w', 'f' and '1' to '5'. A moth start cell is stored as '.'.
  moths: Moth[];        // ascending id
  lit: number;          // 0 means no lantern is lit
  turn: number;
  maxTurns: number;
}
export type GardenAction = { kind: 'light'; id: number } | { kind: 'wait' };
export function parseLevel(raw: { id: string; title: string; maxTurns: number; rows: string[] }):
  { ok: true; state: GardenState } | { ok: false; problems: string[] };
```

`x` counts columns from 0 at the left. `y` counts rows from 0 at the top. "Up" is `y - 1`.

Step, in order:

1. If the action is `light:k`, set `lit` to k.
2. Find the cell of lantern `lit`. Compute `dist` for every cell that is not `#` with a breadth first search from that cell.
3. For each moth in ascending id that is not home and not caught:
   - Let `d` be `dist` at the moth's cell. If `d` is 0 or the cell has no path, the moth stays.
   - Look at the neighbours in the order up, right, down, left. Take the first one that is on the board, is not `#`, and has `dist` equal to `d - 1`.
   - If another moth that is not home and not caught stands there now, the moth stays.
   - Otherwise move the moth. If the cell is `w`, set `caught`. If the cell is `f` and no home moth stands on it, set `home`.
4. Add 1 to `turn`.

A moth that moved earlier in the same turn counts at its new cell.

## Data Models

Level checks in `proof.ts`:

| Check | Applies to | Passes when |
| --- | --- | --- |
| `size_ok` | all | width at most 9, height at most 7, 1 to 4 lanterns, moth count as in the band table, flowers at least as many as moths |
| `length_in_band` | all | the shortest solution length is inside the level's band |
| `turn_limit` | all | `maxTurns` equals the shortest solution length plus 4 |
| `needs_switch` | `g03` to `g12` | for every lantern k, `solveTurn` with `allow` limited to `light:k` and `wait` finds no solution |
| `web_matters` | `g04` to `g12` | for at least one lantern k, the run `light:k` followed by `wait` until the game ends is lost with reason `web` |

Band table:

| Level | Moths | Shortest solution, actions |
| --- | --- | --- |
| g01 | 1 | 2 to 3 |
| g02 | 1 | 3 to 4 |
| g03 | 1 | 4 to 6 |
| g04, g05 | 2 | 5 to 8 |
| g06, g07, g08 | 2 | 6 to 11 |
| g09, g10 | 3 | 9 to 13 |
| g11, g12 | 3 | 11 to 16 |

`turnOptions` for the prover: `key` returns `{ lit, moths }` without `turn`, and `maxDepth` is 40. Dropping `turn` is safe because reaching the same board in fewer turns is never worse.

## Error Handling

- `parseLevel` returns problems. It never throws.
- `def.init` throws a `KitError` with code `bad_def` when the shipped `levels.json` holds a level with problems. A unit test parses every shipped level, so this cannot reach a player.
- `decodeAction` returns null for unknown text.

## Testing Strategy

Tests are written first and seen to fail. Three fixture levels live in `apps/garden/src/rules/fixtures.ts`.

| Fixture | Rows | maxTurns | Actions | Expected |
| --- | --- | --- | --- | --- |
| A, straight | `m.f.1` | 4 | `light:1`, `wait` | Moth 1 is at x 1 after the first action and home at x 2 after the second. Phase `won`, turn 2. `solveTurn` gives length 2. |
| B, web | `m.w.1` | 4 | `light:1`, `wait` | Moth 1 is caught at x 2. Phase `lost`, reason `web`, turn 2. `solveTurn` returns `exhausted`. |
| C, queue | `mm.f.f.1` | 8 | `light:1`, then `wait` five times | After action 1, moth 1 is still at x 0 and moth 2 is at x 2. After action 2, moth 2 is home at x 3. After action 4, moth 1 stands at x 3 and is not home. After action 6, moth 1 is home at x 5. Phase `won`, turn 6. |

More tests:

- Tie order: on a 3 by 3 open board with the lantern at the centre right and a moth at the top left, the moth's first step is to the right, because up is off the board and right comes before down.
- Turn limit: fixture A with `maxTurns` 1 is lost with reason `turns` after one action.
- A second, slow reference `step` written inside the test file (it recomputes distances with a different search) must agree with `step` on 300 random runs over the three fixtures and every shipped level.
- Each shipped level parses with no problem.

## Correctness Properties

1. **Moths are kept.** The number of moths never changes, and ids stay 1 to n. (Requirement 9.2)
2. **No moth in a hedge.** After any action, no moth stands on `#`. (3.3)
3. **Home is final.** Once `home` is true, the moth's x and y never change. (4.1)
4. **One turn for each action.** `turn` rises by exactly 1 for each accepted action. (3.5)
5. **Closer or still.** After a turn, each moth that is not home is at a distance to the lit lantern that is one less than before, or it has not moved. (3.3, 3.4)
6. **Proof replays win.** Every replay in `proofs/garden/` ends with phase `won` under the current rules. (8.3)

## Decisions and Alternatives

- One lit lantern at a time. Chosen because the player has at most five choices and can predict a turn. Two lit lanterns made the nearest light rule hard to see.
- Webs are on the path, not walls. Chosen so that the direct route is tempting and wrong.
- Par comes from the proof. The rules do not know par. The shell reads it from `proofs/garden/index.json`.

## Out of Scope

- Animation, sound, art, input handling and the tutorial screen. They belong to the shell spec.
- Random level generation at run time. Levels are fixed files.
- A level editor for players.
