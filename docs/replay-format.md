# Replay format

A replay is a small JSON file that records one play of one level. It is replay format 1. The kit can run it again and check that the game ends in the same place.

The type is `Replay` in `kit/core/src/types.ts`. A session makes one with `toReplay()` in `kit/core/src/session.ts`.

## Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | the number `1` | The version of this file layout. It is always 1. |
| `game` | text | The id of the game, such as `garden`. It must match the game's `id`. |
| `rulesVersion` | text | The rules version of the game when the replay was made. It must match the game's `rulesVersion`. |
| `level` | text | The id of the level that was played, such as `g01`. |
| `seed` | whole number | The seed for the random numbers. It must be from 0 to 2147483647. |
| `actions` | list of text | The actions played, in order. Each item is the action text. A repeated run is written as `text*count`. |
| `finalHash` | text | The hash of the game state after the last action. |
| `finalPhase` | `"playing"`, `"won"` or `"lost"` | The phase of the game after the last action. |

### Action text

Each action is the text made by the game's `encodeAction`. For example `light:1` or `wait`.

Equal actions in a row are packed into one item. Three `wait` actions in a row become `wait*3`. The count must be a whole number from 2 to 3600. A longer run is split into several items. The text before the `*` must not be empty and must not hold another `*`. The code for this is in `kit/core/src/rle.ts`.

## Example

This is the `replay` field of `proofs/garden/g01.json`.

```json
{
  "actions": [
    "light:1",
    "wait"
  ],
  "finalHash": "d836baac0f60ae09",
  "finalPhase": "won",
  "format": 1,
  "game": "garden",
  "level": "g01",
  "rulesVersion": "1",
  "seed": 1
}
```

The proof file around it also has the fields `checks`, `format`, `game`, `kind`, `level`, `rulesVersion`, `seed` and `stats`. Those belong to the proof file. Only the `replay` object is the replay.

## How to run a replay

### With runReplay in kit/core

`runReplay(def, replay)` is exported from `@kit/core`. It takes a game definition and a replay object. It plays the actions on a new session and compares the end. It never throws for bad data from a file. It returns a result.

```ts
import { runReplay } from '@kit/core';

const result = runReplay(def, replay);
if (result.ok) {
  console.log(result.finalHash, result.finalPhase);
} else {
  console.log(result.error, result.message, result.mismatchAt);
}
```

On success the result is `{ ok: true, finalHash, finalPhase }`.

On failure the result is `{ ok: false, error, message }`. It also has `mismatchAt` when an action failed. That is the index of the action in the list after the `*` runs are expanded.

The checks run in this order. The first one that fails gives the error.

| Error | Cause |
| --- | --- |
| `wrong_game` | `game` is not the game's id. |
| `rules_changed` | `rulesVersion` is not the game's rules version. |
| `unknown_level` | The game has no level with the id in `level`. |
| `bad_seed` | `seed` is not a whole number from 0 to 2147483647. |
| `bad_action_text` | `actions` is not a list of text, or an item is badly formed. |
| `illegal_action` | An action is not legal at that point. `mismatchAt` is set. |
| `game_over` | An action came after the game ended. `mismatchAt` is set. |
| `hash_mismatch` | The final hash is not `finalHash`. |
| `phase_mismatch` | The final phase is not `finalPhase`. |

### With the replay tool of the tool door in kit/mcp

The tool door is the server in `kit/mcp`. Its `replay` tool has two forms. Give `session` or `replay`, not both.

To run a replay, give a replay object in `replay`:

```json
{"replay":{"format":1,"game":"garden","rulesVersion":"1","level":"g01","seed":1,"actions":["light:1","wait"],"finalHash":"d836baac0f60ae09","finalPhase":"won"}}
```

The answer is the result of `runReplay`. For a good replay it is:

```json
{"ok":true,"finalHash":"d836baac0f60ae09","finalPhase":"won"}
```

A replay that fails answers with `ok` false and the `error`, `message` and `mismatchAt` fields described above. The tool itself answers with `bad_input` if `replay` is not an object, or if both or neither of `session` and `replay` are given.

To get a replay from a game in progress, give `session` instead. The tool returns `{"replay": {...}}`. Add `"save": true` to also write the file to `tests/replays/` in the game folder. The file is named `<game>-<level>-<finalHash>.json`.

See `docs/tool-door.md` for the other tools.
