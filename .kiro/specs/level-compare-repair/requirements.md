# Requirements

An external agent-run fresh browser judge passed the core steps of the level edit comparison (spec `level-edit-compare`) and found three product issues and one documentation issue.

1. An imported file keeps its edited title and turn limit through Compare, Example and Export. Restore resets the whole edited copy to the original level. A test imports a file with original turn limit 6 and edited turn limit 1 and a different edited title, then exports.
2. An imported route must win the original level. It is played on the original with a real session. An empty route, a route that does not win, a refused move and moves after the win are each rejected with a visible reason that says what to change. The Restore message comes from the actual result of the comparison.
3. The comparison table has minimum column widths and a table minimum width, scrolls sideways inside its own container only, and leaves the page width unchanged at 360 and 390 px.
4. The README counts (specs, tasks, log rows by CLI version, unit tests) match the files. The README video link comes from `docs/demo-video.txt`, the single record of the released URL, and `tests/docs/hero.test.ts` reads it from there. The README Presentation paragraph describes the level edit path.
