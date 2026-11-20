# Kiro Web session, 20 November 2026

One real change was made in Kiro Web (app.kiro.dev), on the repository `Midknight56/skeleton-kit`, from the branch `kiro-breadth`.

## What was asked

One new file, `docs/replay-format.md`, that explains the replay file the kit writes (format 1): every field, its type and meaning, one real example copied from `proofs/garden/`, and how to run a replay (the `replay` tool of the tool door and `runReplay` in `kit/core`). Read the fields from the source, change no other file, open a pull request into `kiro-breadth`.

## What happened

| Step | Result | File |
| --- | --- | --- |
| Kiro Web session | The session finished and said it opened a pull request. It said the tool door call example was built from the proof file and not run against the server. | `01-kiro-web-session-done.jpg` |
| Pull request | Pull request 1, "Add replay format doc", author the Kiro agent app on GitHub, one file added (`docs/replay-format.md`, 103 lines), base `kiro-breadth`, head `docs-replay-format`. Merged on 2026-11-20 at 19:10:53 UTC. | `pr-1.json`, https://github.com/Midknight56/skeleton-kit/pull/1 |
| Check by hand | The call the document says the tool door answers for a good replay was sent to the built tool door: it answered `{"ok":true,"finalHash":"d836baac0f60ae09","finalPhase":"won"}`, as the document says. The nine error names in the document are all found in `kit/core/src/replay.ts` and `kit/core/src/session.ts`; the order of the checks was not compared line by line. | none saved |

## How Kiro Web differed from the CLI

- The Kiro Web sandbox had its network set to "Repository access only", so it could not download packages. It could read the repository but not run `npm install`, so no test ran in Kiro Web. That is why the change is a document and not code.
- Kiro Web made its own branch and its own pull request on GitHub. The CLI worked in a local folder and left the commit to the lane.
