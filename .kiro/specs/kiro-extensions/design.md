# Design Document

## Overview

The power is a folder that Kiro copies when it installs it. It holds no copy of the server. It starts the server file that the user's clone builds, so the clone has to be built first.

```text
power/skeleton-kit/
  plugin.json
  mcp.json
  README.md
  skills/play-and-prove/SKILL.md
```

## mcp.json

Kiro starts the server from its own copy of the power, so a relative path cannot work. The server entry is `node -e "<launcher>"`. The launcher reads `SKELETON_KIT_MCP_DIST` and `SKELETON_KIT_GAME`, prints a message on standard error and exits 1 when one is missing, and otherwise sets `process.argv` to `[node, dist, '--game', game]` and imports the server file. The `env` block of the entry passes both variables as `${SKELETON_KIT_MCP_DIST}` and `${SKELETON_KIT_GAME}`. The server resolves the `--game` value against its working directory, so the value has to be a full path.

## Tests

`tests/kiro/extensions.test.ts` reads files only. It reads the tool names from the `registerTool('<name>'` calls in `kit/mcp/src/server.ts`. The default vitest include pattern covers it, because the repository has no `test.include` setting.

## Proof

One headless session from a folder that holds no `.kiro` folder, with the power installed and the two variables set. The prompt names no tool. The session output is saved unedited in `docs/acceptance/power-session/session-output.txt`. The answer is checked against `proofs/garden/g01.json` and against a fresh run of the garden server. The power is uninstalled afterwards, and `~/.kiro/powers/installed.json` is read to confirm it holds no power.

## Limits

A proof of one session shows that this session reached a won status. It is not a claim about other prompts, other games or other machines.
