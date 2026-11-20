# Design Document

## Overview

`kit/solver/src/turn.ts` gets one new pure function next to `solveTurn`. `prove.ts` calls it for turn games and writes the result. Nothing else in the kit changes. The proof `format` stays 1 because a key is added and none is removed or renamed.

## Components and Interfaces

```ts
export interface FirstMoves { legal: number; winning: number }
export type FirstMovesResult =
  | { decided: true; firstMoves: FirstMoves }
  | { decided: false; reason: 'node_limit'; action: string };
export function countFirstMoves<S extends Json, A>(def: GameDef<S, A>, levelId: string, seed: number, options?: TurnOptions): FirstMovesResult;
```

- The function builds the start state with `def.init(levelId, seed)`, and lists the legal actions in the order of `def.actions`, filtered by `options.allow`.
- For each first action it computes the next state with `def.step` and runs the same breadth first loop as `solveTurn` from that state, with its own visited set, `maxDepth - 1` as the remaining depth and the full `maxNodes`. The loop is shared with `solveTurn` as one internal function, so there is one search and not two copies.
- A won state at depth 1 (the first action itself wins) counts as winning.
- With `maxDepth` 1, the next states are checked for `won` and nothing is expanded.
- No file is read. The function uses no clock and no random numbers, and goes through the actions in a fixed order, so the numbers are the same on every run.

`prove.ts` calls `countFirstMoves` only when `def.kind` is `turn`, with the same options it gave `solveTurn`. An undecided result is a failed level: it prints the game, the level and `first move <action> hit node_limit`, changes no file and exits 1.

## Data Models

Proof file, turn game (new part shown, other keys as before):

```json
"stats": { "actions": 2, "firstMoves": { "legal": 9, "winning": 9 }, "nodes": 512 }
```

Index file:

```json
{ "game": "sample-lights", "levels": [{ "actions": 2, "firstMoves": { "legal": 9, "winning": 9 }, "id": "l2" }] }
```

The numbers above only show the shape. The real numbers come from `npm run prove`. Tick game files and index items keep their current keys.

## Error Handling

- `node_limit` on a first action fails the level (requirement 1.4). The game maker raises `maxNodes` in `turnOptions` or sets a smaller `key`.
- A tick game passed to `countFirstMoves` throws a plain `Error` whose message starts with "countFirstMoves needs a turn game", and `prove.ts` never does this.

## Testing Strategy

All tests use the `kit/solver/test-fixtures` copy of `sample-lights`. The 3 by 3 press matrix is invertible, and each level has one press set that solves it. The expectations below follow from the facts in the `tool-door-and-prover` design.

- `maxDepth` equal to the shortest length makes the winning first moves exactly the presses of the solution: `l1` with `maxDepth` 1 gives legal 9, winning 1. `l2` with `maxDepth` 2 gives legal 9, winning 2. `l3` with `maxDepth` 3 gives legal 9, winning 3.
- `allow` that refuses every action gives legal 0, winning 0.
- `maxNodes` 10 on `l3` gives `decided` false with reason `node_limit`.
- A tick fixture (`sample-hop`) throws a plain `Error` whose message starts with "countFirstMoves needs a turn game".
- A prove run in a temporary folder gives `firstMoves` in the turn proofs and the index, and none in the tick proofs. Two runs give the same bytes.

## Correctness Properties

1. **Winning is bounded.** For every level and every `maxDepth` from 1 to 5, `winning` is at most `legal`, and `winning` is at least 1 when `solveTurn` solves the level with the same `maxDepth`. (Requirement 1.5)
2. **First move of the solution counts.** The first action of the `solveTurn` result is among the winning first moves. (1.1, 1.2)
3. **Repeatable.** Two calls with the same input give equal results. (2.4)

## Decisions and Alternatives

- One search for each first action over one search with a shared visited set. Chosen because a shared set hides states reached through other first moves and gives too small a number.
- A shared internal loop over a second copy of the search. Chosen so the count cannot drift from `solveTurn`.
- Undecided fails the level over a guessed number. Chosen because a wrong number in a proof file looks like a fact.

## Out of Scope

- Tick games, and any score of fun or difficulty.
- Showing the numbers in a game or in the tool door.
