# Implementation Plan

- [ ] 1. Add the packages and the first failing tests
  - Create `kit/mcp` and `kit/solver` with `package.json`, `tsconfig.json` and empty `src/index.ts` files. Add `kit.config.json` that lists the two sample games for now.
  - Add the official Model Context Protocol TypeScript SDK to `kit/mcp` only. Read its README for the server and stdio transport calls. Write the package name, version and licence in the log.
  - Write `kit/mcp/src/server.process.test.ts` that starts the built server for `sample-lights` and expects the five tool names. Run it and see it fail.
  - Verify: `npm run typecheck` passes and the new test fails for the reason "server not built".
  - _Requirements: 1.1_

- [ ] 2. Session store
  - Write `store.test.ts` first: ids `s1` to `s8`, the ninth session evicts the least recently used one, an evicted id is unknown, ids are never reused. See it fail.
  - Implement `store.ts`.
  - Verify: `npm test -- store` passes.
  - _Requirements: 2.4, 3.4_

- [ ] 3. new_game and observe handlers
  - Write `tools.test.ts` cases first for requirement 2 and requirement 4, using `sample-lights`. See them fail.
  - Implement the two handlers in `tools.ts`.
  - Verify: `npm test -- tools` passes for these cases.
  - _Requirements: 2.1, 2.2, 2.3, 4.1_

- [ ] 4. act handler
  - Add test cases first: a single action, `none*5` on `sample-hop`, a refused action in the middle of a list, 601 items, and items that expand to 3601 actions. See them fail.
  - Implement the handler with `expandActions` from `kit/core`.
  - Add the property "tool door equals session" from the design with fast-check.
  - Verify: `npm test -- tools` passes.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 5. render handler
  - Add test cases first for `svg` and `text` on both samples, and the property "observe changes nothing". See them fail.
  - Implement the handler.
  - Verify: `npm test -- tools` passes.
  - _Requirements: 5.1, 5.2_

- [ ] 6. replay handler
  - Add test cases first: get, save into a temporary `replays/` folder, check a good replay, check a changed replay, and the two bad input forms. See them fail.
  - Implement the handler. The save path is the only file write in `kit/mcp`.
  - Verify: `npm test -- tools` passes.
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Server wiring
  - Implement `server.ts`: parse `--game`, load `<appDir>/dist/def.js`, run `validateDef`, register the five tools, connect the stdio transport.
  - Add process tests for the three start failures in requirement 1.2.
  - Verify: `npm run build` for `kit/mcp` and the samples, then `npm test -- server.process` passes.
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 8. solveTurn
  - Write `turn.test.ts` first: the reference search for the three `sample-lights` levels, the `allow` case, the `key` case and the two limits. See it fail.
  - Implement `turn.ts` as a breadth first search with a visited set of key hashes.
  - Verify: `npm test -- turn` passes.
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 9. solveTick
  - Write `tick.test.ts` first: `sample-hop` level `h1` solved and replayed, the impossible level, and the two limits. See it fail.
  - Implement `tick.ts` as a search by tick layers with one state for each hash.
  - Verify: `npm test -- tick` passes.
  - _Requirements: 8.1, 8.2_

- [ ] 10. Prove command
  - Write `prove.test.ts` first with the four runs from the design's testing strategy. See it fail.
  - Implement `prove.ts` with the exit codes and the file format from the design. Replace the root `prove` script. Add `prove -- --check` to the root `verify` script.
  - Verify: `npm run prove` then `npm run prove -- --check` both exit 0, and `npm test -- prove` passes.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 11. Protect the proof files
  - Write `tools/hooks/protect-proofs.test.ts` for the two cases in requirement 10.2.
  - Set `"enabled": true` in `.kiro/hooks/protect-proofs.json`. The hook ships switched off until this task, because its script does not exist before task 1 of `kit-core`.
  - In a Kiro session, ask for a direct edit of one proof file and record in the log what the `protect-proofs` hook did, with the exit code Kiro reported.
  - If the hook did not block, read the Pre Tool Use section of the Kiro hooks reference, correct the script or the hook file, and repeat until the write is blocked.
  - Verify: `npm test -- protect-proofs` passes and the log row holds the observation.
  - _Requirements: 10.1, 10.2_

- [ ] 12. Kiro plays the sample game
  - Add a server named `sample` to `.kiro/settings/mcp.json` that runs `kit/mcp/dist/server.js --game kit/conformance/sample-lights`.
  - With the `playtester` agent, start level `l2`, play it to a won status through the tools, and save the replay.
  - Copy the list of tool calls into the log. Run the saved replay with the `replay` tool and record the result.
  - Verify: the saved file passes `runReplay` in a unit test added to `kit/mcp/src/saved-replay.test.ts`.
  - _Requirements: 2.2, 3.1, 6.2, 6.3_

- [ ] 13. Tool door page and log
  - Write `docs/tool-door.md`: the five tools with one example call and answer each, taken from the real run in task 12.
  - Create `kit/solver/src/index.ts` as the only export file. Add the log rows for this spec with the credits used.
  - Verify: `npm run verify` passes.
  - _Requirements: 1.1, 9.1_
