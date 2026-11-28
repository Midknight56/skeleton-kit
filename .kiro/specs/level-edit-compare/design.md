# Design

- `site/level-compare.ts`: pure. `playRoute`, `compare`, `firstDifference`, `searchLevel` (cap 5000 states), `parseGridText`, `exportFile`, `importFile`. Reuses `apps/garden/src/def`, `proof` (turnOptions) and `rules/level` (parseLevel).
- `site/level-compare-ui.ts`: reads the section in `site/index.html` and paints with `paintSvg`. Two boards side by side from 700 px, stacked below.
- `site/landing.ts` calls `setupCompare`. No change to kit, apps or proofs.
