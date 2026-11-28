# Implementation Plan

- [x] 1. Product fixes in `site/`: keep imported edited metadata, validate the imported route, readable table on phones. Tests in `site/level-compare.test.ts` and `site/level-compare-ui.test.ts`.
- [x] 2. Docs: `docs/demo-video.txt`, `docs/release-metadata.md`, `tests/docs/hero.test.ts`, `tests/docs/readme-claims.test.ts`, README counts and Presentation, log rows.
- [x] 3. Focused checks: `npx vitest run site tests/docs`, `npm run typecheck`, `npx eslint site tests/docs`. No e2e ran. `npm run verify` ran only inside the copy made by `kit/create/src/new-game.test.ts`, and it passed there.
