# Live session

A live session runs on the tutor screen with one way out, "End session". When it ends, the learner sees
a short wrap-up: what they practised, the objectives they made progress on, a way to give feedback and
the way back to lessons.

## 1. End session

- From the create response until the session ends, the talk button reads "End session" and is enabled,
  in every live state (connecting, listening, speaking).
- Pressing it sends `{"type":"end"}` and opens the wrap-up (§2) titled "Session ended". The app keeps
  the session socket open until the progress result arrives (§3).
- The header back button ends the session and opens the previous screen.

## 2. Wrap-up

The wrap-up opens on the tutor screen when a session ends, in place of the transcript and the talk
controls.

### 2.1 Title

The title follows the `ending` field of the progress message (§3):

| `ending` | Title |
|---|---|
| `"ended"` | "Session ended" |
| `"time"` | "Session time reached" |

Until the progress message arrives, the title is "Session ended" after the learner pressed "End
session", and empty otherwise. When the socket closes before a progress message, the title is "Session
ended".

### 2.2 Lines

In this order:

1. The title (§2.1).
2. "You practised: {scenario}", where `{scenario}` is the `scenario` field of the create response
   (§3).
3. The progress block, which follows the progress result (§3):

   | Progress result | The block shows |
   |---|---|
   | still pending | "Checking your progress…" |
   | `objectives` with one or more entries | "You made progress on", then one line per objective with its `name` |
   | `objectives: []` | "This session was practice." |
   | `objectives: null`, or the socket closes before a result | "Progress couldn't be checked for this session." |

   The block updates in place when the result arrives.
4. "This conversation wasn't saved.", for a session started with "Don't save this session" ticked
   ([no-save session](../no-save-session/spec.md#1-switch)).
5. A "Give feedback" button. It opens the feedback sheet with surface `live_end`
   ([feedback](../feedback/spec.md#21-feedback-sheet)). Closing or sending the sheet returns to the wrap-up.
6. A "What next" button. It opens the lessons screen.

The wrap-up shows these lines and nothing else, for every ending. A new live session starts from the
lessons screen, through the tutor start screen
([tutor start screen](../consent-privacy/spec.md#1-tutor-start-screen)).

## 3. Progress result

- The create response (`POST /v1/live/sessions`) carries `scenario`: the name of the scenario the
  session's lesson belongs to (the scene for a scene id, the tree's scenario for a tree id), as
  `server/live/prompt.ts` resolves it.
- After `{"type":"state","status":"ended"}` the server keeps the socket open while `settleSession`
  checks the session ([session end](../no-save-session/spec.md#2-session-end)), at most
  `LIVE_GRADE_TIMEOUT_SEC` (default 60). It then sends one progress message and closes the socket.
- The progress message carries `ending`: `"time"` when the session time limit (`SESSION_TTL_SEC`)
  ended it (`ttlHit` in `finish()`, `server/live/index.ts`), and `"ended"` for every other ending
  (End session, a provider error, the socket closing).
- It carries `objectives`:
  - `{"type":"progress","ending":…,"objectives":[{"id","name"}…]}` when the check completes. The list
    holds the session's objectives (the learnables in its `objectives` message) whose learnable has a `success`
    verdict in the session's credit. A session with no learner speech gets `objectives: []`.
  - `{"type":"progress","ending":…,"objectives":null}` when the check fails or times out. The learner
    model is unchanged ([what stays](../no-save-session/spec.md#3-what-stays)).
- An objective's `name` is its learnable's `sl` in `server/catalog/learnables.json`, the line the
  objectives overlay shows.
- The result comes from the check in memory, so a no-save session gets its result while its files are
  deleted.
- After a completed check, a saved session's live log (`DATA_DIR/live/<sessionId>.json`) holds
  `progressed`: the ids in that list. The learning history reads it
  ([sessions](../learning-history/spec.md#1-sessions)).

## 4. Feedback during a session

- The floating "Feedback" chip ([feedback chip](../feedback/spec.md#4-feedback-chip)) is on the tutor
  screen from the create response until the learner leaves the wrap-up, beside the header "Feedback"
  link. The chip floats over the screen and is not one of the wrap-up lines (§2.2).
- The chip and the header link open the feedback sheet over the session. The session keeps running
  while the sheet is open: the socket stays open, the microphone keeps streaming, the tutor's speech
  keeps playing and the transcript keeps updating behind the sheet. Closing or sending the sheet
  returns to the session as it is by then.
- Opening the sheet sends nothing on the session socket and has no effect on the session time limit.
- The `feedback_submitted` event carries `screen: "live"` and the session's `lessonId`
  ([context](../feedback/spec.md#3-context)).
