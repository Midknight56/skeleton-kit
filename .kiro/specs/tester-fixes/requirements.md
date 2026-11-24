# Requirements Document

## Introduction

A tester found 13 faults in the kit and its two games. This spec fixes each one with a test written first. No rule, hash or proof of a game changes.

## Requirements

### Requirement 1: A screen reader user can play (blocker)
1. THE play screen and the watch screen SHALL hold a visually hidden region with role "status" and aria-live "polite" that holds a text version of the play state.
2. WHEN a garden move, Undo or Wait is applied, THE region SHALL say the turn, which lanterns are lit and which are not, where each moth is, and the result when the level ends.
3. WHEN the runner state changes in words (run started, a gap ahead, "Jump now", landed, fell, reached the gate), THE region SHALL say it once. It SHALL NOT announce each tick.

### Requirement 2: The end of a level is final (garden)
1. WHILE the phase is not "playing", Undo SHALL do nothing and the Undo button SHALL be disabled, and the result screen SHALL show.

### Requirement 3: Back from Pause
1. WHEN the browser Back button leaves Pause, THE play screen SHALL return to the same board at the same turn, as Resume does.

### Requirement 4: Number keys with a button in focus
1. WHEN a button has focus, every game key except Space and Enter SHALL reach the game. Space and Enter keep their button meaning.

### Requirement 5: Resize during Play and Watch
1. WHEN the window is resized or turned during Play or Watch, THE screen SHALL be laid out again for the new size, with the same turn and the same hash.

### Requirement 6: The confirm box traps focus
1. WHILE the confirm box is open, Tab and Shift+Tab SHALL cycle between its two buttons only, Escape SHALL cancel, and focus SHALL return to the opening control when the box closes.

### Requirement 7: Choose the level in Watch
1. THE watch screen SHALL have previous and next level controls that move to the neighbour level with a proof, disabled at the ends, with the level number shown. `?watch=<id>` SHALL keep working.

### Requirement 8: The hint follows Undo
1. AFTER Undo the garden level 1 hint SHALL match the state again.

### Requirement 9: Fewest moves on the level card
1. EACH open turn level card SHALL show the fewest moves that win, as a label of at least 12 px.

### Requirement 10: The landing page caption follows the frame
1. WHEN the embedded game leaves Watch, THE caption and counter SHALL say so or hide, and return when a demo plays again.

### Requirement 11: Back from the privacy page
1. THE Back link of the privacy page SHALL return to the game's Settings screen when opened from a game, and to the landing page when opened from the landing page.

### Requirement 12: A failed proof names its replay file
1. EVERY failure line of the prove command SHALL name `proofs/<game>/<level>.json`.

### Requirement 13: Reduced motion turns every effect off
1. UNDER reduced motion, NO menu screen SHALL animate.

### Requirement 14: The menu card test does not flake
1. BEFORE it measures a confirm box, THE menu card test SHALL move the pointer away from every control and wait until no finite animation runs.
2. THE 12 px spacing limit and the 0.5 px tolerances SHALL stay as they are.
