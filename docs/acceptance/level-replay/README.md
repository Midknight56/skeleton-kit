# Reproduce the changed Moth Garden win

Open the [level replay](https://skeleton-kit-games.pages.dev/#compare). Choose **Import JSON** and open [the 436-byte case](moth-garden-turn-2.json). This is the file downloaded from the judge's browser. It contains two levels, one seed and the original moves.

Step to turn two. On both boards, the moth reaches row one, column two. The original board has a flower there and the moth is home. The edited board has an empty square, and the game continues. Choose **Restore level** to put the flower back and win again with the same two moves.

On November 28, 2026, an agent ran the built site in fresh desktop and phone-sized browsers. It made the edit by hand, exported the case, imported it into a separate browser session, replayed the same difference and restored the win. It also tried an edit that kept the win, a malformed file, nonwinning moves and a file with different edited turn limits. Both games still opened and played. The complete browser suite passed 233 tests.
