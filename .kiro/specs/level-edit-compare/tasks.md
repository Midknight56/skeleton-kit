# Implementation Plan

- [x] 1. Pure comparison, page module, section and link (`site/level-compare.ts`, `site/level-compare-ui.ts`, `site/index.html`, `site/landing.ts`)
  - Unit tests: `site/level-compare.test.ts`, `site/level-compare-ui.test.ts` (jsdom).
- [x] 2. Browser check of the original flow. It was run by an external agent-run fresh browser judge, not by Kiro. It passed desktop and phone initial example, manual change, export, restore, keyboard use and game play. It found the issues fixed in spec `level-compare-repair`. No numbers were recorded and Kiro did not run a browser here.
