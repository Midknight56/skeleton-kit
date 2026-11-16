---
inclusion: always
---
# Claims policy

- Never invent evidence, test output, measurements or user feedback. If a check did not run, say that it did not run.
- Say that Kiro did a piece of work only when Kiro did it in this repository.
- A proof file shows that a level can be finished under the rules in this repository. It is not a claim about fun, safety or difficulty for people.
- A statement about speed, privacy or accessibility needs a recorded check with a named tool. Without that record it is a target.
- Never weaken a test to make it pass. Keep the failing case and report it.
- Never edit a file in `proofs/` by hand. Run `npm run prove`.
- Add one row to `docs/kiro-log.md` for each finished task, on the same day. Leave the Credits cell empty. Kiro cannot read its own credit use. The owner fills that cell from the usage page.
- Name a hook in a demo or a write up only after it was seen to fire and the log records when.
