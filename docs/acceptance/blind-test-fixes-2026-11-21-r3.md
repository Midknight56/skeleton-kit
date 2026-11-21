# Blind test fixes, round 3, 2026-11-21

Scope: only the Skeleton kit sections of gem1 and gem3. Both reports and their named Skeleton kit shots were read. The four lead art shots were also checked. Notes about the testers' own external link and file scripts are not app faults and are excluded.

App changes are confined to `kit/shell`. Tests and this acceptance record support that fix. No app rule, theme, font, token, package, branch, or Kiro log was changed. No deployment was made.

| Tester | Problem | State and observation in this checkout | Test name | Fix | Files |
| --- | --- | --- | --- | --- | --- |
| gem1, gem3, lead | Phone title loses the garden puzzle's lantern and moths, leaving the middle empty | REPRODUCED. At 360 by 640 and 390 by 844 there were zero visible main art shapes. Desktop art was visible. The strings made the whole art group meet the menu's exclusion box. | `r3 garden title ...: main art is on screen and clear of controls` | Fit the original hanging art below the buttons and above the ground on phones. Omit its long strings in this space. Keep the glow and moths. | `kit/shell/src/screens/backdrop.ts`, `kit/shell/src/look.ts`, `e2e/blind-test-r3.e2e.ts` |
| gem1, lead | Phone runner title loses the witch, leaving only the moon and ground | REPRODUCED. Zero visible witch shapes at both phone sizes. The desktop witch was visible. It had the same string and menu conflict. | `r3 runner title ...: main art is on screen and clear of controls` | The same shared art placement fits the original witch in the empty middle. Desktop art keeps its existing position. | Same three files as above |
| gem3 | “Then wait” is unclear and the Wait button is tiny or hard to find | NOT REPRODUCED as a hidden, broken, or undersized control. In all three required normal screen sizes the hint points to the visible Wait button. Its text is at least 12 px. Pressing it finishes level 1. Existing layout tests also check spacing and control size. | `r3 garden ...: Then wait points to a working button and a lit lantern also waits`; existing `garden level 1 ...: one chip at a time ...` | None. Keep the two word hint and the working button. | `e2e/blind-test-r3.e2e.ts` |
| gem3 | Expected any further board tap to advance the turn | TASTE. Empty board taps do not claim to wait. Tapping the lit lantern already waits and finishes the level. A general board tap action would change the control scheme. | `r3 garden ...: Then wait points to a working button and a lit lantern also waits`; existing garden input unit tests | None. | `e2e/blind-test-r3.e2e.ts`; existing `apps/garden/src/input.test.ts` |
| gem3 | Z, 9, and Enter give no warning when used as puzzle keys | TASTE. These keys are not advertised as puzzle actions. They leave the game state unchanged. How to play lists the working number keys and Space. A warning on unused keys is a preference. | `r3 garden: unused keys leave the puzzle alone and the documented keys work` | None. | `e2e/blind-test-r3.e2e.ts` |
| gem3 | Tool call display looks like a terminal where calls can be typed | TASTE. The display has no text entry control or promise of editing. Its header says “the calls that play this level” and its footer explains the calls. | `r3 landing: tool calls are a display with an explanation, not an input` | None. | `e2e/blind-test-r3.e2e.ts` |
| gem3 | Add an editable browser playground | TASTE. A proposed new feature, not a broken existing control. | Same landing test | None. | None |
| gem1 | Wait before lighting a lantern shows “Light a lantern first” | NOT REPRODUCED as a fault. This report describes correct handling. The warning appears, the tick stays at zero, and lighting a lantern then clears the blocked state. | Existing `garden: Wait with no lit lantern says why, and the Wait button looks unavailable until a lantern is lit` | None. | Existing `e2e/blind-test-fixes.e2e.ts` |

## Test evidence

- Browser checks use the local built checkout. Every browser runs headless with sound muted. Normal screen sizes are 360 by 640, 390 by 844, and 1920 by 1080. Art checks run with normal and reduced motion and resize in both directions.
- Neither Skeleton kit report claims a fixed bar overlaps content. No full page screenshot was used to infer an overlap. New title screenshots are normal screen captures. Existing layout checks cover all seven steering sizes, the other screens, text padding, and gaps between controls.
- Before the fix, all eight phone title cases failed with `Expected: 1, Received: 0` for visible main art. Three desktop cases also failed when resized to a phone. These are the expected failures for the reported fault.
- The first test run also caught a setup race in the new unused key check: it read the state hash before the first frame published it and passed null to the matcher. The check now waits for a valid hash before reading it. Its unchanged state checks remain in place. No existing test was edited.
- After the first app repair, all twelve title cases passed. The old soft glow checks caught missing local gradient definitions in the added drawing. The app was repaired by copying its definitions and giving each reference a unique id. The old test was kept unchanged.
- Full verification: `npm run verify:e2e` exited **0**. Type checks, lint, builds, 1,337 unit and rule tests across 97 files, all level proof checks, and all 179 browser tests passed. This includes the 17 new round 3 cases and all 162 existing browser tests. No existing test, expected value, skip setting, or limit was changed.
- The former soft glow checks passed at all three sizes after the app repair. The full run also passed the normal and reduced motion checks, both games' full play paths, and all seven layout sizes.
- The lead re-ran the full verify on 21 Nov: 1,337 unit tests and 179 browser tests passed, exit 0. Changed text files were checked for UTF-8 without a byte order mark and LF endings. `git diff --check` passed. The branch remains `fix-r3`.

## Final normal screen captures

These six captures come from the passing full run. The phone captures were also inspected as pictures.

| Screen size | Garden puzzle | Runner |
| --- | --- | --- |
| 360 by 640 | [Picture](r3-shots/garden-360x640.png) | [Picture](r3-shots/runner-360x640.png) |
| 390 by 844 | [Picture](r3-shots/garden-390x844.png) | [Picture](r3-shots/runner-390x844.png) |
| 1920 by 1080 | [Picture](r3-shots/garden-1920x1080.png) | [Picture](r3-shots/runner-1920x1080.png) |
