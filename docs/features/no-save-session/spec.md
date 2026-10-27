# No-save session

Before every live session the learner can choose not to save it. A no-save session is scored and then
removed, whatever the scoring outcome.

## 1. Switch

- "Don't save this session" sits on the tutor start screen
  ([tutor start screen](../consent-privacy/spec.md#1-tutor-start-screen)), shown before every live
  session.
- It starts at its last position (`localStorage.noSave`), and that position starts off.
- The live session create body carries `noSave: true` when it is on. The session log records
  `noSave: true`.

## 2. Session end

`finish()` in `server/live/index.ts` runs these steps in order:
1. Write the live log, as for every session.
2. Run `creditSession`: score the transcript and credit the learner model.
3. In a `finally` after step 2, for a no-save session, delete:
   - `DATA_DIR/live/<sessionId>.json`
   - the turn-log rows with that `sessionId`
   - `DATA_DIR/live/<sessionId>.gloss.json`

Step 3 runs when scoring succeeds, fails or times out. Scoring has a time limit of
`LIVE_GRADE_TIMEOUT_SEC` (default 60).

## 3. What stays

- The learner model keeps the progress credit and lesson score from a successful grade.
- When scoring fails or times out, the learner model is unchanged: no progress credit and no lesson
  score are recorded, and step 3 deletes the transcript as usual.
- The session is absent from the Learning history and produces no improvement copy.

## 4. Backstop

The startup sweep deletes any no-save live log, and its turn-log rows and translations, whose session
ended or passed `SESSION_TTL_SEC`. This covers a server stop between steps 1 and 3
([sweeps](../data-deletion/spec.md#3-sweeps)).
