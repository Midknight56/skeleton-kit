# Requirements

The landing page check of a turn limit shows the real result on the board.

1. At limit 3 the page stops and unloads the winning replay in the frame, clears its calls and its progress, and shows on the board that every route was exhausted within 3 turns.
2. The shortest win is derived from a real search on a relaxed copy and from real exhausted searches at the lower limits. It is never written in the code. If the search hits its cap, the page says inconclusive and makes no shortest claim.
3. At limit 4 the board shows the start board of the same puzzle and then applies the actions found by the search, with the applied count, the phase and the hash of a real session.
4. Restore 8 sets the field to 8 and plays the 8 turn copy to the hash of the proof file.
5. A new check cancels the timers of the old replay. Bad input gives a clear message and changes nothing.
6. The rule controls stay visible. The page makes no request, no storage write and no model call for a check or a replay.