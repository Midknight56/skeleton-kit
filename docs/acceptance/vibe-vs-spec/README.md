# Spec against vibe: one small feature built twice

Date: 20 Nov 2026. Tool: Kiro CLI 3.5.0, model `auto`, harness V3, headless (`--no-interactive`). Both builds started from the same commit (`847e6e1`) in their own throwaway worktrees with their own `npm ci`.

## The feature (the same words for both builds)

The prover tells, for each turn game level, how many of the first moves can still win. A level with 5 legal first actions where 2 can lead to a win gets `legal` 5 and `winning` 2. The numbers go into each proofs file under `stats.firstMoves` and into `proofs/<game>/index.json`. Tick games get nothing. The search is the one the prover already uses.

- Loose build: the feature in one paragraph, "make sure everything still works", no spec. The paragraph is the first sentence set of this section plus "use `npm run verify` at the end". Prompt file kept outside the repository.
- Spec build: three runs. Run 1 wrote a tiny spec (`.kiro/specs/first-moves/`) from the same words. Run 2 was asked to build it. Run 3 fixed the spec and built it (see below).

The steering files of the repository (`.kiro/steering/`) were loaded in both builds.

## Results

| | Loose build | Spec build |
| --- | --- | --- |
| Kiro runs | 1 | 3 |
| Credits (last `creditSplit` total of each session record) | 2.31 | 7.88 (1.22 + 0.90 + 5.77) |
| Minutes (session start to last write; each run also waits for the `verify-on-stop` hook, which takes about 5 minutes) | 19.5 | 30.9 (6.5 + 6.3 + 18.1) |
| Test cases added | 1 (`turn.test.ts`), plus assertions in `prove.test.ts` | 14 (10 in `first-moves.test.ts`, 4 in `prove.test.ts`); total 1220 before, 1234 after |
| `npm run verify` at the end | exit 0 | exit 0 |
| Spec files left behind | none | `requirements.md`, `design.md`, `tasks.md` |
| Public API change | a new option `firstMove` on `solveTurn` | a new function `countFirstMoves`, `solveTurn` options unchanged |
| First moves for the 23 levels of the repository | `firstmoves-vibe-build.json` | `firstmoves-spec-build.json` |

The two files of numbers are equal for all 23 levels (12 garden, 3 sample lights, 6 runner and 2 sample hop levels; the tick levels have none). That is two builds of different code that agree. It is not a check against a third, independent count. I did not check any number by hand.

The diffs are in `vibe-build.diff` (without the proof files) and `spec-build-solver.diff`.

## Faults seen

Loose build:

- Its log row in `docs/kiro-log.md` named the surface "Kiro IDE" and the date 2026-11-16. The run was the CLI on 2026-11-20. The row copied the wording of older rows. This breaks the claims policy ("say that a piece of work was done by Kiro only when it was done"). It was not corrected in the saved diff.
- One full `npm test` had a failure in `kit/create/src/new-game.test.ts` (about 164 seconds) that did not repeat. Its log row says the cause was not looked into.
- Its first test expectation (1 winning move on sample level `l1`) was wrong, and the test was corrected after the prover printed 9 of 9.
- It changed three folders in one task, which the kit boundary rule forbids (`kit/solver`, `proofs/`, `docs/`). It said so.

Spec build:

- Run 2 stopped before any code. The spec of run 1 asked for a `KitError` with the code `wrong_kind`. That code does not exist in `kit/core/src/errors.ts`, and the spec limited the change to `kit/solver`. Kiro named the conflict and changed no file. Run 3 changed the spec to a plain `Error` and built it. This cost one extra run (0.90 credits, 6.3 minutes). The loose build had no step where such a mistake could be caught.
- One of its own test expectations was wrong (a case without a depth limit), and it was corrected after the test ran.
- One test deviates from the spec text: `maxNodes` 10 stops `solveTurn` before the new code runs, so the test uses 200. The log row says so.
- All three log rows have the correct date and surface.

## What this does not show

One feature, one run of each build, one model (`auto`). The credit figures are from the session records of Kiro CLI, not from the usage page. A different feature or a different day could give another order.
