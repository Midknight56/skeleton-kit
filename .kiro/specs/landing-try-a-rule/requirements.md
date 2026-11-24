# Requirements Document

## Introduction

Two changes to the landing page and the README image. A visitor can change one rule of the garden puzzle level g03 and see whether it can still be won. Both games get a named play link on the first phone screen, and the README image shows a real runner frame. No rule, hash or proof of a game changes.

## Requirements

### Requirement 1: Try a turn limit on level g03
1. THE landing page SHALL show, next to the self playing demo, a control for the turn limit of level g03, with the shipped value 8 as its start value.
2. WHEN the visitor presses the run button, THE page SHALL run the turn search of `kit/solver` on a copy of g03 with that limit, in the page, with no network request.
3. THE page SHALL say in plain words either the winning moves and their count, or that no route wins within that limit because the search ran out of routes.
4. Limit 8 SHALL give a four move win, limit 3 SHALL exhaust every route, limit 4 SHALL give a win, and Restore SHALL put 8 back and give the final state hash `9a074fd5e9266b9a`.
5. THE search SHALL be capped in nodes and in the limit, so the page stays responsive.
6. THE control SHALL NOT write to local storage, and SHALL NOT change any file in `proofs/` or any level file. The changed level lives in memory only.
7. THE controls SHALL be at least 44 px high, 16 px from the screen edge, 12 px apart, with text of at least 12 px, at 360x640 and 1280x800.

### Requirement 2: Both games on the first phone screen and in the README image
1. AT 360x640, before any scrolling, THE landing page SHALL show a play link for Moth Garden (the turn puzzle) and one for Broom Runner (the timed runner), each fully inside the screen. One press SHALL open that game.
2. THE phone demo SHALL stay inside the first screen. The same SHALL hold at 1280x800.
3. THE capture plan of `tools/capture-hero.mjs` SHALL include a real Broom Runner frame in the air, in place of one garden panel, and keep a garden frame with a lantern move.
4. THE test of the README image SHALL require alt text that names the landing page, the runner jump, and a garden level in play with a lantern, and SHALL refuse the words level select and pips.
