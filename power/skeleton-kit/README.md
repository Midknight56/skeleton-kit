# Skeleton Kit power

A Kiro power in the Agent Plugins format. It gives Kiro the five tools of the kit's tool door (`new_game`, `act`, `observe`, `render`, `replay`, from `kit/mcp/src/server.ts`) so Kiro can play a game built on the kit. It has one skill, `play-and-prove`. The skill holds the rules that matter to a player: play a level to a won status before calling it fine, send only legal actions, never edit `proofs/` by hand.

The power does not carry the server. It starts the server file that your clone of this repository builds.

## What it needs

- Node 24 or later.
- A clone of this repository, with `npm install`, `npm run build:kit` and `npm run build:apps` run once. That writes `kit/mcp/dist/server.js` and `apps/garden/dist/def.js`.
- Two environment variables, set in the shell where you run the install command and in the shell where you start Kiro:
  - `SKELETON_KIT_MCP_DIST`: the full path of `kit/mcp/dist/server.js` in your clone.
  - `SKELETON_KIT_GAME`: the full path of a game folder that holds `dist/def.js`, for example `apps/garden`.

Kiro copies an installed power to its own folder and starts its server there. A path relative to your clone would point nowhere, so the server file and the game folder come from the two variables. If one is missing, the server does not start. It prints a message on standard error and exits with code 1.

## Install

From the root of your clone, in PowerShell:

```powershell
npm install
npm run build:kit
npm run build:apps
$env:SKELETON_KIT_MCP_DIST = (Resolve-Path kit/mcp/dist/server.js).Path
$env:SKELETON_KIT_GAME = (Resolve-Path apps/garden).Path
kiro-cli powers install power/skeleton-kit
```

The next Kiro CLI session loads the power. It activates when you talk about playing a level, a replay, a state hash or a level proof.

## Use

Ask in plain words, for example: `Start level g01 with seed 1 and win it with legal actions only.` Tools from a power ask for approval. In a headless session, name the trusted tools: `--trust-tools="kiro_powers,@skeleton-kit"`.

The power plays one game at a time, the one that `SKELETON_KIT_GAME` names. To play another game, change the variable and start a new session.

## Uninstall

```powershell
kiro-cli powers uninstall skeleton-kit
```

Uninstall it when you are done. An installed power is loaded into every later session on the machine.

## Limits

A proof file shows that a level can be finished under the rules in the repository. A proof is not a claim about fun or safety. Where this power ran, and what was seen, is in `docs/acceptance/power-session/README.md`.
