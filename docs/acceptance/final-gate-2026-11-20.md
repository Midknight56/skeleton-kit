# Full gate, 20 November 2026

Command, from the repository root, on the branch `kiro-breadth` at commit `46decff`, started at 7:48 PM after the process list showed no game running (the owner's rule for a whole gate):

```
npm run verify:e2e
```

Result: exit code 0.

| Part | Result |
| --- | --- |
| Type check, lint, builds of the kit, the apps and the site | passed |
| Unit and property tests (`vitest run`) | 96 test files, 1334 tests passed |
| Proof check (`npm run prove -- --check`) | passed |
| End to end tests (`playwright test`, headless, 4 workers) | 133 passed in 56.6 seconds |

The kit repository's own tool door, the proofs and the tests were run on one Windows machine. This page is a record of that run. It is not a claim about other machines.
