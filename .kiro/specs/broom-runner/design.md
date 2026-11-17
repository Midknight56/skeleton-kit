# Design Document

## Overview

`apps/runner` holds one tick game built on `kit/core`. The whole motion model is integer arithmetic, so the same actions give the same hash on every machine. The state at one tick is small and many jump timings reach the same state, so `solveTick` can explore every reachable state of a course. The app follows the pattern of `apps/garden`: a bundled `dist/def.js` and `dist/proof.js` for the prover and the tool door.

## Architecture

```
apps/runner/package.json            name @app/runner, depends on @kit/core, @kit/solver, @kit/conformance, esbuild 0.28.2 (dev)
apps/runner/tsconfig.json           extends the root file, like apps/garden
apps/runner/build.mjs               bundles src/def.ts to dist/def.js and src/proof.ts to dist/proof.js
apps/runner/game.config.ts          display title only. The theme import is added by the shell-and-site spec
apps/runner/src/def.ts              makeRunnerDef(courses), and the default export built from courses.json. kind 'tick', ticksPerSecond 60, id 'runner', rulesVersion '1'
apps/runner/src/rules/constants.ts  the constants from requirement 1
apps/runner/src/rules/course.ts     parseCourse
apps/runner/src/rules/state.ts      RunnerState, initState
apps/runner/src/rules/step.ts       actions, step, status, encodeAction, decodeAction
apps/runner/src/rules/observe.ts    observe
apps/runner/src/rules/fixtures.ts   fixture courses for the tests
apps/runner/src/view/scene.ts       runnerLayout, view
apps/runner/src/levels/courses.json
apps/runner/src/proof.ts            levelPlans, runChecks, levelChecks
apps/runner/tests/replays/          replays found by play
```

## Components and Interfaces

```ts
export const TPS = 60, TILE = 512, RUN = 44, GRAVITY = 9, JUMP = 150, BOX_W = 320, BOX_H = 448;

export interface RawCourse { id: string; title: string; air2: string; air1: string; ground: string }
export function parseCourse(raw: RawCourse): { ok: true; state: RunnerState } | { ok: false; problems: string[] };
export function initState(course: RawCourse): RunnerState;   // the start state of requirement 1.4

export interface RunnerState {
  level: string;
  air2: string; air1: string; ground: string;   // the course rows, never changed
  tick: number;
  x: number;          // left edge of the player's box
  feetY: number;      // 0 on the ground, negative in the air
  vy: number;         // negative is upward
  onGround: boolean;
  candles: number[];  // column indexes of candles not yet taken, air1 as c, air2 as c + 1000, in ascending order
  score: number;
  phase: 'playing' | 'won' | 'lost';
  reason: '' | 'hit' | 'fell';
}
export type RunnerAction = 'none' | 'jump';
```

- `actions(state)` returns `[]` unless the phase is `playing`, `['none', 'jump']` on the ground, and `['none']` in the air.
- `status(state)` gives `{ phase, score }`, and adds `reason` only when the phase is `lost`.
- `encodeAction` and `decodeAction` use the texts `none` and `jump`. `decodeAction` returns null for any other text.
- `makeRunnerDef(courses: RawCourse[])` builds the definition like `makeGardenDef`. Tests and proof tests give it their own courses.
- The gate column is the last column, `ground.length - 1`. The tile under the centre of the box is `floor((x + 160) / 512)`.

One tick, in this exact order. The function copies `candles` and never changes its input.

0. If the phase is not `playing`, or the action is not in `actions(state)`: return the state unchanged. Nothing else runs, not even step 7.
1. If the action is `jump`: set `vy` to minus `JUMP` and `onGround` to false.
2. Add `RUN` to `x`.
3. If `onGround` is false: add `GRAVITY` to `vy`, then add `vy` to `feetY`. If `feetY` is now 0 or more: set `feetY` to 0, `vy` to 0 and `onGround` to true.
4. If `onGround` is true and the tile under the box centre is a gap: set phase `lost`, reason `fell`.
5. If the phase is still `playing` and the player's box overlaps a pumpkin or a post: set phase `lost`, reason `hit`. The columns to test are `floor(x / 512)` to `floor((x + 319) / 512)`.
6. If the phase is still `playing`: take every candle whose box overlaps the player's box, 10 points each. Then, if `x` is at or past `gateColumn * TILE`: set phase `won` and add 100.
7. Add 1 to `tick`.

Boxes, with y growing downward and the ground surface at 0:

| Thing | left | right | top | bottom |
| --- | --- | --- | --- | --- |
| Player | `x` | `x + 320` | `feetY - 448` | `feetY` |
| Pumpkin in column c | `c * 512` | `c * 512 + 512` | `-512` | `0` |
| Post in column c | `c * 512` | `c * 512 + 512` | `-640` | `0` |
| Candle in `air1`, column c | `c * 512 + 128` | `c * 512 + 384` | `-896` | `-640` |
| Candle in `air2`, column c | `c * 512 + 128` | `c * 512 + 384` | `-1408` | `-1152` |

Two boxes overlap when `a.left < b.right` and `a.right > b.left` and `a.top < b.bottom` and `a.bottom > b.top`.

Jump shape, for the numbers in the tests. In the k-th tick after a jump from the ground, `vy` is `-150 + 9k` and `feetY` is `-150k + 9k(k+1)/2`. So `feetY` is -141 at k 1, -1176 at k 16, -1173 at k 17, -48 at k 32, and 99 at k 33, which lands the player with `feetY` 0.

Observation. `observe` follows requirement 5. The text map uses the characters `_` ground, `:` gap, `p` pumpkin, `P` post, `G` gate, `c` candle, `.` empty air and a space for a column past the end, and its legend names each of them once.

Scene. Pure, and the shell can use `runnerLayout`. For a viewport with `availW = width - safe.left - safe.right` and `bar = 56`:

- `tile = max(1, floor(availW / 15))` px, `s = tile / 512` px a unit.
- `playerLeft = safe.left + floor(availW / 4)`. The player item is `x = playerLeft`, `w = 320 * s`, `h = 448 * s`, and its bottom sits at `groundY + feetY * s`.
- `groundY = safe.top + bar + floor((height - safe.top - bar - safe.bottom) * 3 / 4)`.
- A column c has its left edge at `playerLeft + (c * 512 - state.x) * s`.
- The view makes items only for columns that are at least partly inside the scene. Item ids are `player`, `ground-<c>`, `pumpkin-<c>`, `post-<c>`, `gate-<c>`, `candle-<c>-<1 or 2>` and `hud-score`, so no id repeats. The score text is in the `hud` layer inside the bar. The top of the highest player position is 1624 units above `groundY`, which is 3.2 tiles, and that stays below the bar on every viewport used in the tests.
- On 360 by 640: `tile` 24, `s` 0.046875, `playerLeft` 90, the player is 15 by 21 px with its right edge at 105, `groundY` 494. Columns 1 to 10 at tick 0 have their left edge at 114 to 330 and end at or before 354, so 10 whole tiles are ahead, and column 11 is partly inside.

## Data Models

Level checks in `proof.ts`. An obstacle is a longest run of neighbouring `ground` columns that are not `_` and not `G`. Its left edge is `L` and its right edge `R`.

`levelPlans` maps each course id to its plan: `{ length, obstacles, minWindow }`. The values are `r01` 60, 3, 9; `r02` 80, 5, 9; `r03` 100, 7, 6; `r04` 120, 9, 6; `r05` 140, 11, 4; `r06` 160, 13, 4. `runChecks(def, levelId, solved, tools, plan)` runs the checks for any plan, so tests can use their own courses. `levelChecks` takes the plan from `levelPlans`, and reports a failed `length_ok` for an id that has none. The prover calls `levelChecks` only for a solved level, so `finishable` always passes there, and `runChecks` reports it for the tests.

| Check | Passes when |
| --- | --- |
| `length_ok` | the course has the length of its plan, and the number of obstacles of its plan |
| `finishable` | `solveTick` returned `solved` true |
| `spacing_ok` | at least 4 plain ground columns lie between two obstacles, and between the last obstacle and the gate |
| `window_ok` | every obstacle has a jump window of at least `minWindow` ticks, and the good ticks are consecutive |

Jump window of an obstacle. Replay `solved.actions` and take the first state with `onGround` true, phase `playing`, and `x` at or past the right edge of the obstacle before it (0 for the first obstacle). Call it `S0`. The candidates are `S0` and every state that follows from it by `none` while the phase is `playing` and the player is on the ground. For each candidate: apply `jump`, then `none` until the player is on the ground with `x` at or past `R`, or the phase is not `playing`, then 10 more `none` while the phase is `playing`. The candidate is good when the phase at the end is `playing` or `won`. The window is the count of good candidates. If the good candidates are not consecutive, the check fails with the detail `window is split`. The count ends in a loss when the player walks into the obstacle, so a late candidate is bad, and a jump that lands before the obstacle is bad because the walk after the landing reaches it.

Windows by hand, for a lone obstacle at column 10 (`L` 5120), jump taken from the state at tick t (so `x` is 44t before the jump):

| Obstacle | Good ticks t | Window | Why |
| --- | --- | --- | --- |
| Pumpkin | 99 to 105 | 7 | feet must be at or above -512 while the box touches it: ticks 5 to 28 after the jump. Needs `x` of at most `L - 496` and at least `L - 764`, which is 4356 to 4624. |
| Post | 100 to 104 | 5 | feet at or above -640: ticks 6 to 27. Needs `x` from `L - 720` to `L - 540`, which is 4400 to 4580. |
| Gap of 1 | 92 to 112 | 21 | the landing centre must be at or past `L + 512`, so `x + 1612 >= 5632`. The centre must still be before the gap: `x + 160 < 5120`. |
| Gap of 2 | 103 to 112 | 10 | the landing centre must be at or past `L + 1024`, so `x + 1612 >= 6144`. |

Over every position of `L` on the 44 unit step, the least windows are: pumpkin 6, post 4, gap of 1 column 21, gap of 2 columns 9. The width of the good interval is 268, 180, 939 and 427 units, divided by 44. This is why the required windows are 9, 6 and 4: a pumpkin never has a window of 9, so `r01` and `r02` use gaps only, `r03` and `r04` may add pumpkins, and `r05` and `r06` may add posts. The earlier spec asked for 12, 9 and 6 with a post of 1024 units, and that cannot be met, because the travel in the air while clear of a post of 1024 units is 484 units and the box needs 832.

## Error Handling

- `parseCourse` returns problems. It never throws.
- `decodeAction` returns null for any text other than `none` and `jump`.
- `def.init` throws an `Error` with the course problems in the text for a course that has problems, like `makeGardenDef`. `KitError` has no code for this, and the kit may not change in this spec. An unknown level is refused by `createSession` before `init`. A unit test parses every shipped course.

## Testing Strategy

Tests are written first and seen to fail. Fixture courses live in `apps/runner/src/rules/fixtures.ts`. In each fixture both air rows are all `.`, except where it says so. Every ground row has 40 columns.

| Fixture | `ground` row | Actions | Expected |
| --- | --- | --- | --- |
| A, flat | 39 times `_`, then `G` | `none*454` | The gate column is 39, so the gate edge is at 19968 units. Phase `won` and score 100 after 454 ticks. Phase `playing` after 453 ticks. See the note below. |
| B, pumpkin | `_` in columns 0 to 9, `p` in column 10, `_` in columns 11 to 38, `G` in column 39 | `none*110` | Phase `lost`, reason `hit`, at tick 110. After 109 ticks the right edge is at 5116 units, which does not pass the pumpkin's left edge at 5120. After 110 ticks it is at 5160. |
| C, free jump | fixture A | `jump`, then `none*40` | `feetY` is -141 after the first tick, -1176 after tick 16, -48 after tick 32, and 0 with `onGround` true after tick 33. `x` is 1452 after tick 33 and 1804 at the end. The score stays 0. |
| D, candles | fixture A, with `c` in column 10 of `air1` and `c` in column 10 of `air2` (two separate runs, one candle each) | `none*110`, `jump`, then `none*5` | See the candle tests below. |
| E, gap | `_` in columns 0 to 9, `.` in column 10, `_` in columns 11 to 38, `G` | none | used for the gap test and the window test |
| F, wide gap | `_` in columns 0 to 9, `.` in columns 10 and 11, `_` in columns 12 to 38, `G` | none | used for the window test |
| G, post | fixture B with `P` in column 10 | none | used for the window test |

Note for fixture A: do not copy an expected tick from this table. The test computes the winning tick as the smallest n with `44 * n >= 39 * 512`, which is 454, and expects phase `won` and score 100 after `none*454` and phase `playing` after `none*453`.

More tests:

- Gap, on fixture E: with no jump the run is lost with reason `fell` at tick 113. After 112 ticks `x` is 4928 and `floor((x + 160) / 512)` is 9. After 113 ticks `x` is 4972 and it is 10.
- Candle in `air1` (fixture D, first run): after `none*110` and `jump` the box is at `x` 4884 at tick 111, 4928 at tick 112 (right edge 5248, not past the candle's left edge 5248) and 4972 at tick 113 with `feetY` -396, so the candle is taken at tick 113. After 112 ticks the score is 0 and `candles` is `[10]`. After 113 ticks the score is 10 and `candles` is `[]`. With no jump the candle stays and the score stays 0.
- Candle in `air2` (fixture D, second run): the box reaches it at tick 116 with `feetY` -711, which is above -704. After 115 ticks (`feetY` -615) the score is 0 and `candles` is `[1010]`. After 116 ticks the score is 10 and `candles` is `[]`.
- Step with a refused action: `jump` while in the air gives a state with the same hash. Any action after `won` or `lost` gives the same hash. `actions` is `[]` after `won` and `lost`.
- Observation: fixture B at tick 0 gives `Tick 0. On the ground. Next: pumpkin in 110 ticks.`, with `startsInTicks` 110 and `tile` 0. After `none*20` it gives `Tick 20. On the ground. Next: pumpkin in 90 ticks.` Fixture A at tick 0 gives `Next: gate in 454 ticks`. Fixture C after 5 ticks gives `Tick 5. In the air. Next: gate in 449 ticks.` The text map of fixture B at tick 0 has 3 rows of 24 characters: 24 times `.`, 24 times `.`, and `_` ten times, `p`, `_` thirteen times.
- Window: the window from `proof.ts` for each of fixtures B, E, F and G equals the count from a brute force loop written inside the test that tries every jump tick with plain `step` calls. The test also checks the hand values of the table above: 7, 21, 10 and 5.
- Checks: a course with two obstacles that have 2 plain columns between them (pumpkins in columns 10 and 13) fails `spacing_ok`. A course with a 2 column gap in columns 10 and 11 and a post in column 12 is one obstacle of 3 columns, is `exhausted` for `solveTick`, and fails `finishable`.
- A second, slow reference `step` written inside the test with separate code for each rule must agree with `step` on 200 random runs.
- Each shipped course parses with no problem, has its id, length and obstacle count from `levelPlans`, and the first 6 columns are plain.
- Scene: `validateScene` reports no problem at 360 by 640, 1920 by 1080, 320 by 240 and 400 by 300, at tick 0 and at the tick of the last candle; the numbers of the scene paragraph above hold at 360 by 640; no `world` or `actors` item has a top above `safe.top + 56`; item ids do not repeat.

## Correctness Properties

1. **Constant speed.** After any accepted action, `x` equals `44 * tick`. A refused action changes nothing. (Requirements 1.1, 3.2, 3.4)
2. **Never under the ground.** After any tick, `feetY` is 0 or less. (3.2)
3. **Ground flag is honest.** `onGround` is true exactly when `feetY` is 0 and `vy` is 0. (3.1)
4. **Score never falls.** For any run, the score after a tick is at least the score before it. (4.4, 4.5)
5. **Jump shape.** From any grounded state with no obstacle, gap or gate within 4 tiles ahead of the box, `jump` then `none*32` lands the player on tick 33 after the jump at `feetY` 0, and `x` has grown by 1452. (3.3)
6. **Proof replays win.** Every replay in `proofs/runner/` ends with phase `won` under the current rules. (7.3)
7. **All numbers are integers.** After any tick, `x`, `feetY`, `vy`, `tick`, `score` and every candle index are integers. (1.2)
8. **Refused is unchanged.** For any state and any action that is not in `actions(state)`, `step` returns the same hash. (3.4)

## Decisions and Alternatives

- Integers in fixed point units over floating point numbers. Chosen because a replay must give the same hash in every browser and in Node.
- One jump height, no double jump, no hold. Chosen so that the only skill is timing and the fair window can be counted in ticks.
- A fixed course over an endless one. Chosen so that a course can be proven and replayed.
- The post is 640 units high, not 1024. With the fixed motion constants, a post of 1024 units cannot be cleared, so a course with one could not be finished. The other way out is a faster run speed or a higher jump, which would change requirement 3.3 and every fixture. That is the owner's choice.
- The fall into a gap is a state with `feetY` 0 and `onGround` true. Chosen so that properties 2 and 3 hold in every state, and the scene draws the fall from the reason.

## Out of Scope

- Animation frames, parallax, sound, art and input handling. They belong to the shell spec. The pause control belongs to the shell too.
- Course generation at run time, moving obstacles, and speed changes.
