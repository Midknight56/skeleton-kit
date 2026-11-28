# Requirements

A judge edits a copy of Moth Garden level g01 on the landing page and replays the same winning moves on both boards.

1. A link in the intro leads to the section. The section shows the shipped board, an editable grid, and one-click example, restore, export and import.
2. The moves come from solveTurn on the shipped level at seed 1. Both boards are played with createSession. Only move outcomes are compared, never the board at turn 0.
3. The first changed outcome is named by turn and move, in plain words. The saved-route result is kept apart from the result of a bounded search of the edited board (win, proved exhaustion, or inconclusive).
4. Inputs are capped: grid 120 characters, 7 rows of 9, turns 1 to 99, file 8192 bytes, 40 moves, seed 0 to 2147483647. A bad grid or file gives an inline message and changes nothing.
5. The export holds inputs only (both levels, seed, moves). An import checks every field, drops extra fields and plays the moves again.
6. No request, no storage write, no login. Controls are keyboard reachable with text status in a live region.
