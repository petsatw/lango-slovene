# Feedback

Learners can say how things are going at any moment, in their own words. Feedback text is the only free
text in the event log. Sentiment is read from that text together with the event data around it.

## 1. Points

| `surface` | Where |
|---|---|
| `level_end` | the "Feedback" button at the end of a tap dialogue and on the spoken-lesson close |
| `live_end` | the "Give feedback" button on the live wrap-up ([wrap-up](../live-session/spec.md#22-lines)) |
| `finder_request` | a "Request this scenario" button on a finder no-match, beside the live card |
| `header` | the "Feedback" link in the app header, on every screen that shows the header |
| `chip` | the floating "Feedback" chip (§4) on the dialogue, spoken-lesson and live screens |

- `finder_request` opens the [Request a scenario sheet](#22-request-a-scenario-sheet); every other point
  opens the [feedback sheet](#21-feedback-sheet).

## 2. Sheet

One standard sheet serves every point: a title, a labelled text box and Send.

- The text box takes at most 1000 characters. Text is required: **Send** is disabled until the box holds
  text that isn't blank.
- **Send** calls `track("feedback_submitted", { surface, screen, scenarioId, level, lessonId })` with the
  trimmed text as `text`, closes the sheet and shows "Thanks". The context props follow §3.
- Closing the sheet without sending records nothing.

### 2.1 Feedback sheet

For `level_end`, `live_end`, `header` and `chip`:
- Title "Feedback".
- The text box label follows the point:

  | `surface` | Label |
  |---|---|
  | `level_end`, `live_end` | "How did this go for you?" |
  | `header`, `chip` | "Let us know what you think." |

### 2.2 Request a scenario sheet

For `finder_request`:
- Title "Request a scenario".
- A text box labelled "Describe what you want to learn", with the placeholder "For example, booking a
  table at a restaurant".

## 3. Context

Each `feedback_submitted` event carries where the learner was when they opened the sheet:

- `screen`: `dialogue` while the tap-dialogue overlay is open, `spoken` on the spoken-lesson screen,
  `live` on the tutor screen during a live session and on its wrap-up, and otherwise the id of the
  screen showing (`home`, `practice`, `levels`, `a1`, `tutor`, `settings`, `history`).
- In a tap dialogue or spoken lesson: `scenarioId` and `level` of that lesson.
- In a live session or on its wrap-up: `lessonId` of that session, as in `live_started`.
- Props that don't apply are left out.

## 4. Feedback chip

- A floating chip labelled "Feedback" is on screen for the whole time the tap-dialogue overlay, the
  spoken-lesson screen or a live session (including its wrap-up) is showing, from the first frame,
  through an intro and at the end.
- It sits fixed in a corner of the viewport, above the overlay, and covers no lesson control: the
  choices, the dialogue controls ([dialogue lesson](../dialogue-lesson/spec.md#2-controls)), the talk
  button, the run chips or the live talk button.
- Tapping it opens the feedback sheet (§2.1) with surface `chip`, over the screen. Closing or sending
  the sheet returns to the same place:
  - A tap dialogue keeps its conversation and choices as they were.
  - A spoken lesson keeps its current state: the sheet neither pauses nor advances it. A line that is
    playing plays to its end, and the lesson waits for the learner's next tap as usual.
  - A live session keeps running, with the microphone and the tutor's speech as they were
    ([live session](../live-session/spec.md#4-feedback-during-a-session)).

## 5. Storage

- Feedback rows sit in the event log ([event row](../events/spec.md#2-row)), with `text` cut to 1000
  characters by the server.
- Delete my data and the 12-month inactivity sweep remove a learner's feedback
  ([data deletion](../data-deletion/spec.md#2-what-is-deleted)).
- Readout: `jq -r 'select(.name == "feedback_submitted") | [.ts, (.testerCode // "-"), .props.surface, (.props.screen // "-"), (.props.scenarioId // .props.lessonId // "-"), (.text // "")] | @tsv' events.jsonl`
