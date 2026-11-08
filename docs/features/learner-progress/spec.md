# Learner progress transfer

Durable progress is the stored learner model: `learnables`, `facts`, `flashcards` and the other fields
`shape` in `server/assets/learner.ts` keeps. History, transcripts, turn logs, events, improvement copies
and tester-code identity are not part of it. Three endpoints on `/api/me` move it between identities;
the learner is resolved as for every learner API (`x-tester-code` / `x-learner-id`).

## 1. Export

`GET /api/me/progress` returns the current learner's stored model as JSON. A learner with no file gets an
empty model. The response is the body `PUT` accepts.

## 2. Import

`PUT /api/me/progress` replaces the current learner's progress with the body, run through `shape`, so
junk fields and bad flashcard rows are dropped. Any id or tester code in the body is ignored. A body that
is not a JSON object is `400` and nothing is written. `updatedAt` is refreshed; `lastSeenAt` stays the
current learner's own. Returns the saved model.

## 3. Copy

`POST /api/me/progress/copy` with `{ "from": "<learner-id>" }` replaces the current learner's progress
with the stored model of `from`, which is left unchanged.

| Case | Result |
|---|---|
| `from` missing, not a filename-safe id, or a derived `t-` id | `400` |
| no stored model for `from` | `404`, current learner unchanged |
| `from` is the current learner | `200`, no change |

Import and copy replace; they never merge. Copy needs only the source id, which is the alpha trust level
for user-0 and staging.
