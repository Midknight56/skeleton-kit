# Model test: one spec task on three models

Date: 20 Nov 2026. Tool: Kiro CLI 3.5.0, headless (`--no-interactive`), harness V3. The models are the names that `kiro-cli chat --list-models` printed that day, with the credit factor it printed against Auto: `auto` 1.00x, `claude-sonnet-5.5` 1.30x, `gpt-5.6-luna` 0.60x.

## Task

The three tasks of the spec `.kiro/specs/first-moves/` (see `docs/acceptance/vibe-vs-spec/`): a function that counts the first moves of a turn level that can still win, the prover writing it, and regenerating the proofs. Same prompt, same spec, same starting commit (`847e6e1`), each model in its own throwaway worktree.

The `auto` row is the third run of the spec build of `vibe-vs-spec`. That run also changed the spec first, so it did a little more than the other two. The spec files given to the other two runs were the changed ones, and their boxes in `tasks.md` were already ticked. Both runs said that none of the work existed and did it.

## Results

| Model | Credits (session record) | Minutes | Test cases added (total tests after, 1220 before) | `npm run verify` | First moves for the 23 levels |
| --- | --- | --- | --- | --- | --- |
| `auto` | 5.77 | 18.1 | 14 (1234) | exit 0 | the reference |
| `claude-sonnet-5.5` | 10.47 | 21.0 | 17 (1237) | exit 0 | equal to the reference |
| `gpt-5.6-luna` | 6.98 | 33.0 | 9 (1229) | exit 0 | equal to the reference |

Minutes include the wait for the `verify-on-stop` hook at the end of each run (about 5 minutes). The diffs of the two extra builds are `msonnet-build.diff` and `mluna-build.diff`. The build kept in the repository is the one from `auto`, because it was the first to finish with its spec and its tests.

## Differences seen

- Sonnet wrote the most tests (14 in `first-moves.test.ts`, 3 in `prove.test.ts`) and spent the most credits.
- Luna spent fewer credits than Sonnet and more time. It reported that `npm run prove -- --check` through npm exited 1 while the prover run directly exited 2, and that it used the direct exit code for the spec's check.
- All three kept `solveTurn` as it was in behaviour and wrote equal numbers.

## What this does not show

One task, one run each. The credit figures are from the session records, not from the usage page. A slower run may be a busier PC: four Kiro runs and a full `verify` ran at the same time on one machine.
