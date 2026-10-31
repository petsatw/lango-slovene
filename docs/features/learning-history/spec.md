# Learning history

A learner's saved sessions are their learning history. They can list them, read each transcript and
delete one or all.

## 1. Sessions

- A history entry is a saved live session (`DATA_DIR/live/<sessionId>.json`) or a saved tap-to-speak
  session (`DATA_DIR/sessions/<runId>.json`) whose `learnerId` is the requester's.
- Each entry has: `id`, `kind` (`live` or `tap`), `lessonId`, `scenario`, `startedAt`, `endedAt`,
  `progressed`, and `transcripts` (`[{ ts, role, text }]`).
- `scenario` is the name of the scenario the lesson belongs to.
- `progressed` lists the learner-facing names of the objectives the session made progress on, `[]` when
  there are none:
  - live: the live log's `progressed` ids
    ([progress result](../live-session/spec.md#3-progress-result)), each named by its learnable's `sl`
    in `server/catalog/learnables.json`
  - tap: the session record's `finalObjectives` with status `completed`, each named by its objective's
    `label` in `server/scenarios/<scenarioId>.json`

## 2. Endpoints

All endpoints act on the requester's learner, resolved by `learnerOf(req)`
([learnerId](../tester-identity/spec.md#3-learnerid)).

| Request | Result |
|---|---|
| `GET /api/history` | `200`, entries without `transcripts`, newest first |
| `GET /api/history/:id` | `200`, one entry with `transcripts` and `id`; `404` when the entry belongs to another learner or does not exist |
| `DELETE /api/history/:id` | `204`; deletes the entry (§4); `404` as above |
| `DELETE /api/history` | `204`; deletes every entry of the learner |

## 3. Screen

- "Learning history" opens from Settings
  ([Settings](../consent-privacy/spec.md#3-settings)) and lists the entries, two lines each:
  1. "{scenario} · {date}": the entry's `scenario`, and `startedAt` as a date in the learner's locale.
  2. "Progress on {objective}, {objective}": the entry's `progressed` names joined by ", ". An entry
     with `progressed: []` shows "Practice".
- Tapping an entry shows its transcript.
- Each entry has a Delete action. It asks "Delete this session? Your progress stays." first.
- The list has "Delete all". It asks "Delete all your saved sessions? Your progress stays." first.

## 4. What a delete removes

For each entry:
- the live log or session record
- the turn-log rows with its `sessionId` or `runId`
- its translations (`DATA_DIR/live/<sessionId>.gloss.json`)
- its improvement copy (`DATA_DIR/improve/<sessionId>.json`)

The learner model `DATA_DIR/learners/<learnerId>.json` stays, with its progress credit.

## 5. Owner access

- History and learner endpoints read only the requester's own learner.
- `GET /api/learner?id=` reads another learner only when `OPERATOR_TOOLS=1`.
- A derived id (`t-…`) is reachable only through its code
  ([learnerId](../tester-identity/spec.md#3-learnerid)).
