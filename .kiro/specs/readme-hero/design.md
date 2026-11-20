# Design

## The capture tool
`tools/capture-hero.mjs` is plain Node and uses `chromium` from `@playwright/test`.

1. Stop when `dist/index.html` is missing (the tool says to run `npm run build`) or when free memory (`os.freemem()`) is under 2 GiB.
2. Pick a free port: ask the system for port 0, close, and try again if it is 4173 or 4177. Start `node tools/serve-dist.mjs <port>` and wait for its first line.
3. Launch headless Chromium with `--mute-audio`. Each capture uses a page of 1280x720 at device scale 2, and fails on any page error.
4. Capture one, the landing page `/`: wait until the garden in its frame has moved on a few ticks.
5. Capture two and three, in the garden at `/garden/`: win levels g01 to g04 with the actions of their proof files sent as real clicks, then open the level select (the pips show on the open cards) and take the picture. Then open g05, send its first proof action, and take the picture of the level in play.
6. Write a page of three images in a temp folder, screenshot it at 2323x900, write `docs/img/hero.png`, stop the server and remove the temp folder.

## The composite
A dark page with no text. The landing page is the large image on the left (1515x852). The level select and the play capture are stacked on the right (736x414 each). The gap is 24 px.

## The tests
`tests/docs/hero.test.ts` reads the PNG header (width from bytes 16 to 19, height from 20 to 23), `README.md` and the source of the tool. `tests/docs/readme-claims.test.ts` reads `README.md`, `docs/acceptance/`, `.kiro/specs/`, `docs/kiro-log.md` and the proof indexes. Neither starts a browser.
