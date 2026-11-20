# Implementation Plan

Rule for every task: when the task is finished, add one row to `docs/kiro-log.md` on the same day and leave the Credits cell empty. The owner fills it. No task adds a dependency. A task changes one folder from the kit-boundary table. Root files, `tools/`, `docs/` and `.kiro/` are outside the table. Never edit a file in `proofs/` by hand.

- [x] 1. countFirstMoves in the solver
  - Write the test first in `kit/solver/src/first-moves.test.ts`: `l1` with `maxDepth` 1 gives legal 9, winning 1. `l2` with `maxDepth` 2 gives legal 9, winning 2. `l3` with `maxDepth` 3 gives legal 9, winning 3. `allow` that refuses everything gives 0 and 0. `maxNodes` 10 on `l3` is undecided. `sample-hop` throws a plain `Error` whose message starts with "countFirstMoves needs a turn game". Add the three properties from the design with fast-check. Run it and see it fail because `countFirstMoves` does not exist.
  - Move the breadth first loop of `solveTurn` into one internal function, and add `countFirstMoves` on top of it. Export it from `kit/solver/src/index.ts`. The existing `solveTurn` tests must still pass without change.
  - Verify: `npm test -- first-moves` and `npm test -- solver` pass.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. prove writes firstMoves
  - Write the test first in the prove tests, in a temporary folder with the two sample copies: the turn proofs and the index items hold `firstMoves` with `legal` 9 for every `sample-lights` level, the `sample-hop` proofs and index items hold no `firstMoves` key, two runs give the same bytes, and a config with a turn fixture whose `turnOptions.maxNodes` is 10 exits 1 and leaves the files as they were. Run it and see it fail because the key is missing.
  - Call `countFirstMoves` in `prove.ts` for turn games with the options given to `solveTurn`, and write the two places in requirement 2.
  - Verify: `npm test -- prove` passes. The test changes files only in its temporary folder.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.4_

- [x] 3. Regenerate the repository proofs
  - Run `npm run prove -- --check` and see it exit 2 because the committed proofs have no `firstMoves`. Then run `npm run prove`, and `npm run prove -- --check` again, which must exit 0. Do not touch any file in `proofs/` by hand.
  - Check that every turn level file and index item has `firstMoves`, and no tick one has it. Record the run in `docs/kiro-log.md` without any invented numbers.
  - Verify: `npm run verify` passes.
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
