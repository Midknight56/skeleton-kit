# Design

- `site/try-rule.ts`: `tryLimit(limit, cap)` runs the kit search on an in-memory copy of g03. `deriveShortest(cap)` solves the copy with limit 20, solves the copy with that length, and needs "exhausted" at every lower limit.
- `site/rule-replay.ts`: `replayFrames` builds real sessions on the copy and paints the garden scene with `paintSvg` and the theme sprites. `Replayer` shows frames on a timer and cancels the old run on `start` and `stop`.
- `site/landing.ts`: the first check sets the frame to `about:blank`, hides it, and shows the board box. A flag makes the page ignore later messages of the frame. The calls list and the progress come from the actual actions.
- No change to `kit/`, `apps/`, `proofs/` or the shipped levels.