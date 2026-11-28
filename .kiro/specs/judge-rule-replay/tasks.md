# Implementation Plan

- [x] 1. Search, board replay and page wiring (`site/try-rule.ts`, `site/rule-replay.ts`, `site/landing.ts`, `site/index.html`)
  - Unit tests: `site/try-rule.test.ts`, `site/rule-replay.test.ts`.
- [x] 2. Browser check: `e2e/rule-replay.e2e.ts` was written by Kiro and run by Codex, not by Kiro. After two corrections to the new test (a wrong 8 turn hash for the limit 4 copy, and an ambiguous counter selector), `npx playwright test e2e/rule-replay.e2e.ts e2e/try-rule.e2e.ts e2e/site.e2e.ts --workers=1` exited 0 with 11 passed. No broader suite ran.