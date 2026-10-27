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

| The session ended by | Title |
|---|---|
| the learner pressing "End session" | "Session ended" |
| the lesson-completion signal ({xref: lesson-completion signal, docs/features/live-session/spec.md section TBD}) | "Session complete" |
| the session time limit, `SESSION_TTL_SEC` | {title: time-limit ending, TBD} |
| a provider error | {title: provider-error ending, TBD} |

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
5. A "Give feedback" button. It opens the rating sheet with surface `live_end`
   ([feedback](../feedback/spec.md#1-points)). Closing or sending the sheet returns to the wrap-up.
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
  `LIVE_GRADE_TIMEOUT_SEC` (default 60). It then sends one message and closes the socket:
  - `{"type":"progress","objectives":[{"id","name"}…]}` when the check completes. The list holds the
    session's objectives (the learnables in its `objectives` message) whose learnable has a `success`
    verdict in the session's credit. A session with no learner speech gets `objectives: []`.
  - `{"type":"progress","objectives":null}` when the check fails or times out. The learner model is
    unchanged ([what stays](../no-save-session/spec.md#3-what-stays)).
- An objective's `name` is its learnable's `sl` in `server/catalog/learnables.json`, the line the
  objectives overlay shows.
- The result comes from the check in memory, so a no-save session gets its result while its files are
  deleted.
- After a completed check, a saved session's live log (`DATA_DIR/live/<sessionId>.json`) holds
  `progressed`: the ids in that list. The learning history reads it
  ([sessions](../learning-history/spec.md#1-sessions)).
