# Tool door

The tool door is a server that lets a program play a game built on the kit. It speaks the Model Context Protocol over standard input and output. It has five tools. Start it with a game folder:

```
node kit/mcp/dist/server.js --game kit/mcp/test-fixtures/sample-lights
```

Build it first with `npm run build -w @kit/mcp`. In this repository the server named `sample` in `.kiro/settings/mcp.json` runs that command.

## Where the examples come from

The calls for `new_game`, `act` and `replay` are the calls the `playtester` agent made on level `l2` of the sample lights game on 2026-11-16 (see "Tool door transcripts" in `docs/kiro-log.md`). That run was recorded as a report, which gave each input and a summary of each answer. The exact answer text below was produced by sending the same inputs to a fresh server. The `observe` and `render` calls were not part of the agent run. They were sent to the same server in the same way, with the same level and seed, after the agent run.

Every answer is one JSON object, except `render` with the text format, which is plain text. A failed call returns an object with `error` and `message`, for example `{"error":"bad_input","message":"..."}`.

## new_game

Starts a session on a level. Input: `level` (text), `seed` (whole number from 0 to 2147483647, optional, 1 when left out).

Call:

```json
{"level":"l2","seed":0}
```

Answer:

```json
{"session":"s1","level":"l2","seed":0,"tick":0,"status":{"phase":"playing","score":0},"observation":{"summary":"6 lamps are on. A press flips a lamp and its neighbours.","textMap":["##.","#.#",".##"],"legend":{"#":"lamp on",".":"lamp off"},"facts":{"lampsOn":6,"moves":0}},"legal":["press:0,0","press:1,0","press:2,0","press:0,1","press:1,1","press:2,1","press:0,2","press:1,2","press:2,2"]}
```

## act

Sends one or more actions to a session. It stops at the first action that fails and names the reason in `stoppedBy` (`bad_action_text`, `illegal_action` or `game_over`). `stoppedBy` is `null` when every action was applied.
ull when every action was applied.

Call:

```json
{"session":"s1","actions":["press:0,0","press:2,2"]}
```

Answer:

```json
{"applied":2,"stoppedBy":null,"tick":2,"status":{"phase":"won","score":2,"reason":"every lamp is off"},"observation":{"summary":"Every lamp is off.","textMap":["...","...","..."],"legend":{"#":"lamp on",".":"lamp off"},"facts":{"lampsOn":0,"moves":2}},"legal":[],"hash":"6ccb2c6a8194c8ac"}
```

## observe

Reads the state of a session and changes nothing. This example was sent before `act`.

Call:

```json
{"session":"s1"}
```

Answer:

```json
{"tick":0,"status":{"phase":"playing","score":0},"observation":{"summary":"6 lamps are on. A press flips a lamp and its neighbours.","textMap":["##.","#.#",".##"],"legend":{"#":"lamp on",".":"lamp off"},"facts":{"lampsOn":6,"moves":0}},"legal":["press:0,0","press:1,0","press:2,0","press:0,1","press:1,1","press:2,1","press:0,2","press:1,2","press:2,2"],"hash":"f3512c762102c40a"}
```

## render

Draws a session. The field `format` is required and is `"text"` or `"svg"`. Without it the call fails with `bad_input`. The text answer holds the summary, the map and the legend. This example was sent before `act`.

Call:

```json
{"session":"s1","format":"text"}
```

Answer:

```
6 lamps are on. A press flips a lamp and its neighbours.

##.
#.#
.##

# = lamp on
. = lamp off
```

With `"format":"svg"` the answer is an SVG document of 960 by 540 units, one `rect` for each lamp.

## replay

Two forms. With `session`, it returns the replay of that session. With `save` true it also writes the replay file under the game's `tests/replays/` folder. With `replay`, it runs a given replay object and returns the result. Give `session` or `replay`, not both.

Call, for a session:

```json
{"session":"s1","save":true}
```

Answer:

```json
{"replay":{"format":1,"game":"sample-lights","rulesVersion":"1","level":"l2","seed":0,"actions":["press:0,0","press:2,2"],"finalHash":"6ccb2c6a8194c8ac","finalPhase":"won"}}
```

The agent run saved this as `kit/mcp/test-fixtures/sample-lights/tests/replays/sample-lights-l2-6ccb2c6a8194c8ac.json`. The example answer above was sent with `save` false, so it wrote no file.

Call, for a replay object:

```json
{"replay":{"format":1,"game":"sample-lights","rulesVersion":"1","level":"l2","seed":0,"actions":["press:0,0","press:2,2"],"finalHash":"6ccb2c6a8194c8ac","finalPhase":"won"}}
```

Answer:

```json
{"ok":true,"finalHash":"6ccb2c6a8194c8ac","finalPhase":"won"}
```