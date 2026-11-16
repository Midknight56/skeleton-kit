---
inclusion: always
---
# Product

## What this repository is
A kit for small web games in which every game can also be played by a program. It holds the kit and two games built from it.

## Who it is for
Solo developers and small studios with nobody to test a build.

## What the kit gives a game maker
- One contract for a game: plain data state, a list of legal actions, a pure step function.
- A replay file: seed plus actions. The same replay always ends in the same state.
- Nine property tests that any game built on the kit must pass.
- A prover: a plain search that shows each level can be finished. It calls no AI model.
- A tool door: five MCP tools (`new_game`, `act`, `observe`, `render`, `replay`) so an AI coding tool can play the game it is writing.
- A complete game shell: title, level select, play, pause, results, settings, how to play, credits, watch mode.

## The two games
- `apps/garden`: a turn based puzzle. The player lights one lantern. Moths fly to the light. Each moth must reach a flower.
- `apps/runner`: a one button runner at 60 ticks a second. The player taps to jump and must reach the gate.

## Words
- Say "the kit", "the garden puzzle" and "the runner" in code comments and documents. Product names live only in `apps/*/game.config.ts`.
- Write plain short sentences. No sales words.

## Limits that always hold
- A shipped game calls no AI model and no paid service.
- No account, no login, no personal data.
- Every asset in the repository is original work made for it.
- The version stays below 1.0.
