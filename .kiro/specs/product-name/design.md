# Design Document

## Overview

The change is six text edits and one test file.

```text
site/index.html                                   title, logo label, logo text
power/skeleton-kit/plugin.json                    description
power/skeleton-kit/README.md                      heading
power/skeleton-kit/skills/play-and-prove/SKILL.md description
tests/docs/product-name.test.ts                   new
```

## The test

`tests/docs/product-name.test.ts` reads files only. It walks `site/`, `power/`, `apps/`, `kit/` and `tools/`, skips `node_modules`, `dist`, `.wrangler` and `test-results`, reads each text file (`.html`, `.css`, `.md`, `.json`, `.ts`, `.mjs`, `.js`, `.svg`, `.txt`) and fails with the file and line of each "Skeleton kit". The match is case sensitive, so the search keyword `skeleton kit` and the ids `skeleton-kit` are not hits.

It also checks the six places for "Skeleton Kit", so a file that loses the name does not pass.

## Not covered

`README.md` counts the specs, the tasks and the rows of the log, and its test fails after any new spec. This task is told not to edit `README.md`, so that count is left to the run that writes the README.
