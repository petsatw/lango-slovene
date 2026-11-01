# Testing

The repo's checks are the probes in `server/probes/` and the lints in `server/scripts/lint-*.ts`. Each one
earns its place by catching something real.

## 1. What a check covers

A check stays in the repo when it does at least one of these:

- **Proves a behaviour a spec describes**, by driving the app or server and asserting what a learner or
  the team would see or record. It fails when that behaviour breaks.
- **Guards against a regression that has happened**: a bug that reached `mvp`, staging or a walkthrough,
  named in the check by the issue or PR that fixed it.
- **Validates authored content** (dialogues, trees, audio, A1 map) that the app reads, so a broken
  content file is caught before it ships.

## 2. What a check leaves out

- Guards against regressions that have never happened.
- Assertions that restate the implementation (the same constant, regex or function the code uses) or
  that pass whatever the code does.
- One-off checks, such as a rename scan. These are run once during review and are not committed.

## 3. Running

- Each probe runs on its own: `npx tsx server/probes/<name>-test.ts`, printing PASS or the failing check.
- Probes that need a live provider key say so in their first line and run only where the key is set.
