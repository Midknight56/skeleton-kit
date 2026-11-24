# Design Document

## Overview

- Text version. `InputMap` gets an optional `narrate(state, previous)` that returns the words for a state. The shell keeps a status region on the play and watch screens and writes the words that `narrate` gives. The kit holds no game word: the garden and the runner each give their own `narrate` in `src/narrate.ts`. A game without it falls back to the observation summary of the game. The runner narrates only a change of event, and "Jump now" is found by stepping the game with a jump and with no jump, using the rules of the game.
- End of level. `createPlay.undo` returns false once the phase is not "playing". The play screen disables Undo when the phase changes.
- Back from Pause. The play route entry of a level keeps `fresh=1`. Starting a level replaces its own route with the same level and no `fresh`.
- Keys. `play.key` takes no button flag for number keys: only Space and Enter belong to a focused button.
- Resize. The play and watch screens are built again from the same session on a resize or orientation change. The session, and so the tick and hash, is kept.
- Confirm box. A keydown handler cycles Tab and Shift+Tab between the two buttons. The box gives focus back to the control that opened it.
- Watch levels. The watch route holds a level. Previous and next controls go to the neighbour level that has a proof. They sit in the strip row by the layout rules.
- Hint after Undo. The lesson queue is rebuilt from the state after Undo.
- Level card. `describeFacts` gives the fewest moves and the card shows a short label.
- Landing. The watch screen posts a message when it is left. The landing script hides or changes the caption.
- Privacy. The Settings link carries `?from=<game id>`. The privacy page reads it with a small inline script from the same page.
- Prove. Every failure line is prefixed with the replay file path.
- Motion. The reduced motion fade is removed from `motion.ts`.

## Limits

Several tasks cross more than one folder of the kit boundary table, because the task text names those folders. Each log row names the folders.

## Task 14 note
- Menu card test. A helper in e2e/menu-card.e2e.ts moves the mouse to (1, 1) and waits with document.getAnimations() until every running animation is infinite. It runs before checkCard of settings-confirm and pause-confirm. No product code and no limit changes.
