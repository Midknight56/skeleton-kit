# Kiro log

One row for each finished task, added the same day.

| Date | Kiro surface and model | Spec and task | Files or commit | Verify command and result | Credits | What changed because of a failure |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-16 | Kiro CLI 3.3.0 (v3, no person at the keyboard), Auto (model chosen by the server) | kit-core task 1 | package.json, package-lock.json, tsconfig.json, eslint.config.mjs, LICENSE, README.md, .gitignore, tools/hooks/protect-proofs.mjs, tools/hooks/protect-proofs.test.ts, docs/kiro-log.md, .kiro/specs/kit-core/tasks.md | `npm run verify`: typecheck, lint and test all ran and it exited 0 (1 test file, 5 tests passed). Hooks: `typecheck-on-save` and `verify-on-stop` exist in `.kiro/hooks`. Neither was seen to fire in this session, so they are not recorded as fired. `protect-proofs` exists but is set `enabled: false`. | 1.67 | The new test failed first (5 of 5, script missing). Lint then flagged a useless escape in the hook regex and it was fixed. |

## Hooks seen to fire

| Date | Hook | What triggered it | What it did |
| --- | --- | --- | --- |

## Tool door transcripts

Paste each real list of tool calls here, with the date and the level.

## Dependencies and licences

| Package | Version | Licence | Added in task |
| --- | --- | --- | --- |
| typescript | 6.0.3 | Apache-2.0 | kit-core 1 |
| typescript-eslint | 8.73.0 | MIT | kit-core 1 |
| eslint | 10.15.0 | MIT | kit-core 1 |
| @eslint/js | 10.0.1 | MIT | kit-core 1 |
| vitest | 5.1.0 | MIT | kit-core 1 |
| fast-check | 4.10.2 | MIT | kit-core 1 |
| @types/node | 26.6.6 | MIT | kit-core 1 |
