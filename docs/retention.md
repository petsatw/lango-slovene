# What a session leaves behind

This is the field-level map behind the retention rules in the
[consent and privacy spec](features/consent-privacy/spec.md#5-retention). Every record carries
`learnerId` and `testerCode` ([tester identity](features/tester-identity/spec.md#4-records-carry-the-learner)),
so the learner's own deletes, Delete my data and the sweeps can find it.

## Where personal data lands

| # | Where | Field(s) | Saved session | No-save session | Ends |
|---|---|---|---|---|---|
| 1 | `live/<sessionId>.json` | `transcripts[].text` (both roles), lesson, score | learning history | deleted right after scoring | per-session delete, Delete my data, 12-month sweep |
| 2 | `turnlog/turns.jsonl` | `output.userVerbatim`, `output.userSaid`, `output.tutorReply`, `output.correction`, `input.history[].text`, `witness.*`, `live.channels[].said` | learning history | the session's rows are deleted right after scoring | with its session |
| 3 | `sessions/<runId>.json` | `turns[].text`, `turns[].userVerbatim`, `turns[].audioKey` | learning history | — | with its session |
| 4 | `live/<sessionId>.gloss.json` | translations of the session's lines | learning history | deleted right after scoring | with its session |
| 5 | `improve/<sessionId>.json` | transcripts passed through `stripPersonal` | when the session has `improve: true` | never written | 90 days, consent withdrawn, with its session |
| 6 | `learners/<learnerId>.json` | learnable counts, `facts.gender`, `lastSeenAt` | kept | progress credit kept | Delete my data, 12-month sweep |
| 7 | `events/events.jsonl` | event rows, feedback `text` | kept | kept | Delete my data, 12-month sweep |
| 8 | `catalog-candidates.jsonl` | `surface`, `gloss`, `at`, passed through `stripPersonal` | written | written | 12 months |
| 9 | server stdout | error messages, `LIVE_DEBUG=1` vendor event names | — | — | host log retention, 30 days |
| 10 | the vendors | audio and text sent to Gemini, Grok and ElevenLabs | — | — | vendor terms |

The learner's name is stored only inside free text (rows 1–4). The one structured fact in
`server/catalog/facts.json` is `gender` (`m`/`f`).

## Stores that hold no learner content

- **Audio.** Microphone audio streams to the provider. A tap-to-speak clip lives in memory for its
  request. `turnlog/media/` stays empty.
- **`assets/audio/` and `manifest.jsonl`.** These hold authored lesson audio. Conversational replies are
  spoken through `/api/speak?cache=0`, which streams the audio and writes nothing.
- **`gloss-cache.json`.** This holds catalog lines. Live-line translations sit with their session
  (row 4).

These stores are content-addressed and shared by every learner and every lesson. Keeping learner content
out of them means a delete never has to decide which shared entry belongs to whom.

## The mechanisms

- **Per-session and full history delete:** see [learning history](features/learning-history/spec.md#4-what-a-delete-removes).
- **No-save session end:** scoring runs, then a `finally` deletes rows 1, 2 and 4 for that session. See
  [no-save session](features/no-save-session/spec.md#2-session-end).
- **Delete my data:** `deleteLearner` removes rows 1–7 for the learner. See
  [data deletion](features/data-deletion/spec.md#2-what-is-deleted).
- **Sweeps:** `server/assets/retention.ts` runs at startup and every 24 hours. It handles the 12-month
  inactivity rule, the 90-day improvement copies, the no-save backstop and the 12-month candidates rule.
  See [sweeps](features/data-deletion/spec.md#3-sweeps).

```bash
npm run test:retention     # the writers, deletes and sweeps against a temp DATA_DIR. Bills nothing
npm run delete-learner -- <code or learnerId>
```
