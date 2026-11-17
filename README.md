# Skeleton kit

A kit for small web games that a program can play as well as a person. It holds the kit and two games built from it: Moth Garden, a turn puzzle, and Broom Runner, a one button runner. A search script proves that every level of both games can be finished, and any AI tool can play them through a tool door (an MCP server).

Built with Kiro for Kiroween 2026, Skeleton Crew category. Kiro wrote the code from five specs, with five steering files, three hooks, three MCP servers and two custom agents.

Play: https://skeleton-kit-games.pages.dev (no login, no account)

## Judging criteria at a glance

**Potential Impact.** Solo developers and small studios have nobody to replay every level after each change, and an AI coding tool writes game code it cannot play. With this kit, `npm run prove -- --check` replays a proof for every level after each change and fails with the exact replay file when a level breaks. Each run is free: the proof is a plain search, not a model. Today it proves 12 garden levels (2 to 16 actions) and 6 runner courses (687 to 1851 actions).

**Technological Implementation.** Five Kiro specs (`kit-core`, `tool-door-and-prover`, `garden-puzzle`, `broom-runner`, `shell-and-site`) with 78 tasks, all done. Five steering files set the rules (determinism, kit boundary, game standards, claims, product). Three hooks: `protect-proofs` blocks any direct write to `proofs/` (seen to block a real write, logged), `verify-on-stop` is set to run the full check when the agent finishes a turn, and `typecheck-on-save` is set to check types on save. Three MCP servers give Kiro each game's tool door, and two custom agents (`playtester`, `runner-playtester`) played levels to a won state through them. A property test found a real bug (a replay whose game field was an object with no prototype threw a TypeError); the fix is in `kit/core/src/replay.ts`. Every task is logged in `docs/kiro-log.md`.

**Design.** Both games are complete: title, level select with locks and stars, play, pause (also when the page loses focus), results with Next, Retry and Levels, settings with a confirm box before a reset, how to play, credits, a watch mode that plays any level from its proof, a loading screen and a privacy page. Every menu sits in a card drawn in the game's own colours: a lantern glow for the garden, a moon for the runner. The art is SVG drawn in code and every sound is made in code. Headless browser tests measure every control at 360x640, 768x1024 and 1920x1080: 16 px from the screen edge, 12 px between neighbours, nothing overlapping.

**Innovation/Idea.** The same game code runs in three places: the browser, the prover and the tool door. One draw list feeds a canvas painter for players and an SVG text painter for tools and tests, so the picture a program gets is the picture a player sees. A turn puzzle and a real time runner at 60 ticks a second share one contract, which shows the kit is not tied to one kind of game. For the runner the prover also measures how forgiving each jump is: every jump has a window of at least 9 ticks on the first two courses, 6 on the middle two and 4 on the last two (at 60 ticks a second, 150 ms down to 67 ms).

**Presentation.** The landing page plays a garden level by itself in the first screen and shows the exact tool calls that play it. The video shows both games, a change that breaks a level, the prover naming the broken level, and how Kiro built it.

## The two apps

| Folder | Game | Kind | Levels |
| --- | --- | --- | --- |
| `apps/garden` | Moth Garden | Turn puzzle: light a lantern, each moth must reach a flower | 12 |
| `apps/runner` | Broom Runner | One button runner: tap to jump, reach the gate | 6 |

A third small game, `examples/lights`, was made with `npm run new:game` to show how a new game starts.

## The kit

| Package | What it does |
| --- | --- |
| `kit/core` | The game contract, sessions, replays, state hashes, repeatable random numbers, SVG text painter. No dependencies. |
| `kit/conformance` | Nine property tests every game must pass, with `fast-check`. |
| `kit/solver` | The prover. Writes and checks `proofs/<game>/<level>.json`. |
| `kit/mcp` | The tool door: an MCP server with five tools (`new_game`, `act`, `observe`, `render`, `replay`). See `docs/tool-door.md`. |
| `kit/shell` | The complete game shell both games use: screens, input, layout, sound, saves, usage events. |
| `kit/create` | `npm run new:game` makes a new game folder. |

## How Kiro was used

**Kiro CLI, IDE and Crew.** Almost all the code came from the Kiro CLI 3.3.0 run with no person at the keyboard (`kiro-cli chat --no-interactive`, model Auto): one run per spec task or fix, each told to write the test first, run `npm run verify` and add a row to `docs/kiro-log.md`. The log holds 80 such rows. Four spec reviews ran in the Kiro IDE before any code was written. The two playtester agents ran on the CLI's v2 engine, because the v3 engine loaded no MCP tools in a run with no person at the keyboard. Kiro Crew runs the `playcheck` app (see below). Kiro Web was not used.

**Spec driven development.** Each of the five specs has requirements, a design and a task list (78 tasks in all). The kit was split so that each spec could be built and checked on its own: `kit-core` first (the contract, replays and hashes), then the tool door and prover, then each game, then the shell and site. A task was done only when its tests passed and the proof check passed. When a fault showed up later (for example, a hint chip over a moth on a wide screen), it went back to Kiro as a new task with a failing test first, not as a loose request. Compared with loose requests, the specs kept 80 separate runs in line with one contract, and each run had to pass the same `npm run verify` before its work was kept.

**Steering.** Three files are always loaded: `product.md` (who it is for), `kit-boundary.md` (which folder may import which) and `claims-policy.md` (never invent test output, never edit `proofs/` by hand, log every task). Two load only for matching files: `determinism.md` for the rules code (plain JSON state, integers only in a tick game, no clock and no global random) and `game-standards.md` for the shell and apps (every screen, clear in five seconds, spacing rules). The claims policy made the biggest difference: Kiro's log rows say which tests failed first, what did not run and what was not checked.

**Agent hooks.** `protect-proofs` (PreToolUse) runs `tools/hooks/protect-proofs.mjs` and refuses any write into `proofs/`, so only `npm run prove` can change a proof. It blocked a real write on 16 Nov 2026 (in the log under "Hooks seen to fire"). `verify-on-stop` is set to run `npm run verify` when the agent finishes a turn, and `typecheck-on-save` is set to run the type check on save. The log records a hook only when it was seen to fire.

**MCP.** `.kiro/settings/mcp.json` starts the kit's own tool door for the garden, the runner and a sample game. With it Kiro can play the games it wrote, not only compile them. The `playtester` agent won a sample level through it and the `runner-playtester` agent won runner course r01 (tick 687, score 110), and each replay was checked against the rules. Without MCP an agent can only read the code and guess how a level plays.

**Custom agents.** `.kiro/agents/playtester.json` and `.kiro/agents/runner-playtester.json` have only the game tools and file reads, and may not change any file. Each must play a level to a won status in its own session before it may call the level fine. Their tool calls are pasted in `docs/kiro-log.md` under "Tool door transcripts".

**Property based testing.** `kit/conformance` holds nine properties every game must pass (with `fast-check`): repeatable, replay round trip, legal closure, plain data, input not changed, game over is final, action text round trip, undo, and view and observation safe. Kiro added twelve more properties to `kit-core` from its requirements. The property on replay failures found the TypeError bug above, which no unit test had covered.

**Kiro powers.** Not used.

## Run it

Node 20 or newer.

```
npm install
npm run verify
npm run e2e
```

`npm run verify` runs the type check, lint, build, 1068 unit tests and the proof check. `npm run e2e` runs 90 headless browser tests.

Play a game through its tool door:

```
node kit/mcp/dist/server.js --game apps/garden
```

## Kiro Crew app

`playcheck` is a Kiro Crew app in its own repository: https://github.com/Midknight56/playcheck. A Crew agent plays a game built with this kit through its tool door and reports the level, seed, actions, final status and state hash. Its nightly play check ships switched off.

## Privacy

No account, no login, no personal data. Progress stays in your browser. The usage beacon sends only the events listed on the privacy page, and only when the site is built with a beacon address. It can be switched off in Settings.

## Licence

MIT. Made by Adrian Ferguson.
