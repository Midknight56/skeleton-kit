# Design Document

## Overview

Four small pieces. A pure function in `kit/shell` turns the facts of a level into pips and text. A build step embeds the facts of `proofs/<game>/index.json` in each game page. `mountGame` reads them and the level select screen draws them. Tests and a README paragraph close the loop. The contract of a game, `kit/core` and `proofs/` do not change.

## Components and Interfaces

`kit/shell/src/difficulty.ts`, exported from `kit/shell/src/index.ts`:

```ts
export interface LevelFacts { actions: number; firstMoves?: { legal: number; winning: number } }
export interface Difficulty { filled: number; total: number; text: string }
export function describeFacts(facts: LevelFacts, kind?: 'turn' | 'tick'): Difficulty;
```

- With `firstMoves`: `total` is `min(legal, 8)`. When `legal` is at most 8, `filled` is `winning`. Above 8, `filled` is `round(winning * 8 / legal)`, raised to 1 when `winning` is at least 1 and lowered to 7 when `winning` is below `legal`.
- `text` is `wins in A, W of L first moves win`. When `L` is 1 it ends `first move wins`.
- Without `firstMoves`: `total` and `filled` are 0, and `text` is `wins in A` for a turn game and `wins in A ticks` when `kind` is `tick`. `kind` defaults to `turn`. The shell passes `def.kind`.

Build: `tools/level-facts.mjs` (with `level-facts.d.mts`, as `check-versions` has) exports `readLevelFacts(repoRoot, gameId)` and `levelFactsPlugin(repoRoot)`. `vite.config.ts` lists the plugin. For a page whose folder is `apps/<id>`, its `transformIndexHtml` adds to the head:

```html
<script type="application/json" id="kit-level-facts">{"game":"garden","levels":{"g01":{"actions":2,"firstMoves":{"legal":2,"winning":2}}}}</script>
```

The JSON is written with `<` as `\u003c`. Pages outside `apps/` (the site) get nothing. The page needs no change and the games' `main.ts` need no change.

Shell: `kit/shell/src/level-facts.ts` has `readLevelFacts(doc)` that parses that tag and returns a `Map` from level id to `LevelFacts`, or an empty map when the tag is absent or damaged. `mountGame` calls it once and passes `facts(levelId)` and `kind` to `levelsScreen`. `ProofIndex` in `types.ts` gets an optional `firstMoves` on each item.

Card (`screens/levels.ts`, `styles.ts`), for an open level with facts and `total` above 0: one `span` with `data-pips`, `aria-hidden="true"`, under the stars, holding `total` `i` elements, the first `filled` with `data-on`. The card gets `data-actions`, `data-first-legal` and `data-first-win` when they exist. The accessible name is `<title>, <n> of 3 stars, <text>`. A locked card keeps `<title>, locked`.

Style: a pip is 6u by 6u (`u` is the menu unit `--u`), a gap of 2u, so 8 pips take 62u and fit the 88u card inside 8u padding and the border. The row sits 4u under the stars. Filled pips use `palette.accent`. Empty pips have a 2px border of `palette.text` and no fill. No transition, no animation.

## Error Handling

- Missing or damaged index, or an item without whole number `actions`: the build throws `proofs/<game>/index.json <problem>. Run npm run prove.` and exits 1. No page is written without facts.
- A level in `def.levels()` that the index does not list shows no pips. A damaged tag in the browser gives an empty map and the screen works as before.

## Testing Strategy

Each task writes its test first. Task 1: `difficulty.test.ts`. Task 2: `tools/level-facts.test.ts` and a case in `tools/build.test.ts` that reads `dist/garden/index.html` and `dist/runner/index.html`. Task 3: jsdom cases in `kit/shell/src/screens/` and `mount.test.ts`, plus a CSS string check for the pips. Task 4: `e2e/level-facts.e2e.ts`. Task 5: `tests/docs/difficulty.test.ts`.

## Correctness Properties

1. **Bounded.** For any `legal` from 0 to 60 and `winning` from 0 to `legal`, `filled` is at most `total`, and `total` is at most 8. (1.2)
2. **Exact text.** The text holds `actions`, `winning` and `legal` as decimal numbers. (1.3)
3. **Honest ends.** `filled` equals `total` only when `winning` equals `legal`, and is 0 only when `winning` is 0. (1.2)
4. **Same as the proof.** Every number on a built page equals the same field of the index file. (2.2)

## Decisions and Alternatives

- The card shows pips only, no visible number. The fewest actions is already the par that the stars use, and a number of a level that you do not play yet does not change what you do. The exact numbers are in the accessible name and in data attributes. A visible line of text is not added, so the card gains one row of pips and no words.
- A locked card shows no pips. Its facts do not help a player who cannot open it.
- Facts go in the page by a build step, not a fetch. The proof files are already fetched for watch mode, but a fetch can fail or be slow, and the level select would then flicker. The tag costs under 1 KB.
- `mountGame` reads the tag itself, so no game file changes and a new game gets the feature free. Choosing a new `MountOptions` field would touch both `main.ts` files.
- The runner shows nothing new on a card because a tick count says little about a choice. Its screen reader text still gets the tick count.

## Out of Scope

- Any score of fun or difficulty for people. Facts for tick games beyond `actions`. Changes to `kit/core`, `kit/solver`, `proofs/` or the tool door.
