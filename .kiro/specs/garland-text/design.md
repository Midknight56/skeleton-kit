# Design Document

## Overview

Two lines of `kit/shell/src/look.ts` set the garland text sizes with `L(phone, desk)`. `L` builds `calc(<phone>px + <desk - phone> * (var(--u) - 1px))`. At `--u` of 1px the value is `phone` px. At `--u` of 2px it is `desk` px.

| Selector | Now | After |
| --- | --- | --- |
| `[data-garland] .number` | `L(10, 13)` | `L(12, 13)` |
| `[data-garland] .note` | `L(11, 14)` | `L(12, 14)` |

The large end stays at 13 px and 14 px. Nothing else changes in the first pass.

## The test

The test goes in `kit/shell/src/look.test.ts`, in a new `describe('garland text')`. It uses `lookCss(neutralTheme())` from the same module that the other look tests use, so it reads the real CSS.

1. Find each rule whose selector starts with `[data-garland]` and take its `font-size` declarations. The match covers the rules inside the media block too.
2. Read the value with one pattern for `calc(Apx + B * (var(--u) - 1px))` and one for a plain `Npx`. The size at `--u` of `u` px is `A + B * (u - 1)`.
3. Compute it for `u = 1` (the small end) and `u = 2` (the large end). Expect each to be 12 or more. The failure message holds the selector, the end and the size.
4. Expect at least two garland `font-size` declarations, and fail on a value that matches neither pattern, so that a changed form cannot pass by being unread.

The red run is seen with the sizes at 10 and 11, and the failure must name `.number` and `.note` at the small end. Only then are the two sizes raised.

## Layout check at 12 px

At the small end the garland is 110 px high. The number row starts 18 px from the top. A picture is 32 px high, then 6 px of margin, then one line of 12 px mono text, about 15 px. The row ends near 71 px. The note sits 8 px above the bottom, so it spans about 87 px to 102 px. The two do not meet, and a number column of 34 px holds a two digit number at 12 px. This is a calculation, and Task 2 measures it.

## If a layout test fails

The first suspect is the garland height. Raise the height in both places that use it, with the same new value: `height: ${L(110, 176)}` in the `[data-garland]` rule and `calc(${L(110, 176)} + 16px)` in the title screen padding rule. Change the small number (110) only, by the smallest step that passes. The padding rule keeps the controls clear of the garland.

If the number columns are too narrow, widen the item width `L(34, 68)` by the smallest step. If the note meets a number, raise its `bottom` offset `L(8, 14)`.

The garland sits clear of the play area when three checks hold: every control box ends above the garland top (`look.e2e.ts`, line 163), the garland box ends inside `scrollHeight` (line 162), and `layout.e2e.ts` and `play-layout.e2e.ts` report no overlap at the seven viewports of the steering file. The garland only shows from 700 by 640 px, so the small end that matters is 700 px wide.

## Limits

The test reads CSS text. It does not read the computed size in a browser. The end to end files in Task 2 do that for the sizes that they open. The contrast file records the ratio of each colour pair, not a claim about people.
