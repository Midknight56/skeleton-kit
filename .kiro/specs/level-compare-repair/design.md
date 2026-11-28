# Design

- `site/level-compare.ts`: new `checkRoute(original, seed, actions)` plays the moves with `playRoute` (a real session) and returns a reason or null. `importFile` calls it and rejects with a problem that starts with `actions:`.
- `site/level-compare-ui.ts`: the model holds `editedMeta` (id, title, turn limit of the edited copy). The grid box supplies only the rows. Import sets it from the file, Restore sets it from the original. Export and Compare read it. The Restore status says "wins again" only when both final frames are won.
- `site/index.html`: `.cmp-table` has `min-width: 640px` and per column minimum widths. `.cmp-scroll` has `max-width: 100%` and `overflow-x: auto`.
- `docs/demo-video.txt` holds the released video URL on one line. `tests/docs/hero.test.ts` checks it is a full YouTube link and that the README top holds the same URL. Publishing the next film changes that file and the README link only. See `docs/release-metadata.md`.
- `tests/docs/readme-claims.test.ts` also counts the log rows of the Kiro CLI version printed by `kiro-cli --version`.
