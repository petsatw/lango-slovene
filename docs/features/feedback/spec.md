# Feedback

Learners can say how a moment went at the points where it matters. Feedback text is the only free text in
the event log.

## 1. Points

| `surface` | Where |
|---|---|
| `level_end` | the end-of-level screen |
| `live_end` | the screen after a live session ends |
| `finder_request` | a "Request this scenario" button on a finder no-match, beside the live card |
| `header` | a "Feedback" link in the app header, on every screen that shows the header (lessons take feedback from their end screen) |

- `finder_request` opens the [Request a scenario sheet](#22-request-a-scenario-sheet); the other points
  open the [rating sheet](#21-rating-sheet).

## 2. Sheet

One sheet serves every point, in one of two layouts.

- The text box takes at most 1000 characters.
- **Send** calls `track("feedback_submitted", { surface, rating, hasText })` with the trimmed text as
  `text`, closes the sheet and shows "Thanks". `rating` is `up`, `down`, or `null` when no thumb is
  chosen.
- Closing the sheet without sending records nothing.

### 2.1 Rating sheet

For `level_end`, `live_end` and `header`:
- Title "Feedback", a thumbs rating (`up` or `down`), then an optional text box labelled "Anything to
  add? (optional)".
- Send is enabled once a rating is chosen.

### 2.2 Request a scenario sheet

For `finder_request`, the text leads and the rating is an optional add-on below it:
- Title "Request a scenario".
- A text box labelled "What would you like to practise?", with the placeholder "For example, ordering at
  a bakery".
- Below the text box, the line "How's Vadi so far? (optional)" with the thumbs rating.
- **Send** is enabled once the text box holds text. The rating has no effect on it.

## 3. Storage

- Feedback rows sit in the event log ([event row](../events/spec.md#2-row)), with `text` cut to 1000
  characters by the server.
- Delete my data and the 12-month inactivity sweep remove a learner's feedback
  ([data deletion](../data-deletion/spec.md#2-what-is-deleted)).
- Readout: `jq -r 'select(.name == "feedback_submitted") | [.ts, (.testerCode // "-"), .props.surface, .props.rating, (.text // "")] | @tsv' events.jsonl`
