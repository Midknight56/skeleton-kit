# Design Document

## Overview

`apps/garden` holds one game definition built on `kit/core`. The rules are small enough to prove by breadth first search. All game words stay in this folder.

## Architecture

```
apps/garden/package.json          workspace package @app/garden, depends on @kit/core, @kit/solver, @kit/conformance
apps/garden/build.mjs             esbuild: src/def.ts to dist/def.js, src/proof.ts to dist/proof.js, tools/find-levels.ts to dist/find-levels.js
apps/garden/game.config.ts        display title (the only place for the product name). The theme import is added by the shell-and-site spec
apps/garden/src/def.ts            makeGardenDef(levels) and the default export, which uses levels.json
apps/garden/src/rules/level.ts    parseLevel
apps/garden/src/rules/state.ts    GardenState, initState
apps/garden/src/rules/step.ts     actions, step, status, encodeAction, decodeAction
apps/garden/src/rules/observe.ts  observe
apps/garden/src/rules/fixtures.ts the fixture levels of the tests
apps/garden/src/view/scene.ts     boardLayout and view
apps/garden/src/levels/levels.json
apps/garden/src/proof.ts          turnOptions, runChecks and levelChecks for the prover
apps/garden/tools/find-levels.ts  level search helper, not part of the game
apps/garden/tests/replays/        replay files kept as regression tests
```

`dist/def.js` and `dist/proof.js` are the two files the prover and the tool door load (design of `tool-door-and-prover`). `kit/core` and the game are bundled into them, as for the fixtures of that spec. The JSON import of `levels.json` is bundled by esbuild. If `npm run typecheck` rejects the JSON import, set `resolveJsonModule` in `apps/garden/tsconfig.json`.

## Components and Interfaces

All state types are `type` aliases, not `interface`. An interface has no index signature, so TypeScript does not accept it where `GameDef<S extends Json, A>` needs `Json`.

```ts
export type Moth = { id: number; x: number; y: number; home: boolean; caught: boolean };
export type GardenState = {
  level: string;
  w: number; h: number;
  cells: string[];      // rows with '.', '#', 'w', 'f' and '1' to '5'. A moth start cell is stored as '.'.
  moths: Moth[];        // ascending id
  lit: number;          // 0 means no lantern is lit
  turn: number;
  maxTurns: number;
};
export type GardenAction = { kind: 'light'; id: number } | { kind: 'wait' };
export type RawLevel = { id: string; title: string; maxTurns: number; rows: string[] };
export function parseLevel(raw: RawLevel): { ok: true; state: GardenState } | { ok: false; problems: string[] };
export function makeGardenDef(levels: RawLevel[]): GameDef<GardenState, GardenAction>;
```

The definition: `id` `garden`, `kind` `turn`, `rulesVersion` `1`, `title` from `game.config.ts`, `levels()` gives `{ id, title }` for each level in file order. `init(levelId, seed)` ignores the seed. The default export of `def.ts` is `makeGardenDef` applied to `levels.json`. `makeGardenDef` exists so that tests and the proof tests can build a definition from the fixture levels.

`x` counts columns from 0 at the left. `y` counts rows from 0 at the top. "Up" is `y - 1`.

Actions: while the phase is `playing`, `light:k` for each lantern id k of the level with k not equal to `lit`, ascending, then `wait` when `lit` is not 0. In phase `won` or `lost` the list is empty. Phase comes from `status`.

`decodeAction` accepts exactly the texts `light:1` to `light:5` and `wait` (the pattern `^light:[1-5]$` and the text `wait`) and gives null for anything else.

Step, in order. `step` never changes its input and returns a new object.

0. If the action is not in `actions(state)`, return a copy of the state and stop. This covers `light:k` for the lit lantern, `light:k` for an id the level does not have, `wait` with no lantern lit, and every action after the end. The determinism rule and conformance property 3 need this.
1. If the action is `light:k`, set `lit` to k.
2. Find the cell of lantern `lit`. Compute `dist` for every cell that is not `#` with a breadth first search from that cell. Webs and flowers can be walked over.
3. For each moth in ascending id that is not home and not caught:
   - Let `d` be `dist` at the moth's cell. If `d` is 0 or the cell has no path, the moth stays.
   - Look at the neighbours in the order up, right, down, left. Take the first one that is on the board, is not `#`, and has `dist` equal to `d - 1`.
   - If another moth that is not home and not caught stands there now, the moth stays.
   - Otherwise move the moth. If the cell is `w`, set `caught`. If the cell is `f` and no home moth stands on it, set `home`.
4. Add 1 to `turn`.

A moth that moved earlier in the same turn counts at its new cell. A moth that has not moved yet counts at its old cell.

Status: a caught moth gives `lost` with reason `web`. Otherwise all moths home gives `won`. Otherwise `turn` at or above `maxTurns` gives `lost` with reason `turns`. Otherwise `playing`. The score is `turn`.

Observation: the text map shows, for each cell, `m` when a moth that is not home stands there, else `F` when a home moth stands there, else `*` for the lit lantern, else the cell's own character. The summary is `Turn <turn> of <maxTurns>. ` then `Lantern <lit> is lit.` or `No lantern is lit.`, then ` <n> of <total> moths home.`. The legend lists `#`, `.`, `w`, `f`, `F`, `*`, `m` and the digits `1` to `5` that the level uses. `flowersFree` is the number of `f` cells with no home moth.

### Scene

```ts
export function boardLayout(state: GardenState, viewport: Viewport): { cell: number; left: number; top: number };
```

- `availW = width - safe.left - safe.right`. `availH = height - safe.top - 56 - safe.bottom`.
- `cell = max(1, floor(min(availW / w, availH / h)))`.
- `left = safe.left + floor((availW - cell * w) / 2)`. `top = safe.top + 56 + floor((availH - cell * h) / 2)`.
- The bar covers `y` from `safe.top` to `safe.top + 56`. No `world` or `actors` item starts above `safe.top + 56`.
- On 360 by 640 with side safe areas of at most 36 px, a 9 wide level gets `cell` 32 or more. The 360 px width is the limit, not the height.
- `boardLayout` is a pure function so that the shell spec can map a tap to a cell.

Items and ids. The ids never contain the turn number.

| Thing | Kind | Layer | Id | Sprite name |
| --- | --- | --- | --- | --- |
| hedge | sprite | world | `hedge-<x>-<y>` | `hedge` |
| web | sprite | world | `web-<x>-<y>` | `web` |
| flower | sprite | world | `flower-<x>-<y>` | `flower` |
| lantern | sprite | world | `lantern-<id>` | `lantern`, or `lantern_lit` when lit |
| moth | sprite | actors | `moth-<id>` | `moth`, `moth_home` or `moth_caught` |
| glow | circle | fx | `glow` | none. It is centred on the lit lantern, radius `1.5 * cell`, fill `#ffffff`, opacity 0.35 |
| turn counter | text | hud | `hud-turn` | none. Text `Turn <turn> of <maxTurns>`, size 24, fill `#ffffff`, centred at `width / 2`, `y = safe.top + 36` |

Each sprite item is `cell` wide and `cell` high. Sprite art and the sprite map belong to the shell spec. Until then `paintSvg` draws a grey rounded rectangle with the sprite name.

## Data Models

Level checks in `proof.ts`. A check applies by the level's plan (below), and `levelChecks` reports only the checks that apply.

| Check | Applies to | Passes when |
| --- | --- | --- |
| `size_ok` | all | width at most 9, height at most 7, 1 to 4 lanterns, moth count equal to the plan's moth count, flowers at least as many as moths |
| `length_in_band` | all with a band | the shortest solution length is inside the plan's band |
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

```ts
export interface CheckResult { name: string; passed: boolean; detail: string }
export type ProofTools = { solveTurn: typeof solveTurn; solveTick: typeof solveTick };
export interface CheckPlan { moths: number; band: [number, number] | null; needsSwitch: boolean; webMatters: boolean }
export const levelPlans: Record<string, CheckPlan>; // g01 to g12, from the two tables above
export const turnOptions: TurnOptions;
export function runChecks(def: GameDef<Json, unknown>, levelId: string, result: SolveResult, tools: ProofTools, plan: CheckPlan): CheckResult[];
export function levelChecks(def: GameDef<Json, unknown>, levelId: string, result: SolveResult, tools: ProofTools): CheckResult[];
```

`@kit/solver` exports `solveTurn`, `solveTick`, `TurnOptions` and `SolveResult` only. It does not export `CheckResult` or `ProofTools`, so `proof.ts` declares them with the same shape as in `kit/solver/src/prove.ts`. `proof.ts` imports types from `@kit/solver` with `import type` and calls the search only through `tools`. `levelChecks` finds the plan in `levelPlans` by the level id and calls `runChecks`. For an id without a plan it returns one failed check. When `result.solved` is false it returns one failed check named `length_in_band`. `runChecks` takes the plan as an argument so that tests can run it on fixture levels that are not shipped. `needs_switch` runs `tools.solveTurn(def, levelId, 1, { ...turnOptions, allow })`.

`turnOptions` for the prover: `key` returns `{ lit, moths }` without `turn`, and `maxDepth` is 40. Dropping `turn` is safe because the search visits states in order of depth, so the first visit of a board has the fewest turns, and reaching the same board in more turns is never better. A level's `maxTurns` has to be large enough for the search to find the solution. The helper therefore searches with `maxTurns` 99 and writes the final `maxTurns` after it knows the length.

## Error Handling

- `parseLevel` returns problems. It never throws.
- `def.init` throws a plain `Error` that names the level and its problems when a level has problems. `KitErrorCode` in `kit/core` has no `bad_def` code and this spec does not change `kit/core`. A unit test parses every shipped level, so this cannot reach a player.
- `decodeAction` returns null for unknown text.
- `step` returns a copy of the state for an action that is not listed.

## Testing Strategy

Tests are written first and seen to fail. Four fixture levels and one board for the tie test live in `apps/garden/src/rules/fixtures.ts`.

| Fixture | Rows | maxTurns | Actions | Expected |
| --- | --- | --- | --- | --- |
| A, straight | `m.f.1` | 4 | `light:1`, `wait` | Moth 1 is at x 1 after the first action and home at x 2 after the second. Phase `won`, turn 2. `solveTurn` gives length 2. |
| B, web | `m.wf1` | 4 | `light:1`, `wait` | The distances to the lantern are 4, 3, 2, 1 for x 0 to 3. Moth 1 is at x 1 after the first action and caught at x 2 after the second. Phase `lost`, reason `web`, turn 2. `solveTurn` returns `exhausted`. |
| C, queue | `mm.f.f.1` | 8 | `light:1`, then `wait` five times | After action 1, moth 1 is still at x 0 and moth 2 is at x 2. After action 2, moth 1 is at x 1 and moth 2 is home at x 3. After action 3, moth 1 is at x 2. After action 4, moth 1 stands at x 3 and is not home. After action 5, moth 1 is at x 4. After action 6, moth 1 is home at x 5. Phase `won`, turn 6. |
| D, switch | `1..f.`, `m.w.2`, `.....` | 8 | `light:1`, `light:2`, `wait`, `wait` | Moth 1 starts at x 0, y 1. After action 1 it is at x 0, y 0, on lantern 1. After action 2 it is at x 1, y 0. After action 3 it is at x 2, y 0. After action 4 it is home at x 3, y 0. Phase `won`, turn 4. `solveTurn` gives exactly these four actions and length 4, and no list is shorter because the flower is 4 cells from the moth. |

Fixture D by hand. With only lantern 2 lit, the moth walks along row 1: `light:2` moves it to x 1, `wait` moves it to the web at x 2 and it is caught, so the level is lost with reason `web` after 2 actions. With only lantern 1 lit, the moth moves onto lantern 1 and stays there, so it never reaches the flower and the level is lost by turns. So `needs_switch` passes for both lanterns, and `web_matters` passes for lantern 2. At the moth on y 0, x 0 with lantern 2 lit, the distance is 5. The neighbours right (x 1) and down (x 0, y 1) both have distance 4, and right comes first.

More tests:

- Tie order, right before down: the board `m..`, `..1`, `..f` with `maxTurns` 8. The lantern is at x 2, y 1 and the moth at x 0, y 0, so its distance is 3. After `light:1` the moth is at x 1, y 0, because up is off the board and right (distance 2) comes before down (distance 2).
- Tie order, up first: the board `.1.`, `...`, `.mf` with `maxTurns` 8. The lantern is at x 1, y 0 and the moth at x 1, y 2, so its distance is 2. After `light:1` the moth is at x 1, y 1, because up has distance 1 and is taken first.
- Turn limit: fixture A with `maxTurns` 1 is lost with reason `turns` after one action.
- Unlisted actions: `light:1` when lantern 1 is lit, `wait` before any lantern is lit, `light:3` on fixture A, and any text after the end each return a state with the same hash as the input.
- Decode: `light:0`, `light:6`, `light:01`, `Light:1`, `wait ` and the empty text give null. `light:1` to `light:5` and `wait` round trip.
- A second, slow reference `step` written inside the test file (it recomputes distances with a different search) must agree with `step` on 300 runs over fixtures A to D, and after the levels task also over every shipped level. The run picks come from fast-check or from `randomInt` with a fixed seed.
- Each shipped level parses with no problem.
- Proof tests: `runChecks` with a plan for fixture A (`moths` 1, `band` [2, 2], `needsSwitch` true) passes `size_ok` and fails `needs_switch`. Fixture B is not solved by `solveTurn` with `turnOptions`. Fixture D with a plan (`moths` 1, `band` [4, 4], `needsSwitch` true, `webMatters` true) passes every check, and its `maxTurns` 8 equals 4 plus 4.
- Scene: item counts as in requirement 7.1, no repeated id, ids equal across one turn, cell at least 32 on 360 by 640, and no `world` or `actors` item above `safe.top + 56`.

## Correctness Properties

1. **Moths are kept.** The number of moths never changes, and ids stay 1 to n. (Requirement 9.2)
2. **No moth in a hedge.** After any action, no moth stands on `#`. (3.3)
3. **Home is final.** Once `home` is true, the moth's x and y never change. (4.1)
4. **One turn for each action.** `turn` rises by exactly 1 for each accepted action. (3.5)
5. **Closer or still.** After a turn, each moth that is not home is at a distance to the lantern that is lit after the action that is one less than before, or it has not moved. Both distances are measured to that lantern. (3.3, 3.4)
6. **Proof replays win.** Every replay in `proofs/garden/` ends with phase `won` under the current rules. (8.3)
7. **Unlisted actions change nothing.** For any state and any decoded action that is not in `actions(state)`, `step` returns a state with the same hash. (2.4)

## Decisions and Alternatives

- One lit lantern at a time. Chosen because the player has at most five choices (four lanterns to light and `wait`) and can predict a turn. Two lit lanterns made the nearest light rule hard to see.
- Webs are on the path, not walls. Chosen so that the direct route is tempting and wrong.
- Par comes from the proof. The rules do not know par. The shell reads it from `proofs/garden/index.json`, which exists because the definition's id is `garden`.
- `size_ok` allows 1 to 4 lanterns in shipped levels, while `parseLevel` accepts the ids 1 to 5. The fifth id is kept for a later level pack.

## Out of Scope

- Animation, sound, art, the theme and the tutorial screen. They belong to the shell spec.
- Input: the function that turns a tap or a key into `light:<k>` or `wait`, which `mountGame` takes as `input.toAction`, and the control lessons that the shell shows. The shell spec asks the game for both (its requirements 3.1 and 5.1), but no spec writes them for the garden puzzle yet. The owner has to assign them. `boardLayout` is there so that the tap mapping can use it.
- Random level generation at run time. Levels are fixed files.
- A level editor for players.
