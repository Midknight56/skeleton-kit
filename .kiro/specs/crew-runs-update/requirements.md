# Requirements Document

## Introduction

The README says that playcheck 0.2.1 is installed, switched off and has not been run. On 20 Nov 2026 the owner enabled it in the Crew dashboard and the nightly job ran twice on Kiro Crew 0.12.2. The record is `crew-runs-2026-11-20.md` in the playcheck repository, runs 4 and 5.

## Requirements

### Requirement 1: The Crew paragraph is true
1. THE SYSTEM SHALL say that versions 0.1.0 and 0.2.0 were installed and run, and that 0.2.1 was enabled by the owner and run twice.
2. THE SYSTEM SHALL give run 4 (new kit commit, 18 of 18 proof replays matched, g01 and r01 won with the hashes of their proofs, 36.6 seconds) and run 5 ("No new commit", 3.0 seconds).
3. THE SYSTEM SHALL say that for g01 and r01 the agent replayed the proof's own action lists, and not that it won them by hand.
4. THE SYSTEM SHALL NOT say that 0.2.1 is switched off or has not been run.

### Requirement 2: Limits
1. THE SYSTEM SHALL change only `README.md` and the tests in `tests/docs/`, and add no package.
