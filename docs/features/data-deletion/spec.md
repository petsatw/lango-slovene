# Data deletion

A learner can erase everything Vadi holds about them in one step. Vadi erases it on its own after 12
months without use.

## 1. Delete my data

- "Delete my data" in Settings ([Settings](../consent-privacy/spec.md#3-settings)) asks for
  confirmation, then calls `DELETE /api/me`.
- The server deletes the learner's data (§2) and returns `204`. The app then shows the home screen with
  a fresh learner. The stored code stays, so the code continues to work.

## 2. What is deleted

`deleteLearner(learnerId)` in `server/assets/deletion.ts` removes:
- the learner model `DATA_DIR/learners/<learnerId>.json`, with progress, gender and `improve`
- every history entry and what it removes
  ([what a delete removes](../learning-history/spec.md#4-what-a-delete-removes))
- the learner's rows in `DATA_DIR/events/events.jsonl`, feedback included
- the learner's improvement copies

`npm run delete-learner -- <code or learnerId>` runs the same function for a request that arrives by
email.

## 3. Sweeps

`sweep()` in `server/assets/retention.ts` runs at startup and every 24 hours. It handles four cases:

| Case | Action |
|---|---|
| A learner whose `lastSeenAt` is more than 12 months ago | `deleteLearner` |
| An improvement copy more than 90 days old | delete the copy |
| A no-save live log whose session ended or passed `SESSION_TTL_SEC` | delete it, with its turn-log rows and translations ([backstop](../no-save-session/spec.md#4-backstop)) |
| A candidate row more than 12 months old | drop the row |

- The learner model carries `lastSeenAt`. Every request that resolves the learner updates it, at most
  once an hour.
- `npm run test:retention` runs the sweeps against a temp `DATA_DIR`.
