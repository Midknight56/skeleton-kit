# Power session: the skeleton-kit power in one headless Kiro CLI run

Date: 2026-11-20. Output of `kiro-cli --version`: `kiro-cli 3.5.0`.

The power is `power/skeleton-kit/`. This folder holds the saved output of one session (`session-output.txt`) and what was checked. It shows that this one session played a garden level to a won status through the power's tools. It is not a claim about other prompts, other games or other machines.

## Commands in order

All commands ran in PowerShell on Windows. Seconds were read from a stopwatch around each command. The two builds were not timed.

1. `npm run build:kit`. Output: the server and solver bundles were built (`built dist/server.js`, `built dist/prove.js`, `built dist/cli.js` and the fixtures). Exit code 0.
2. `npm run build:apps`. Output: `built dist/def.js` for `apps/garden` and `apps/runner`, and the proof and level finder files. Exit code 0.
3. In the repository root, in the same shell as step 4:
   ```powershell
   $env:SKELETON_KIT_MCP_DIST = (Resolve-Path kit/mcp/dist/server.js).Path
   $env:SKELETON_KIT_GAME = (Resolve-Path apps/garden).Path
   ```
   The shell held the full paths of this checkout. They are not written here.
4. `kiro-cli powers install power/skeleton-kit`. Output: `Installed power "skeleton-kit"`. Exit code 0. 0.5 seconds. `~/.kiro/powers/installed.json` was `{ "installedPowers": [] }` before and listed `skeleton-kit` after.
5. From the empty folder `D:/Projects/kiroween/skeleton-kit-logs/power-run/` (it holds no `.kiro` folder), with both variables set in that shell:
   ```powershell
   kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools="kiro_powers,@skeleton-kit" "Start level g01 of the game with seed 1, win it by sending legal actions only, and tell me the actions you sent, the final status and the state hash."
   ```
   Output: all of it is in `session-output.txt`. Exit code 0. 13.9 seconds.
6. `kiro-cli powers uninstall skeleton-kit`. Output: `Uninstalled power "skeleton-kit"`. Exit code 0. 0.2 seconds.

The prompt names no tool. The v3 engine loaded the power's tools, so the run with `--v2` that the task allowed as a fallback was not made.

## Tool calls seen

These lines of `session-output.txt` name a tool, in the order they appear:

```text
[tool] Kiro Powers
[tool] Tool Load
[tool] Tool Load
[tool] Tool Load
[tool] @skeleton-kit/skeleton-kit/new_game
[tool] @skeleton-kit/skeleton-kit/act
[tool] @skeleton-kit/skeleton-kit/act
```

Each tool line is followed by `status: Pending`, `status: InProgress` and `status: Completed`. The output shows no refused call, so the trusted tool names `kiro_powers` and `@skeleton-kit` were enough. It does not show whether Kiro read the skill `play-and-prove`. The output has no line for `observe`, `render` or `replay`.

## What the session answered

Level g01 with seed 1 was won with two actions, `light:1` and `wait`. The final phase was `won` with score 2, at turn 2 of 6. The state hash was `d836baac0f60ae09`. The session said it did not save a replay.

## How the answer was checked

Two checks, both made after the session:

- The file `proofs/garden/g01.json` (written by `npm run prove`, not by hand) holds the replay of level g01 with seed 1: actions `light:1` and `wait`, final phase `won`, final hash `d836baac0f60ae09`. It matches the answer.
- The same level was started with the `garden` server of `.kiro/settings/mcp.json` (the same tool door, started from the repository, not from the power). `new_game` with level g01 and seed 1 gave the legal actions `light:1` and `light:2`. `act` with `light:1` and `wait` applied 2 actions, stopped by nothing, and gave phase `won`, score 2 and hash `d836baac0f60ae09`. It matches the answer.

The check shows that the power's server and the repository's server give the same result for these actions. It does not show that Kiro chose the actions without a hint, because the shortest solution has two actions and the legal list had two entries.

## What did not work first

Nothing failed in the session, in the install or in the uninstall. One thing about the capture: the PowerShell command that saved the output wrapped the first line written on standard error as a `NativeCommandError` message. The first lines of `session-output.txt` show that wrapper (`kiro-cli : [INFO] [KRS] ...` and a `CategoryInfo` line). The session itself was not affected, and the file was not edited.

The server was not started with a variable missing during the session. The launcher test in `tests/kiro/extensions.test.ts` runs the launcher with each variable missing and sees exit code 1 and a message that names both variables.

## Uninstall

After the session, `kiro-cli powers uninstall skeleton-kit` was run so that the power is not loaded into unrelated sessions. No other power was uninstalled or touched. `~/.kiro/powers/installed.json` was read afterwards and held:

```json
{
  "installedPowers": []
}
```

So `installedPowers` is empty.

## Limits

- One session, one prompt, one game (the garden puzzle, level g01, seed 1).
- The level has a two action solution, so the session shows the tools work through the power. It does not show how well Kiro plays a harder level.
- The runner game and the `--v2` engine were not tried through the power.
- Only Kiro CLI 3.5.0 on one Windows machine was used. The Kiro IDE was not used.
- The output does not name the model.
