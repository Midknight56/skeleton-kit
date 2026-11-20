# Requirements Document

## Introduction

This spec adds one Kiro power to the repository, `power/skeleton-kit/`, in the Agent Plugins format described in the saved Kiro docs (powers.md, powers_create.md, powers_installation.md). The power gives a Kiro user the five tools of the kit's tool door and one skill, `play-and-prove`. It also covers the saved proof that the power ran in one headless Kiro CLI session, and the README text that says what was done. The folders `power/` and `tests/` are outside the kit boundary table, like `tools/` and `docs/`.

## Requirements

### Requirement 1: The power
**User Story:** As a Kiro user with a clone of this repository, I want to install one power, so that Kiro can play a game built on the kit.

#### Acceptance Criteria
1. THE SYSTEM SHALL hold `power/skeleton-kit/plugin.json` with the schema URL, the name `skeleton-kit`, a version below 1.0.0, a description, an author with a name, and at least 4 keywords.
2. THE SYSTEM SHALL hold `power/skeleton-kit/mcp.json` with one stdio server that starts `kit/mcp/dist/server.js` from the path in `SKELETON_KIT_MCP_DIST` and passes `--game` with the value of `SKELETON_KIT_GAME`.
3. WHEN either variable is missing, THE launcher SHALL print a clear message on standard error and exit with code 1. Otherwise it SHALL change nothing and start the server.
4. THE SYSTEM SHALL keep `mcp.json` free of any drive path and any user name.
5. THE SYSTEM SHALL name in the README and the skill exactly the five tools that `kit/mcp/src/server.ts` registers.

### Requirement 2: The skill
**User Story:** As a Kiro user, I want a skill that holds the rules of a player of a kit game, so that Kiro does not call a level fine without playing it.

#### Acceptance Criteria
1. THE SYSTEM SHALL hold `power/skeleton-kit/skills/play-and-prove/SKILL.md` with front matter that has `name: play-and-prove` and a description that says when to use it.
2. THE skill SHALL say: play a level to a won status before calling it fine; send only actions from the legal list; a replay is a seed plus actions; never edit `proofs/` by hand, run `npm run prove`; the kit holds no word of a game.
3. THE skill SHALL say that a proof is not a claim about fun or safety.

### Requirement 3: The README of the power
#### Acceptance Criteria
1. THE README SHALL give the install command `kiro-cli powers install` and the uninstall command `kiro-cli powers uninstall skeleton-kit`.
2. THE README SHALL name what the power needs (Node 24 or later, `npm install`, `npm run build:kit`, `npm run build:apps`) and the two variables to set.

### Requirement 4: The custom agents
#### Acceptance Criteria
1. THE files `.kiro/agents/playtester.json` and `.kiro/agents/runner-playtester.json` SHALL parse, SHALL list only `read` and `@` tools, SHALL name only servers that exist in `.kiro/settings/mcp.json`, and SHALL list no write or shell tool.

### Requirement 5: Proof that the power ran
#### Acceptance Criteria
1. THE folder `docs/acceptance/power-session/` SHALL hold `README.md` and `session-output.txt` from one headless session (`--no-interactive`) in which the power was installed, with the commands in order, their output, the exit code and the seconds.
2. THE README of that folder SHALL have a section "Tool calls seen", what did not work first, the limits, how the answer was checked against the game, and the uninstall with the content of `installed.json` afterwards.
3. IF a step cannot be done, THEN the README of that folder SHALL say exactly what failed, with the error text, and no claim SHALL be made for it.

### Requirement 6: The claims
#### Acceptance Criteria
1. THE section "Kiro powers" of the root README SHALL name `power/skeleton-kit/` and `docs/acceptance/power-session/`, and SHALL no longer say "Not used in this build."
2. THE first paragraph of the root README SHALL list the power among what Kiro wrote.
3. EVERY named file in those claims SHALL exist.
