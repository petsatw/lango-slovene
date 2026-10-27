# Events

The app records which screens and steps each tester uses, so the team can read one tester's timeline and
a funnel across testers. Events hold names, ids, counts and timings. Free text appears only in
`feedback_submitted`.

Events are first-party and pseudonymous. They are keyed to the learnerId and code, and nothing is sent
to a third-party analytics service. They are strictly necessary to run the alpha and are recorded
under legitimate interests, from the first app open.

## 1. Endpoint

`POST /api/event` with the body `{ "events": [ { "name", "ts", "props", "text"? } ] }`.

- At most 50 events and 16 KB per request. A larger request gets `413`.
- `name` must be in §4, and each prop key must be listed for that name. Prop values are strings
  (at most 64 characters), numbers, booleans or `null`. The server drops unknown names and keys.
- `text` is accepted only on `feedback_submitted`, and is cut to 1000 characters.
- The response is `204`.

## 2. Row

Each accepted event becomes one line in `DATA_DIR/events/events.jsonl`:

```json
{"name":"level_completed","ts":"2026-10-27T09:04:00.000Z","learnerId":"t-3f9a…","testerCode":"TEST-01","props":{"scenarioId":"bakery","level":1,"ms":180000}}
```

- `ts` is the client's ISO 8601 UTC timestamp.
- The server stamps `learnerId` and `testerCode` from the request
  ([tester identity](../tester-identity/spec.md#3-learnerid)). The client never sends them in the body.
- The file is append-only. Delete my data and the 12-month inactivity sweep remove a learner's rows
  ([data deletion](../data-deletion/spec.md#2-what-is-deleted)).

## 3. Delivery

- `track(name, props)` in `public/app.js` queues an event.
- The client sends the queue every 10 seconds, when it reaches 50 events, and on `visibilitychange` to
  hidden (with `navigator.sendBeacon`). A failed send is dropped.
- The server writes the live events (`gate_passed`, `live_started`, `live_ended`, `live_failed`) itself,
  using the same row.

## 4. Event list

| Event | Fired when | Props |
|---|---|---|
| `app_open` | the app loads | `standalone` (home-screen app), `isFirstOpen`, `path` |
| `tester_code_seen` | an invite link stores a code | — |
| `screen_viewed` | `showScreen` runs | `screen` (`home`, `practice`, `levels`, `a1`, `tutor`, `scene`) |
| `intro_completed` | a scene or level intro plays to the end | `kind` (`scene`, `level`), `id` |
| `intro_quit` | the learner leaves an intro early | `kind`, `id` |
| `level_started` | a level opens | `scenarioId`, `level` |
| `level_completed` | a level reaches its end | `scenarioId`, `level`, `ms` |
| `level_abandoned` | the learner leaves a level before its end | `scenarioId`, `level`, `ms`, `nodeId` |
| `handoff_tapped` | a "practise it live" entry is tapped | `from` (`home`, `finder`, `level`) |
| `gate_passed` | the server grants live access | `via` (`tester_code`, `access_code`) |
| `live_started` | a live session connects | `lessonId`, `provider`, `noSave` |
| `live_ended` | a live session ends | `lessonId`, `provider`, `sec`, `reason` (`user`, `ttl`) |
| `live_failed` | a live session cannot start or drops | `lessonId`, `provider`, `reason` (`error`, `capacity`, `forbidden`) |
| `finder_query` | a finder search is submitted | `resultCount` |
| `finder_no_match` | a submitted search shows no lessons | — |
| `finder_match_opened` | a finder result is opened | `scenarioId` |
| `feedback_submitted` | a feedback sheet is sent | `surface`, `rating`, `hasText`, plus `text` ([feedback](../feedback/spec.md#2-sheet)) |

The finder events record that a search happened and its outcome. The query text stays in the browser.

## 5. Readout

`jq` reads the log straight from the volume. Timeline, one row per event:

```bash
jq -r '[.ts, .learnerId, (.testerCode // "-"), .name, (.props|tojson)] | @tsv' events.jsonl
```

Funnel per learner (`app_open` → `level_started` → `level_completed` → `handoff_tapped` →
`live_started`), seconds from the first open to the first completed level, and the feedback count:

```bash
jq -s '
  ["app_open","level_started","level_completed","handoff_tapped","live_started"] as $steps |
  def t: sub("\\.[0-9]+Z$"; "Z") | fromdate;
  group_by(.learnerId) | map(
    (map(select(.name == "app_open"))[0].ts) as $open |
    (map(select(.name == "level_completed"))[0].ts) as $done |
    { learnerId: .[0].learnerId,
      testerCode: .[0].testerCode,
      funnel: (. as $ev | reduce $steps[] as $n ({}; .[$n] = ($ev | map(select(.name == $n)) | length))),
      firstLevelSec: (if $open and $done then ($done | t) - ($open | t) else null end),
      feedback: (map(select(.name == "feedback_submitted")) | length) })' events.jsonl
```
