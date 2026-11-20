# Requirements: a picture at the top of the README, and a write up read from the files

## 1. The picture
1.1 `docs/img/hero.png` is a PNG at least 1600 pixels wide and 900 high. It is a composite of three real captures of the built site: the landing page, a garden level in play, and the garden level select with its proof pips.
1.2 Each capture is of the build in `dist/`, at 1280x720, with the words the build shows. The picture has no label added by the tool.
1.3 `tools/capture-hero.mjs` builds nothing. It reads free memory first and stops when it is too low. It serves `dist/` with `tools/serve-dist.mjs` on a free port that is not 4173 or 4177. It runs headless with audio muted. It writes its temporary page in a temp folder and removes the folder.
1.4 The first 25 lines of `README.md` hold the image link to `docs/img/hero.png` with alt text that says what it shows, the play link `https://skeleton-kit-games.pages.dev` and the video link.

## 2. The write up
2.1 The Kiro write up in `README.md` follows the order of the contest's questions: Kiro IDE, CLI, Web and Crew; custom agents; agent hooks; spec driven development; steering docs; MCP; property based testing; Kiro powers. Then two sections: spec against vibe and the model test, and accessibility.
2.2 Each section says what was done and names the proof file. A sentence that only says something was not done stays only where a reader would be misled without it.
2.3 Every number comes from a file read that day, and the file is named in backticks. Every path under `docs/acceptance/` written in backticks exists.
2.4 The judging block stays first after the picture and the links, in the contest's order. It claims no user test.
2.5 `README.md` holds no dash between words, none of "Not used in this build", "was not used" or "not used", and no word like fake or sandbox.

## Out of scope
No change to `docs/acceptance/`, `proofs/` or `.kiro/settings/mcp.json`. No new package.
