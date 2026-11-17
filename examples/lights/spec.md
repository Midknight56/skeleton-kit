# Lights 4 by 4

A short spec for the game `lights`, a 4 by 4 version of the starter game that `npm run new:game -- lights` makes. It lives in `apps/lights`.

## Rules

1. The board is 4 by 4 lamps. A lamp is on or off.
2. A press on cell `x,y` (each from 0 to 3) flips that lamp and its neighbours above, below, left and right that are on the board.
3. The action text of a press is `press:<x>,<y>`. Any other text is not an action.
4. A level is won when every lamp is off. A level can only be won, never lost, and `status.reason` is not set.
5. A press on a won level is not listed, and a press that is not listed changes nothing.

## Levels

6. There are 6 levels with the ids `l1` to `l6`. Each one starts from an empty board and applies a list of presses on different cells: 1, 2, 3, 4, 5 and 6 presses. So every level can be won, and its start board has at least one lamp on.
7. The first level is one press on the middle cell `1,1`.

## Proof

8. `npm run prove` finds the shortest win of each level with the plain search of the kit, at seed 1, with no AI model. The search key is the lamps only, so the number of moves does not split equal boards. The shortest win is never longer than the number of presses of the level.

## Play

9. The input map presses the lamp that the pointer holds. A key does nothing. The one lesson is `Tap lamp` on `lamp-1-1`.
10. The game uses the shell, the theme and the texts of the template. It has no end reason text, because it has no lost level.

## Tests

11. The definition passes `runConformance` with no failing property.
12. Each level starts with a lamp on and in phase `playing`, and its own list of presses wins it.
13. A decoded action is accepted only for the 16 cells.
14. The prover solves all 6 levels with at most as many actions as the level has presses.
