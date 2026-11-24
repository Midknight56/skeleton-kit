# Implementation Plan

Rule for every task: write the test first and see it fail for the right reason. When the task is finished, tick it here and add one row to `docs/kiro-log.md` dated 2026-11-24. Leave the Credits cell empty.

- [x] 1. Text version of the play state for a screen reader (blocker)
  - Unit tests per game, a status region in the play and watch screens, an e2e test of the accessibility tree.
  - _Requirements: 1.1 to 1.3_

- [x] 2. The end of a level is final
  - Undo does nothing and is disabled once the phase is not "playing".
  - _Requirements: 2.1_

- [x] 3. Back from Pause returns to the same board
  - e2e test with `page.goBack()`.
  - _Requirements: 3.1_

- [x] 4. Number keys reach the game with a button in focus
  - Unit and e2e test.
  - _Requirements: 4.1_

- [x] 5. Resize during Play and Watch lays the screen out again
  - e2e test at 360x640 then 640x360, same `data-tick` and `data-hash`.
  - _Requirements: 5.1_

- [x] 6. The confirm box traps focus
  - Unit and e2e test.
  - _Requirements: 6.1_

- [x] 7. Choose the level in Watch
  - Previous and next controls, e2e layout test at three sizes for both games.
  - _Requirements: 7.1_

- [x] 8. The tutorial hint follows Undo
  - Test that the hint asks for a lantern when none is lit.
  - _Requirements: 8.1_

- [x] 9. Fewest moves on each open turn level card
  - Test of the label, its size and its place.
  - _Requirements: 9.1_

- [x] 10. The landing caption follows the frame
  - e2e test: Back inside the frame.
  - _Requirements: 10.1_

- [x] 11. Back from the privacy page
  - e2e test for both routes.
  - _Requirements: 11.1_

- [x] 12. A failed proof line names the replay file
  - Test with a small broken level in a temporary folder.
  - _Requirements: 12.1_

- [x] 13. No fade under reduced motion
  - Change the motion test that asserts the old fade.
  - _Requirements: 13.1_

- [x] 14. The menu card test does not flake
  - Pointer to a corner and wait for finite animations before each confirm box check. Run the file 10 times in a row.
  - _Requirements: 14.1, 14.2_
