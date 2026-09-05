# What a session leaves behind

The consent gate asks two things. The first is required and is about the vendor: your voice is recorded
and sent to a third party. The second is optional, starts ticked, and is about us — *yes, I allow
anonymous data from this session to be used to improve the app*.

| | ticked | unticked |
|---|---|---|
| what the learner learned | kept | **kept** |
| everything that could name them | kept | erased within `RETENTION_TTL_MIN` (default **240 min**) |

Ticked is the app's whole prior behaviour, unchanged. Unticked, a tester leaves behind learnable counts
and nothing that could name them.

There are no accounts here, so this is not a data-subject request mechanism and there is no per-user
export or deletion. It is one switch, answered once, at the start of a sitting.

---

## Where PII lands

Read out of the writers and out of real session files. **Structured credit is not PII**: a learnable id
with `{attempts, successes}` against a random per-tab learner id names nobody.

| # | where | field(s) | why it is PII | unticked |
|---|---|---|---|---|
| 1 | `assets/turnlog/media/<id>.wav` | the learner's raw voice | a recording of a voice identifies its speaker | **never written** |
| 2 | `assets/turnlog/turns.jsonl` | `output.userVerbatim`, `output.userSaid` | exactly what they said — names, jobs, where they live | redacted |
| 3 | `assets/turnlog/turns.jsonl` | `output.tutorReply`, `output.correction` | the tutor repeats details back — observed: `"Živjo, Kris! Si študent?"` | redacted |
| 4 | `assets/turnlog/turns.jsonl` | `input.history[].text` | the whole conversation, both roles | redacted |
| 5 | `assets/turnlog/turns.jsonl` | `witness.targets[].said`, `witness.observed[]`, `witness.candidates[]` | verbatim slices of their speech | redacted |
| 6 | `assets/turnlog/turns.jsonl` | `live.channels[].said` | the learner line each live verdict rests on | redacted |
| 7 | `assets/sessions/<runId>.json` | `turns[].text`, `turns[].userVerbatim` | the same content, second copy | redacted |
| 8 | `assets/sessions/<runId>.json` | `turns[].audioKey` | `sha256` of the sentence — a hash to check a guess against | dropped |
| 9 | `assets/live/<sessionId>.json` | `transcripts[].text` (both roles) | the live conversation | redacted |
| 10 | `assets/audio/<sha256>.mp3` | synthesized tutor speech | a permanent recording of a sentence naming them | **never written** |
| 11 | `assets/manifest.jsonl` | `text` on the audio entry | the same sentence, in plain text beside the clip | **never written** |
| 12 | `assets/catalog-candidates.jsonl` | `surface`, `gloss` | unrecognised Slovene — a spoken name lands here | **never written** |
| 13 | `assets/gloss-cache.json` | `sl` key → gloss | any line whose English was tapped, tutor lines included | **never written** |
| 14 | the learner model | `facts` | see below | not PII |
| 15 | server stdout | error paths, `LIVE_DEBUG=1` vendor events | wherever the host keeps logs | host-dependent |
| 16 | the vendors | audio + text sent to Gemini / Grok / ElevenLabs | out of our control | vendor policy |

**The learner's name is never stored as a structured field.** The only fact in `server/catalog/facts.json`
is `gender` (`m`/`f`). A lesson asks for a name (`demo-1.json` node `c4`, *"Sem ___."*) and nothing
captures it. A name enters the system **only as speech** — rows 1–13, never row 14. That is what makes a
field-level redaction tractable: there is no identity column to find, only free text and audio.

Rows 15 and 16 are not addressed by the switch. `LIVE_DEBUG` prints vendor event *names*, not speech, and
the error paths log messages rather than transcripts — but a host's log retention is the host's, and what
a vendor keeps is the vendor's. Changing either is out of scope.

---

## Two mechanisms, and which one applies

**Redact on a timer — the session records** (rows 2–9). They are written in full, because an operator
debugging a tester's session needs them for the next few hours. The sweep then empties the text in place,
keeps ids, timestamps, providers, latencies, verdicts and durable counts, and stamps the record
`redactedAt` so it is idempotent and visible.

Progress survives a purge by construction: dropping whole rows would take `creditedCounts` with them, and
once the in-memory learner model is gone that row is the only durable record that the crediting happened.

**Never write — the shared, content-addressed stores** (rows 1, 10–13). These are keyed by *content*, not
by session: one `assets/audio/<sha256>.mp3` entry serves every learner **and every authored lesson clip**.
A sweep walking them would be guessing which entries it is allowed to delete, and guessing wrong deletes
lesson audio the deploy needs — `assets/` is gitignored and force-added, so a wrong deletion here is a
silently silent lesson on the next release (see [DEPLOY.md](DEPLOY.md) and `npm run lint:audio --shipped`).
The same is true of `gloss-cache.json`, where catalog-derived entries are free and permanent by design.

So a non-retaining session **reads** those stores freely — an authored clip is still a cache hit, and
costs nothing extra — and writes nothing into them. There is nothing to delete afterwards, and the
question "is this entry mine to remove?" never has to be asked.

The raw voice clip (row 1) is in this group for a different reason: it is the strongest PII in the
inventory, and a 30-minute TTL is still 30 minutes. A declining session leaves no clip at all.

---

## How the answer reaches the writers

`x-retain: 0` — a header beside `x-learner-id`, sent by `api()` in `public/app.js` and on the live create
call. **Absent means keep**, so any client that does not send it behaves exactly as before.

`/api/speak` is a `GET` an `<audio>` element makes, so it cannot carry a header: it takes `retain=0` as a
query parameter instead, and only the two call sites that speak *conversational* text set it. Authored
lesson and tutorial lines carry no learner content and do not.

The flag is then **persisted on each record** — `retain: false` on the turnlog row, the session record and
the live session log — because a sweep cannot ask the browser after the fact.

```
consent gate ─► sessionStorage ─┬─► x-retain header ─► retainOf(req) ─┬─► turnlog row     ─┐
                                │                                     ├─► session record  ─┤
                                └─► create body ─► PendingSession ────►└─► live session log ┴─► sweep
                                                                       └─► candidates / gloss cache (skip write)
     /api/speak?retain=0 ─────────────────────────────────────────────────► audio + manifest (skip write)
```

## The sweep

`server/assets/retention.ts`. No cron and no scheduler — it runs at startup and on every turn log write,
the same shape `sweepMedia` already uses. Best-effort: a failure logs and never breaks a turn.

```bash
npm run test:retention     # the writers + the sweep, against a temp asset dir. Bills nothing
RETENTION_TTL_MIN=0        # disables the sweep entirely
```

A record that says nothing about retention is a record from before this existed, and it is kept. The
default is today's behaviour in both directions.
