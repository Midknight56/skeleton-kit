---
name: play-and-prove
description: Use when you are asked to play a level of a game built on Skeleton Kit, check that a level can be won, or report a replay, a status or a state hash, with the tools new_game, act, observe, render and replay.
---

# Play a level, then say what happened

Use this when you play, test or check a level of a game built on the kit, or when you write or change a rule of such a game and need to see the effect.

## Play

1. Call `new_game` with no level to read the level ids. Then call `new_game` with a level id and a seed. The answer holds a session id, the state and the list of legal actions.
2. Send only actions from the legal list. Copy each action text exactly. Call `act` with a list of action texts. `text*n` repeats one action n times, with n from 2 to 3600. An action that is not legal is refused, and the run stops there.
3. Call `observe` to read the status, the hash and the new legal list before you choose more actions. Call `render` when you need to see the board.
4. Stop when the phase is `won` or `lost`. If it is `lost`, start the level again and say so. Do not hide a lost run.

## Before you call a level fine

Play it to a won status in this session. Reading the rules or the code is not a play. Say the level id, the seed, the actions you sent, the final status and the state hash, all copied from the tool answers.

## A replay is a seed plus actions

Call `replay` with a session id to get the replay of what you played. It holds the game id, the rules version, the level id, the seed, the action texts, the final hash and the final phase. The same replay always ends in the same state. Add `save: true` only when you are asked to keep a replay file. Call `replay` with a replay object to run a replay and read its result.

## What you must not do

- Never edit a file in `proofs/` by hand. Run `npm run prove`. It is the only thing that writes there.
- The kit holds no word of a game. A game word in `kit/` is a fault. Report it. Do not add one.
- Do not invent a hash, a status or an action. If a tool is not available, say that, and do not describe another command as a tool call.

## What a proof means

A proof file shows that a level can be finished under the rules in this repository. A proof is not a claim about fun or safety, and not a claim about how hard a level is for people.
