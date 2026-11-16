---
inclusion: fileMatch
fileMatchPattern: ["kit/shell/**", "apps/**", "site/**"]
---
# Game standards

## A game is complete
Every game has these screens, all working and all tested: title, level select, play, pause, results, settings, how to play, credits, and a confirm box before progress is reset. The game pauses by itself when the page loses focus.

## Clear in five seconds
A new player must be able to say, within five seconds of the first level, who they are, what to press now, how to win and how to lose. Show it with the picture first.

## Few words
- Show a word only when the player cannot see the thing and it changes what they do next.
- One thing at hand gets one or two words next to it.
- A control lesson shows at most three times. After that it lives only on the how to play screen.
- A number is on screen only while it changes what the player does. Use an icon or a bar before a word.

## Layout, measured
- Every control is at least 16 px inside the screen and the safe area.
- Text and icon sit inside their button with 8 px padding.
- Neighbouring controls are at least 12 px apart. Nothing overlaps.
- No control sits over the play area.
- The layout test runs at 360x640, 375x667, 390x844, 412x915, 768x1024, 1280x720 and 1920x1080 and names the control that fails.

## Look
- Each game has its own theme file: palette, button shape, type, one signature touch. The kit has no default grey skin.
- A theme's primary and secondary colours have HSL saturation of 0.25 or more. A test checks this.
- Use system fonts only. Load no font or script from another site.

## Sound
- All sound is made in code with WebAudio. The repository holds no sound files.
- Sound starts only after the first tap or key. Settings can turn sound and music off. The choice is saved.

## Motion
- When the system asks for reduced motion, turn off shake, flashes and parallax. Play stays the same.

## Every change is played
- A change to a game runs that game's full play through: from the title, through how to play, through every level by replay, with real input events, failing on any script error.
- A feature adds one step to the good path test and one step to the bad path test.

## Storage
- Progress and settings live in `localStorage` under `kit.<gameId>.v1`. The game works when storage is blocked and says once that progress will not be saved.
