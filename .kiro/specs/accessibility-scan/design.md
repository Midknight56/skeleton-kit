# Design Document

## Overview

One Playwright file, `e2e/a11y.e2e.ts`, opens each screen the way `e2e/layout.e2e.ts` does and runs `AxeBuilder` on the page. It reuses the helpers of `e2e/fixtures.ts` and adds none to a file that another test needs.

## Flow of one test

For each game and each viewport: open the title, then level select, how to play, credits, settings and the reset confirm box, then play (a level started), pause, and results after a win. The garden puzzle is won with a lantern click and a wait. The runner runs its fake clock until the results screen opens.

## Scan

`new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()`. For the confirm box the scan covers the whole page, because the box is part of it. Nothing is excluded and no rule is disabled.

## Report

Each scan adds one entry: game, viewport, screen, counts by impact, violation rule ids, incomplete rule ids. The tests run in parallel workers, so each test writes a part file in the OS temp folder. A last test that depends on all of them is not used. Instead each test rewrites `docs/acceptance/a11y/report.json` from the entries of its own worker plus the part files found, under a lock free merge: parts are keyed by game and viewport, and the merge reads all parts and writes the sorted result. The file is the same whatever the order.

## Failing

After the report is written, the test collects serious and critical violations as `rule impact selector screen` lines and expects an empty list.

## Fixes

Each fix goes to the cause in `kit/shell/src` or in the apps. Colour changes only touch `tokens.ts` or the theme of one app and are named in the log.

## Limits

axe cannot judge the canvas content, and it does not replace a test with real people.
