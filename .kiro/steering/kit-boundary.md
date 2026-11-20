---
inclusion: always
---
# Kit boundary

## Folders
| Folder | Holds | May import from |
| --- | --- | --- |
| `kit/core` | Types, session, random numbers, hash, replay, scene types, SVG painter | nothing in this repository |
| `kit/conformance` | The nine property tests as a function `runConformance(def)` | `kit/core` |
| `kit/solver` | Search for turn games and tick games, the prove command | `kit/core` |
| `kit/mcp` | The tool door | `kit/core` |
| `kit/shell` | Game shell, canvas painter, watch mode | `kit/core` |
| `kit/create` | The `new:game` scaffold and its template | nothing at run time |
| `apps/garden`, `apps/runner` | One game each: `src/rules`, `src/view`, `src/levels`, `theme.ts`, `game.config.ts` | `kit/*` only |
| `proofs/` | Proof files | written only by `npm run prove` |
| `site/` | Landing page and privacy page | built outputs only |

## Rules
- The kit never contains a word from a game: no `moth`, `lantern`, `flower`, `web`, `broom`, `pumpkin`, `candle` or `gate` in `kit/`. A test searches for these words.
- One app never imports from another app.
- A game's `src/rules` never imports from `kit/shell`, `kit/mcp` or the DOM.
- `kit/core` has no dependency outside the TypeScript standard library.
- A new dependency needs its licence written in the task's log row. Only MIT, BSD, ISC or Apache 2.0 licences are allowed. A dependency that is used only by tests and never ships in a build or is linked into one may also use MPL-2.0 when the log row names the package, the licence and says it is a test only tool.
- One task changes one folder from the table. If a task needs a second folder, stop and say so.
- Write every text file as UTF-8 with no byte order mark and with LF line endings. On Windows, do not write files with PowerShell `Set-Content` or `Out-File`.

## Public surface
- Each kit package exports from one `index.ts`. Apps import only from that file.
- A change to an exported type in `kit/core` needs the conformance tests to pass for both games before the task ends.
