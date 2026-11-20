# Kiro IDE session, 20 November 2026

Kiro IDE 1.4.154 (`kiro.exe --help` printed `Kiro 1.4.154`) opened on a copy of this repository (`skeleton-kit-ide`, a git worktree of the same repository), with the spec `.kiro/specs/garland-text/`. One spec task was started from the `Start task` link of `tasks.md`, then one request was made in a new chat session. Facts below come from the screen (screenshots in this folder), from the process list and from the IDE's own chat rows.

| Step | What was seen | File |
| --- | --- | --- |
| Window | The IDE window sat on the side display: left=-1998, top=40, right=-92, bottom=1092 (`window-list.txt`). The window guard (`window-guard.log`) had nothing to move, because the IDE opened at that place by itself. | `window-list.txt`, `window-guard.log` |
| Restricted Mode | The folder opened in Restricted Mode. The folder was trusted from the Workspace Trust page (the four other project folders of this machine were already listed there). | none saved |
| Spec task | `tasks.md` shows a `Start task` link above each task. Task 1 was started. The IDE ran it in the sub-agent `spec-task-execution`, asked for approval before each shell command (`Allow`, `Always allow`, `Deny`) and every command was a read, a test run or a type check. Task 1 ended ticked: the new test failed for the sizes 10 and 11, then passed after `L(10, 13)` became `L(12, 13)` and `L(11, 14)` became `L(12, 14)` in `kit/shell/src/look.ts`. The IDE showed 2.13 credits and 1 minute 36 seconds for the task. | `01-tasks-start-task-links.jpg`, `02-task-1-queued.jpg`, `03-task-1-completed.jpg` |
| Hooks switched off at start | The Agent Hooks panel listed `protect-proofs`, `typecheck-on-save` and `verify-on-stop`, each labelled `(disabled)`. The eye icon beside `typecheck-on-save` wrote `"enabled": true` into `.kiro/hooks/typecheck-on-save.json`. During task 1 the hook did not show in the chat, because the window had not been reloaded yet. After `Developer: Reload Window` the three hooks carried no `(disabled)` label, and the panel listed the three MCP servers `garden`, `runner` and `sample`, each `Connected (5 tools)`. | `04-hooks-panel-after-reload-three-mcp-servers.jpg` |
| Save by the agent in a new chat session | The request was: add one comment line above the first `[data-garland]` rule of `kit/shell/src/look.ts` and save the file. The chat showed `Running 2 tools, 2 hooks triggered` with the rows `Run Command Hook protect-proofs` and `Run Command Hook typecheck-on-save`. The process list shows `cmd.exe /d /s /c "npm run typecheck"` started at 4:29:29 PM with the parent `Kiro.exe`, then `tsc --noEmit -p tsconfig.json` at 4:29:30 PM. | `05-hooks-triggered-protect-proofs-typecheck-on-save.jpg`, `hook-process-log.txt` |
| End of the turn | A row `Run Command Hook verify-on-stop` appeared when the turn ended. The agent then began a follow-up on what it saw in the hook's output (a search of `tests/a11y/contrast.test.ts`); that follow-up was cancelled by hand. | `06-turn-end-verify-on-stop.jpg` |

`hook-process-log.txt` also holds an earlier pair of lines at 4:28:16 PM. Those are the `tsc` run of the agent's own approved `npm run typecheck` in task 1 (the parent is a `node.exe`, not `Kiro.exe`), not the hook.

The comment that the agent added in the new chat session was not kept. The change merged from this session is the one of task 1 (the 12 px sizes and the test).

## How the IDE differed from the CLI

- The IDE asks for approval for each shell command the agent runs. The headless CLI run with `--trust-all-tools` asks nothing.
- The IDE runs a spec task in a sub-agent, ticks the box in `tasks.md` itself and writes a row in the log. Hooks show as `Run Command Hook <name>` rows in the chat. In the CLI the hook output comes back as text to the session.
- A hook that a file lists as enabled by default starts switched off in the IDE until its eye icon is pressed and the window is reloaded. The CLI read the same files with no such step.
- `PostFileSave` fired for a file saved by the agent in a new chat session after the reload. A save in the first session, before the reload, showed no hook.
- The IDE connects the three MCP servers of `.kiro/settings/mcp.json` by itself (`Connected (5 tools)` each) after the folder is trusted.

## Limits

One window, one machine, one task and one request. A save made by a person with Ctrl+S in the editor was not tried.
