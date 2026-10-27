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

- For `finder_request`, the text box asks "What would you like to practise?".

## 2. Sheet

- A small sheet with a thumbs rating (`up` or `down`) and an optional text box of at most 1000
  characters. Send is enabled once a rating is chosen.
- **Send** calls `track("feedback_submitted", { surface, rating, hasText })` with the trimmed text as
  `text`, closes the sheet and shows "Thanks".
- Closing the sheet without sending records nothing.

## 3. Storage

- Feedback rows sit in the event log ([event row](../events/spec.md#2-row)), with `text` cut to 1000
  characters by the server.
- Delete my data and the 12-month inactivity sweep remove a learner's feedback
  ([data deletion](../data-deletion/spec.md#2-what-is-deleted)).
- Readout: `jq -r 'select(.name == "feedback_submitted") | [.ts, (.testerCode // "-"), .props.surface, .props.rating, (.text // "")] | @tsv' events.jsonl`
