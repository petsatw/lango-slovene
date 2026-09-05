# The live tutor — continuous speech, two vendors, one app

Everything else in this app speaks in turns: the learner records an utterance, the server answers it,
the exchange advances one round trip at a time. The live tutor does not. The mic stays open, the tutor's
voice arrives while it is still being spoken, and the learner can talk over it.

It exists to answer one question — **which realtime vendor tutors Slovene better** — and it is built so
that question can be asked cleanly: the app cannot tell which vendor it is talking to, both vendors get
the same prompt, and each session leaves a transcript you can diff.

It is **internal-testing only**. It is also the one surface in this codebase that meters a vendor by the
minute, which is why it is closed by default and why the ceilings below exist.

---

## The shape

```
browser  ──POST /v1/live/sessions──►  create: access code, lesson, ceilings   (server/live/index.ts)
browser  ──WSS /v1/live/sessions/{id}?token=…──►  bridge
                                                    ├─ GrokAdapter    (server/live/adapters/grok.ts)
                                                    └─ GeminiAdapter  (server/live/adapters/gemini.ts)
```

Same seam as E2/E3/E4: the core names a slot, an env var names the vendor, and nothing above the adapter
knows which answered. The one difference is direction — a live session is a long-lived bidirectional
stream, so the adapter is constructed with callbacks and pushed audio rather than awaited for a result.

Vendor API keys are on the server and only on the server. The browser holds a short-lived session token
that is useless anywhere else.

---

## The app contract (frozen, provider-blind)

| | |
|---|---|
| Audio up | PCM16 LE, mono, **16 kHz**, ~100 ms frames, binary WS frames |
| Audio down | PCM16 LE, mono, **24 kHz**, binary WS frames |
| Control | JSON text frames |

Client → server: binary audio, and `{"type":"end"}`.

Server → client: binary audio, plus
`{"type":"transcript","role":"user"|"tutor","text":…}`,
`{"type":"state","status":"connected"|"listening"|"speaking"|"ended"}`,
`{"type":"error","code":"vendor_connect"|"vendor_setup"|"vendor_audio"|"ended"}`.

The create response deliberately **omits the provider**. Vendor error bodies stop at the adapter — they
carry account and quota detail, and the app has no use for either.

Mic capture, playback scheduling and barge-in are the app's ([public/live.js](../public/live.js)); the
server only forwards. Barge-in is measured locally on mic energy rather than waiting for the vendor to
report an interruption, because a round trip is exactly the delay that makes talking over someone feel
broken.

---

## The prompt is the production prompt

A live session runs the **same instructions the free-chat surface runs on** — the app's actual workhorse
tutor prompt, not a prompt written for the vendor test. [server/live/prompt.ts](../server/live/prompt.ts)
builds the same three inputs a free-chat turn builds and hands them to the shared body in
[server/prompt.ts](../server/prompt.ts):

- **the witness selection** — `familiar` (everything the learner has touched: the tutor's palette) and a
  bounded `targets` set (capped at 8) led by this lesson's produced learnables, exactly as the
  rehearsal→free-chat handoff selects them;
- **the role** — the scenario's pinned Slovene role noun (`natakarica`), or the decide-one-now block if
  the scenario names none;
- **the scene** — the situation and what this level just practised, in English priming.

So the tutor arrives knowing the register, the persona, the situation, the learner's whole usable
vocabulary, and what to steer toward — and it is held to the turn policy (short lines, Slovene-only,
recast-don't-lecture, answer "how do you say…?", let the learner talk more).

`conversationTeachingBody` is one string with two callers, so **the live tutor cannot drift from the
production prompt**: changing how the tutor teaches changes it in both places, and free chat would show
the same change.

One thing is appended, forced by the medium: a short **spoken tail** replaces free chat's JSON evidence
contract, because a speech model handed an output schema would try to say it out loud. It also fixes the
opening on «Začnemo?», the same static line free chat opens with and the one the learner already knows
from the tutorial. Crediting happens after the session instead — see below.

And one difference that is not cosmetic: the prompt is built **once, at connect**. Free chat is stateless
and rebuilds it every turn, so its targets re-select as the learner progresses. A live session's targets
are frozen at second zero, and the grader scores that same frozen set — a set re-selected afterwards
would be marking a different exam from the one that was sat.

Read the exact string before a run:

```bash
npm run prompt:live -- restaurant-l1     # no args lists the lesson ids
```

---

## Crediting a live session — one grader, two channels

The session is over before any of this runs. Nothing blocks, nothing gates the learner's turn, and no
extra response is asked for mid-conversation; when the socket closes and the transcript is written,
[server/live/grader.ts](../server/live/grader.ts) reads it.

It reads **two accounts of what the learner said**, which fail independently:

- **the ASR channel** — the learner's own transcript line, the vendor's hearing of them. Read
  deterministically by [server/live/match.ts](../server/live/match.ts).
- **the comprehension channel** — the tutor's reply to that line, produced from the *audio* rather than
  from the transcript. Observed staying right in a session where the transcript went wrong.

A single **grader** reads both. It is a text call over the finished transcript, not the live model, and
it runs with a grader instruction rather than the tutor's persona: a tutor is built to accept imperfect
input warmly, so an in-character judgement conflates rapport with correctness.

| verdict | rule |
|---|---|
| **attempt** | either channel fires, and the line is Slovene. Granted liberally — a beginner who tried is the thing being measured. |
| **success** | both channels fire **on the same line**, the form is judged correct, and the tutor did not recast it. |

Echoing a phrase the tutor has just modelled still counts: the lessons are heard-first, and "unaided"
means **not recast**, not "not modelled". One channel alone is never upgraded to a success.

### Matching, not transcribing

The targets are a closed set of at most eight known phrases, so this is **detection**, not
transcription — open-vocabulary Slovene accuracy is not what it rests on. `match.ts` case-folds, strips
diacritics and punctuation, then tries three things in order: the canonical surface, a **recorded
mishearing** (`Živjo` → "Zero"), and edit distance over a same-length window. A pattern's frame is its
literal word runs in order, so "Eno ___, prosim." lands on *Eno kavo prosim*.

The same set — literal runs plus the aliases — goes to Grok as `audio.input.transcription.keyterms`
beside `language_hint`. It costs nothing and attacks a mishearing at its source. Gemini Live documents
no hint list, so there it reaches the vendor through the prompt alone.

Grow the alias list from real sessions: a target the tutor plainly answered while the learner's own line
read as something else is an alias waiting to be written down.

```bash
npm run test:live-match                      # the matcher, on plain inputs
npm run probe:live-credit                    # list recorded sessions
npm run probe:live-credit -- <sessionId>     # grade one, read-only, writes nothing
```

### What it leaves behind

Credit rides the same firewall tap mode uses (`mastery.creditFromEvidence`: allowlist → produced →
Slovene → the cited span is in the transcript → success or attempt), and the same store. Live gains
credit, not a second way of granting it. Two records come out of it:

- `assets/live/<sessionId>.json` gains `credit` — the per-learnable verdicts the session earned.
- one `path: "live"` row in `assets/turnlog/turns.jsonl`, carrying the grader's input, the durable counts
  after crediting, and **each channel separately**. That last part is why the row exists: how often the
  two channels agree accrues from ordinary running, with no experiment to schedule.

Nothing new is retained. The grader reads a transcript that was already written, and only the verdict
outlives the session — no second transcription pass, and no learner audio kept to run one.

---

## Ceilings (what stands in for authentication)

There are no accounts in this app. For an internal bake-off there don't need to be — what has to be true
is narrower: a stranger who finds the URL cannot open a metered vendor socket, and no single run can bill
unbounded.

| Ceiling | Where | Default |
|---|---|---|
| `LIVE_ACCESS_CODE` | one shared string, checked on create | **unset = closed** |
| One-use session token | minted on create, redeemed by the WS upgrade, 60 s | — |
| `SESSION_TTL_SEC` | hard stop on one session's minutes | 600 |
| `LIVE_MAX_CONCURRENT` | simultaneous sessions, pending included | 3 |

**Set a provider-side spend cap before the first session.** These are the server's own ceilings; a cap
that exists only in our code is a cap we can bypass. See [SECRETS.md](SECRETS.md) §6.

---

## Running the comparison

```bash
LIVE_ACCESS_CODE=<shared string> LIVE_PROVIDER=grok npm run dev
```

Open `/?lesson=<lessonId>`, go to the Live AI tutor screen, press **Go live**. The access code is asked
for once and kept in localStorage.

A tester may name the provider per session — `/?lesson=restaurant-l1&provider=grok` — which is better
than restarting between runs: the same person, the same lesson, back to back, is the comparison you
actually want. Arriving from a rehearsal instead carries that lesson automatically.

The prompt is built from **this session's** learner, taken from the `x-learner-id` the create call
carries, so two testers running the same lesson at the same time are given the same prompt.

Each session writes `assets/live/<sessionId>.json`:

```json
{ "sessionId": "", "runId": "", "lessonId": "", "provider": "gemini|grok",
  "startedAt": "", "endedAt": "",
  "transcripts": [{ "ts": "", "role": "user|tutor", "text": "" }], "error": null,
  "credit": [{ "id": "zivjo", "result": "success|attempt" }] }
```

`credit` is written by a second pass once grading finishes, so it is absent on a session that produced no
speech, put no targets in play, credited nothing, or whose grade failed.

`runId` is the **sitting** — the id the same tester's tap-to-speak turns are recorded under. It is what
lets `npm run runs` put one mode's run next to the other's; see
[mode-comparison.md](mode-comparison.md).

Transcripts and nothing else — scoring *Slovene-only, on-plan, English leak, recovery* is a read of the
transcript. Like `assets/sessions/`, this is learner speech and **stays out of the deploy**
([DEPLOY.md](DEPLOY.md)).

---

## Vendor notes

Verified against vendor docs, September 2026. Both adapters carry the citation in their header comment.

**Grok** (`wss://api.x.ai/v1/realtime`) — the audio format is a nested object, and 16000 is an accepted
input rate, so we declare 16 kHz in / 24 kHz out and **no resampling happens anywhere**. The user's
transcript arrives cumulative and the tutor's as deltas; both are buffered and emitted once, so the log
holds one line per utterance rather than a hundred partials. The Slovene `language_hint` is best-effort —
if xAI rejects the code the adapter retries once without it and keeps the Slovene-only prompt.

**Gemini** (`BidiGenerateContent`) — `responseModalities` lives inside `generationConfig` while
`inputAudioTranscription`/`outputAudioTranscription` are top-level `setup` fields; nesting all three
together silently drops the transcripts the whole comparison is scored on. The socket is backend→Google
and authenticates with the API key directly. Ephemeral tokens (`BidiGenerateContentConstrained`) exist so
a *browser* can hold the socket without holding the key; that is not this topology, and the constrained
endpoint stays available if a direct-from-browser mode is ever wanted.

## Known unknowns

- Neither adapter has yet completed a session against a **real key** — both were exercised end to end
  with a dummy credential, which proves the transport, the ceilings, the teardown and the log, and
  proves nothing about the vendors' own event streams. Expect the first real run to need a fix.
- With a dummy key xAI answers the upgrade with **400**, not 401. Worth a second look on the first real
  connect: a 400 could equally mean a malformed model or query parameter.
- **Expect the strict SUCCESS bar to under-credit at first.** A beginner's correct-but-accented
  production is exactly the one most likely to garble, so requiring both channels will miss real
  successes. The trade is deliberate — a false success corrupts the learner model, a missed one only
  slows it — and the two-channel turnlog row is what will show whether the bar wants loosening.
- Safari/iOS is unverified. `AudioContext({sampleRate})` has historically been ignored there — the
  resample in `live.js` covers it, but the PWA audio path as a whole has not been exercised.
