# Observation: verify-on-stop in a headless Kiro CLI session

Result: fired. The `Stop` hook `verify-on-stop` of `.kiro/hooks/verify-on-stop.json` ran `npm run verify` at the end of one headless Kiro CLI 3.5.0 session (`kiro-cli --version` printed `kiro-cli 3.5.0`), model `auto`, harness V3.

Date: 20 Nov 2026. Files in `docs/acceptance/hook-verify-on-stop/`: `session-output.txt` (the session's output and the time it took), `hook-event.json` (the event line of the session record) and `process-poll.txt` (a list of the processes the check started).

## Command

From the repository root:

```powershell
kiro-cli chat --v3 --agent playtester --no-interactive --trust-workspace "Reply with the single word ready. Do not call any tool. If hook output reaches you after that, quote its first line and its last line exactly, and say which command it came from."
```

The agent is `playtester` (file reads and game tools, no write and no shell tool), so the session could not run `npm` itself. The prompt asks for one word and no tool call. A poll ran next to it in the background. Every 300 ms it listed each process whose command line named this repository and `verify`, `typecheck`, `vitest`, `eslint` or `tsc`, with the time it first saw it.

## What was seen

| Time (PC clock) | Event | Source |
| --- | --- | --- |
| 1:52:51 PM | The session started and got the prompt | session record, first line |
| 1:52:54 PM | `tsc --noEmit -p tsconfig.json` started | `process-poll.txt`, first line |
| 1:52:56 PM | `eslint .` started | `process-poll.txt` |
| 1:53:01 PM | `vitest run --passWithNoTests --testTimeout=20000` started, then its workers | `process-poll.txt` |
| 1:58:19 PM | The session record logged a `ContextualHookInvoked` event: name `verify-on-stop`, `hookActionType` `runCommand`, `status` `completed`, the same turn id as the session's turn | `hook-event.json` |

Those three commands are the first three steps of `npm run verify` in `package.json`. The session answered `ready` and the process ended with exit code 0 after 330 seconds. A one word answer takes about 10 seconds in a repository with no `Stop` hook (the power session of `docs/acceptance/power-session/README.md` took 13.9 seconds), so the other 5 minutes are the hook's run.

## Limits

- The text the hook printed did not reach the session's answer. The session answered `ready` and quoted nothing, so the exit code of the hook's `npm run verify` is not recorded here.
- The session record says the hook completed. It does not hold the command's output.
- `typecheck-on-save` (trigger `PostFileSave`) fires on a file save in the Kiro IDE. It is not part of this observation.
