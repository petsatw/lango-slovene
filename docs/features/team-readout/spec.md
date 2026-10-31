# Team readout

The team reads the event log and a summary of each live session over HTTPS with a key, so a routine can
check that the events fire, read the feedback and file findings without access to the volume. The
readout is read-only and holds no transcripts.

## 1. Endpoint

`GET /v1/team/events?since=<iso>&cursor=<opaque>&limit=<n>`, served by `server/team.ts` and registered
in `server/server.ts`.

- One endpoint returns event rows and live session summaries in one order, with one cursor. Each row
  carries `kind`: `event` or `live_session` (§6).
- The response is `200` with `{ "rows": [...], "next": "<cursor>" | null, "more": true | false }` and the
  header `Cache-Control: no-store`.
- GET only. Every other method on the path gets the server's 404 for an unknown path, and writes
  nothing.

## 2. Access

- The key is the env var `TEAM_READ_KEY`. When it is unset or empty, the route answers as an unknown
  path: the same `404` status and body as any path the server does not serve.
- A request carries the key as `Authorization: Bearer <key>`. A missing header, another scheme or a
  wrong key gets that same `404`. The readout has one consumer, which holds the key, so a `404` costs it
  nothing and tells anyone else nothing about the route.
- The server hashes the presented key and `TEAM_READ_KEY` with SHA-256 and compares the two digests with
  `crypto.timingSafeEqual`.
- The server never writes the key or the `Authorization` header to stdout, stderr or a response. A
  readout error logs its message only.
- The key is at least 32 random bytes (for example `openssl rand -base64 32`). It is set in the host's
  env and kept in the team's secret store; it never appears in the repo, an issue or a chat. Changing
  the env var and redeploying retires the old key, which then gets `404`.

## 3. Rate limit

- At most 30 requests per key in each 60-second window, counted in memory in `server/team.ts`. A request
  over the limit gets `429` with `Retry-After` in seconds.
- Only requests that pass §2 are counted. Others get `404` and leave the count unchanged, so the limit
  never reveals the route.

## 4. Query

| Parameter | Meaning | Invalid |
|---|---|---|
| `since` | ISO 8601 time; only rows with `ts` at or after it | `400` |
| `cursor` | the `next` of an earlier response; only rows after that point (§5) | `400` |
| `limit` | rows per page: an integer, default 500; a value above 1000 is cut to 1000 | below 1 or not an integer: `400` |

- `since` and `cursor` can be sent together; both apply.
- A `400` body is `{ "error": "<parameter>" }`. Parameters are checked only after the key (§2).

## 5. Order and cursor

- Rows are sorted by `ts`, oldest first and newest last. Rows with the same `ts` are sorted by their row
  key: for an event row, the SHA-256 of its line in `events.jsonl` followed by `#n` for the nth
  identical line; for a live session, `live:<sessionId>`.
- **Settled rows only.** A response holds rows whose `ts` is at least 5 minutes before the request. A
  newer row waits for a later pull. The 5 minutes cover a client's 10-second send interval
  ([delivery](../events/spec.md#3-delivery)) and the grading window (`LIVE_GRADE_TIMEOUT_SEC`) in which a
  live log gains `progressed`.
- `next` is an opaque string that encodes the `ts` and row key of the last row in the page. A page with
  no rows returns the request's `cursor` as `next`, or `null` when the request sent none.
- `more` is `true` when settled rows follow the page.
- **Resuming.** A routine stores `next` and sends it as `cursor` on its next run, and keeps pulling
  while `more` is `true`. Each settled row then reaches the routine once. An event whose client `ts`
  arrives at the server more than 5 minutes after that time (a device clock running behind) sorts
  before a stored cursor, so a resumed pull skips it; a pull with `since` and no cursor returns it.
- The cursor is a position in `ts` order, so it stays valid when rows are deleted
  ([data deletion](../data-deletion/spec.md#2-what-is-deleted)). Deleted rows are absent from every
  later response.

## 6. Rows

### 6.1 Event

One row per line of `DATA_DIR/events/events.jsonl` ([event row](../events/spec.md#2-row)):

```json
{"kind":"event","name":"feedback_submitted","ts":"2026-10-27T09:04:00.000Z","learnerId":"t-3f9a…","tester":true,"props":{"surface":"live_end"},"text":"…"}
```

- `name`, `ts`, `learnerId` and `props` are copied from the line, and `text` on `feedback_submitted`.
- `tester` is `true` when the line's `testerCode` is set. The code itself is not returned: a tester code
  opens the live tutor, and `learnerId` already groups a tester's rows
  ([learnerId](../tester-identity/spec.md#3-learnerid)).
- No other field of the line is returned. A line that does not parse is skipped.

### 6.2 Live session

One row per saved live log, `DATA_DIR/live/<sessionId>.json`
([live session](../live-session/spec.md#3-progress-result)):

```json
{"kind":"live_session","ts":"2026-10-27T09:14:00.000Z","sessionId":"…","learnerId":"t-3f9a…","tester":true,"lessonId":"…","provider":"grok","start":"2026-10-27T09:04:00.000Z","end":"2026-10-27T09:14:00.000Z","reason":"ttl","error":null,"progressed":[{"id":"…","name":"…"}]}
```

- `start` is the log's `startedAt`. `end` and `ts` are its `endedAt`.
- `reason` uses the values of `live_ended` and `live_failed` ([event list](../events/spec.md#4-event-list)):
  `error` when the log's `error` is set, `ttl` when `endedAt` minus `startedAt` reaches
  `SESSION_TTL_SEC`, and `user` otherwise.
- `error` is the log's error code, or `null`.
- `progressed` lists the log's `progressed` ids, each with `name`: its learnable's `sl` in
  `server/catalog/learnables.json`, as the wrap-up shows it. It is `null` when the log has no
  `progressed` (the check failed).
- `tester` follows §6.1.
- The row holds these fields only: no `transcripts`, `credit`, `lessonScore`, `runId` or `retain`.
- A log with `noSave: true` gives no row ([no-save session](../no-save-session/spec.md#2-session-end)).
  The session shows in the event rows as `live_started` with `noSave: true`, then `live_ended` or
  `live_failed`.
- Only files named `<sessionId>.json` with a 36-character session id are read; translation files
  (`<sessionId>.gloss.json`) are not.

## 7. Privacy

- Rows are pseudonymous: `learnerId` and `tester`. No IP address, user agent, request header, tester
  code or transcript text is returned. Feedback `text` is the only free text.
- A learner's rows leave the readout when Delete my data or the 12-month sweep removes them from the
  files ([data deletion](../data-deletion/spec.md)). The readout reads the files on every request and
  keeps no copy.
- The repo is public. Findings the team files there quote or paraphrase feedback without `learnerId`,
  and never include a tester code or the key.

## 8. The team's routine

Shep runs a routine against staging that:
1. Pulls from its stored cursor until `more` is `false`, and stores the last `next`.
2. Checks the event rows against the [event list](../events/spec.md#4-event-list) and the pairs it
   implies, such as `live_started` followed by `live_ended` or `live_failed`, and each `live_ended`
   against its session summary.
3. Summarises the feedback `text` by `surface`.
4. Files findings as issues.

## 9. Check

`npx tsx server/probes/team-readout-test.ts` runs the server against a temp `DATA_DIR` with seeded
events and live logs and checks §1 to §7.
