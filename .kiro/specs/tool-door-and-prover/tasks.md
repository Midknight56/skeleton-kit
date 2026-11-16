# Implementation Plan

Rule for every task: when the task is finished, add one row to `docs/kiro-log.md` on the same day and leave the Credits cell empty. The owner fills it. A task that adds a dependency writes its licence in that row. A task changes one folder from the kit-boundary table. Root files, `tools/`, `docs/` and `.kiro/` are outside the table.

- [ ] 1. Add the tool door package and the first failing test
  - Create `kit/mcp` with `package.json` (depends on `@kit/core`), `tsconfig.json` and an empty `src/index.ts`, the only export file.
  - Add the official Model Context Protocol TypeScript SDK and esbuild to `kit/mcp` only. Read the SDK README for the server and stdio transport calls. Write each package name, version and licence in the log, and check that each licence is MIT, BSD, ISC or Apache 2.0.
  - Add `kit/mcp/test-fixtures/sample-lights/def.ts` and `kit/mcp/test-fixtures/sample-hop/def.ts`, copies of the samples in `kit/conformance` with a default export, and a build script that bundles `src/server.ts` to `dist/server.js` and each fixture to `test-fixtures/<name>/dist/def.js`.
  - Write `kit/mcp/src/server.process.test.ts` that starts the built server for the `sample-lights` fixture and expects the five tool names. Run it and see it fail.
  - Verify: `npm run typecheck` passes and the new test fails for the reason "server not built".
  - _Requirements: 1.1_

- [ ] 2. Session store
  - Write `store.test.ts` first: ids `s1` to `s8`, the ninth session evicts the least recently used one, an `observe` call on a session counts as a use, an evicted id is unknown, ids are never reused. See it fail.
  - Implement `store.ts`.
  - Verify: `npm test -- store` passes.
  - _Requirements: 2.4, 3.4_

- [ ] 3. new_game and observe handlers
  - Write `tools.test.ts` cases first for requirement 2, requirement 4, an unknown session on `observe`, and a seed of -1 and of 1.5, using the `sample-lights` fixture. See them fail.
  - Implement the two handlers in `tools.ts`.
  - Verify: `npm test -- tools` passes for these cases.
  - _Requirements: 2.1, 2.2, 2.3, 3.4, 4.1_

- [ ] 4. act handler
  - Add the `act` cases from the design's testing strategy first, with their fixed results, plus an empty list and a malformed item such as `none*1`. See them fail.
  - Implement the handler with `expandActions` from `kit/core`, one item at a time as in the design.
  - Add the property "tool door equals session" from the design with fast-check.
  - Verify: `npm test -- tools` passes.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 5. render handler
  - Add test cases first for `svg` and `text` on both fixtures, an unknown session, and the property "observe changes nothing". See them fail.
  - Implement the handler.
  - Verify: `npm test -- tools` passes.
  - _Requirements: 3.4, 5.1, 5.2_

- [ ] 6. replay handler
  - Add test cases first: get, save into the `tests/replays/` folder of a temporary copy of the fixture folder, check a good replay, check a changed replay, an unknown session, and the two bad input forms. See them fail.
  - Implement the handler. The save path is the only file write in `kit/mcp`.
  - Verify: `npm test -- tools` passes.
  - _Requirements: 3.4, 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Server wiring
  - Implement `server.ts`: parse `--game`, load `<appDir>/dist/def.js`, run `validateDef`, register the five tools, connect the stdio transport, and turn a thrown handler error into `internal_error`.
  - Add process tests for the four start failures in requirement 1.2, a check that every standard output line parses as a JSON-RPC message, a call with a missing field that returns `bad_input`, and a call that returns `internal_error` from a fixture copy whose `observe` throws.
  - Verify: `npm run build` for `kit/mcp`, then `npm test -- server.process` passes.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 8. Solver package and solveTurn
  - Create `kit/solver` with `package.json` (depends on `@kit/core`; esbuild as a dev dependency with its licence in the log), `tsconfig.json` and `src/index.ts`, the only export file. Every later task in this spec that adds a solver export adds it to this file.
  - Add `kit/solver/test-fixtures/` with copies of `sample-lights` and `sample-hop`, and the `no-hop` copy from the design, each with a default export and bundled to `dist/def.js`.
  - Write `turn.test.ts` first with the `solveTurn` cases from the design's testing strategy: the reference search, the three expected action lists, the replay check, the `allow` case, the `key` case and the two limits. See it fail.
  - Implement `turn.ts` as a breadth first search with a visited set of key hashes. It reads no file.
  - Verify: `npm test -- turn` passes.
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 9. solveTick
  - Write `tick.test.ts` first with the `solveTick` cases from the design's testing strategy: `h1` with its action list and node count, `h2`, `no-hop`, and the two limits on both sides. See it fail.
  - Implement `tick.ts` as a search by tick layers with one state for each hash, in the order the design gives. It reads no file.
  - Verify: `npm test -- tick` passes.
  - _Requirements: 8.1, 8.2_

- [ ] 10. Prove command
  - Add `kit.config.json` at the root with the two `kit/solver/test-fixtures` samples, as in the design.
  - Write `prove.test.ts` first with the four runs from the design's testing strategy. See it fail.
  - Implement `prove.ts` with the exit codes and the file format from the design. Replace the root `prove` script with one that builds `kit/solver` and runs `node kit/solver/dist/prove.js`. Add `npm run prove -- --check` to the root `verify` script.
  - Verify: `npm run prove` then `npm run prove -- --check` both exit 0, and `npm test -- prove` passes. Time `npm run prove` with PowerShell `Measure-Command` and write the measured seconds in the log row, or write that it was not measured. Under 10 seconds is a target until that record exists.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 11. Protect the proof files
  - `tools/hooks/protect-proofs.mjs` and its test were made in `kit-core` task 1. Do not replace the test. Add two cases to `tools/hooks/protect-proofs.test.ts`: a sample event in the Pre Tool Use shape from the Kiro hooks reference with a `proofs/` target path, which expects exit code 2, and one with the target `kit/solver/src/prove.ts` and file content that holds `proofs/`, which expects exit code 0. See the second case fail.
  - Change the script so that it checks only the target path field named in the Kiro hooks reference, not the file content. Keep the four existing path cases passing. Write in the log row that this task changed a file made by `kit-core`.
  - Set `"enabled": true` in `.kiro/hooks/protect-proofs.json`. The hook ships switched off until the script checks only the path, because with content checks it would block every write of a file that mentions `proofs/`.
  - In a Kiro session, ask for a direct edit of one proof file and record in the log what the `protect-proofs` hook did, with the exit code Kiro reported. Add a row to the "Hooks seen to fire" table only if it fired.
  - If the hook did not block, read the Pre Tool Use section of the Kiro hooks reference, correct the script or the hook file, and repeat until the write is blocked.
  - Verify: `npm test -- protect-proofs` passes and the log row holds the observation.
  - _Requirements: 10.1, 10.2_

- [ ] 12. Kiro plays the sample game
  - Add a server named `sample` to `.kiro/settings/mcp.json` that runs `node kit/mcp/dist/server.js --game kit/mcp/test-fixtures/sample-lights`.
  - Ask the `playtester` agent to start level `l2`, play it to a won status through the tools, and call `replay` with `save` true. The agent writes no file itself. The tool door writes the file to `kit/mcp/test-fixtures/sample-lights/tests/replays/`.
  - Copy the list of tool calls into the "Tool door transcripts" section of the log. Run the saved replay with the `replay` tool and record the result.
  - Verify: the saved file passes `runReplay` in a unit test added to `kit/mcp/src/saved-replay.test.ts`.
  - _Requirements: 2.2, 3.1, 6.2, 6.3_

- [ ] 13. Tool door page
  - Write `docs/tool-door.md`: the five tools with one example call and answer each, taken from the real run in task 12.
  - Verify: `npm run verify` passes.
  - _Requirements: 1.1, 9.1_
