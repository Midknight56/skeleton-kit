# Design Document

## Overview

`apps/runner` holds one tick game built on `kit/core`. The whole motion model is integer arithmetic, so the same actions give the same hash on every machine. The state at one tick is small, so `solveTick` can explore every reachable state.

## Architecture

```
apps/runner/game.config.ts         display title and theme import
apps/runner/src/def.ts             the GameDef, default export, kind 'tick', ticksPerSecond 60
apps/runner/src/rules/constants.ts the constants from requirement 1
apps/runner/src/rules/course.ts    parseCourse
apps/runner/src/rules/state.ts     RunnerState, init
apps/runner/src/rules/step.ts      actions, step, status, encode, decode
apps/runner/src/rules/observe.ts   observe
apps/runner/src/view/scene.ts      view
apps/runner/src/levels/courses.json
apps/runner/src/proof.ts           levelChecks for the prover
apps/runner/tests/replays/
```

## Components and Interfaces

```ts
export const TPS = 60, UNIT = 16, TILE = 512, RUN = 44, GRAVITY = 9, JUMP = 150, BOX_W = 320, BOX_H = 448;

export interface RunnerState {
  level: string;
  air2: string; air1: string; ground: string;   // the course rows, never changed
  tick: number;
  x: number;          // left edge of the player's box
  feetY: number;      // 0 on the ground, negative in the air
  vy: number;         // negative is upward
  onGround: boolean;
  candles: number[];  // column indexes of candles not yet taken, air1 as c, air2 as c + 1000
  score: number;
  phase: 'playing' | 'won' | 'lost';
  reason: '' | 'hit' | 'fell';
}
export type RunnerAction = 'none' | 'jump';
```

One tick, in this exact order:

1. If the action is `jump` and `onGround` is true: set `vy` to minus `JUMP` and `onGround` to false.
2. Add `RUN` to `x`.
3. If `onGround` is false: add `GRAVITY` to `vy`, then add `vy` to `feetY`. If `feetY` is now 0 or more: if the tile under the box centre (`x + 160`) is a gap, set phase `lost`, reason `fell`. Otherwise set `feetY` to 0, `vy` to 0 and `onGround` to true.
4. If `onGround` is true and the tile under the box centre is a gap: set phase `lost`, reason `fell`.
5. If the player's box overlaps a pumpkin or a post: set phase `lost`, reason `hit`.
6. If the phase is still `playing`: take every candle whose box overlaps the player's box, 10 points each. Then, if `x` is at or past `gateColumn * TILE`: set phase `won` and add 100.
7. Add 1 to `tick`.

Boxes, with y growing downward and the ground surface at 0:

| Thing | left | right | top | bottom |
| --- | --- | --- | --- | --- |
| Player | `x` | `x + 320` | `feetY - 448` | `feetY` |
| Pumpkin in column c | `c * 512` | `c * 512 + 512` | `-512` | `0` |
| Post in column c | `c * 512` | `c * 512 + 512` | `-1024` | `0` |
| Candle in `air1`, column c | `c * 512 + 128` | `c * 512 + 384` | `-896` | `-640` |
| Candle in `air2`, column c | `c * 512 + 128` | `c * 512 + 384` | `-1408` | `-1152` |

Two boxes overlap when `a.left < b.right` and `a.right > b.left` and `a.top < b.bottom` and `a.bottom > b.top`.

## Data Models

Level checks in `proof.ts`. An obstacle is a longest run of neighbouring `ground` columns that are not `_` and not `G`.

| Check | Passes when |
| --- | --- |
| `length_ok` | the course has the length listed for its id |
| `finishable` | `solveTick` returned `solved` true |
| `spacing_ok` | at least 4 plain ground columns lie between two obstacles, and between the last obstacle and the gate |
| `window_ok` | every obstacle has a jump window of at least the number of ticks listed for the course |

Jump window of an obstacle: take the grounded state at the tick when the player's right edge is 6 tiles before the obstacle's left edge, or the tick after landing from the obstacle before it, whichever is later. For each later tick t while the player is still on the ground before the obstacle: copy the state, apply `none` until tick t, apply `jump`, then apply `none` until the player is on the ground again and 10 more ticks. The tick t is good when the phase is still `playing` or is `won` at the end. The window is the count of good ticks. The good ticks must be consecutive. If they are not, the check fails with the detail `window is split`.

## Error Handling

- `parseCourse` returns problems. It never throws.
- `decodeAction` returns null for any text other than `none` and `jump`.
- `def.init` throws a `KitError` with code `bad_def` for a shipped course with problems. A unit test parses every shipped course.

## Testing Strategy

Tests are written first and seen to fail. Fixture courses live in `apps/runner/src/rules/fixtures.ts`. In each fixture both air rows are all `.`.

| Fixture | `ground` row | Actions | Expected |
| --- | --- | --- | --- |
| A, flat | 39 times `_`, then `G` (40 columns) | `none*454` | The gate column is 39, so the gate edge is at 19968 units. Phase `won` and score 100 after 454 ticks. Phase `playing` after 453 ticks. See the note below. |
| B, pumpkin | `_` in columns 0 to 9, `p` in column 10, `_` in columns 11 to 38, `G` in column 39 | `none*110` | Phase `lost`, reason `hit`, at tick 110. After 109 ticks the right edge is at 5116 units, which does not pass the pumpkin's left edge at 5120. After 110 ticks it is at 5160. |
| C, free jump | fixture A | `jump`, then `none*40` | `feetY` is -141 after the first tick, -1176 after tick 16, -48 after tick 32, and 0 with `onGround` true after tick 33. `x` is 1452 after tick 33. |

Note for fixture A: do not copy an expected tick from this table. The test computes the winning tick as the smallest n with `44 * n >= 39 * 512`, which is 454, and expects phase `won` and score 100 after `none*454` and phase `playing` after `none*453`.

More tests:

- Gap: a course with one `.` gap at column 10 and no jump is lost with reason `fell` at the first tick where `floor((x + 160) / 512)` equals 10.
- Candle: a jump timed so that the box passes through an `air1` candle adds exactly 10, and the candle is gone from `candles`.
- Window: the window from `proof.ts` for a lone pumpkin equals the count from a brute force loop written inside the test that tries every jump tick with plain `step` calls.
- A second, slow reference `step` written inside the test with separate code for each rule must agree with `step` on 200 random runs.
- Each shipped course parses with no problem.

## Correctness Properties

1. **Constant speed.** After any accepted action, `x` equals `44 * tick`. (Requirements 1.1, 3.2)
2. **Never under the ground.** After any tick, `feetY` is 0 or less. (3.2)
3. **Ground flag is honest.** `onGround` is true exactly when `feetY` is 0 and `vy` is 0. (3.1)
4. **Score never falls.** For any run, the score after a tick is at least the score before it. (4.4, 4.5)
5. **Jump shape.** From any grounded state with no obstacle within 4 tiles, `jump` then `none*32` lands the player on tick 33 at the same `feetY` of 0. (3.3)
6. **Proof replays win.** Every replay in `proofs/runner/` ends with phase `won` under the current rules. (7.3)

## Decisions and Alternatives

- Integers in fixed point units over floating point numbers. Chosen because a replay must give the same hash in every browser and in Node.
- One jump height, no double jump, no hold. Chosen so that the only skill is timing and the fair window can be counted in ticks.
- A fixed course over an endless one. Chosen so that a course can be proven and replayed.

## Out of Scope

- Animation frames, parallax, sound, art and input handling. They belong to the shell spec.
- Course generation at run time, moving obstacles, and speed changes.
