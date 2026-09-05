# Comparing the two speaking modes

The practice surface runs one lesson in either of two modes — **live** (continuous speech against a
realtime vendor) and **tap-to-speak** (hold the button, release, one `/api/converse` turn). The point of
running both from one screen is to answer two questions: which mode teaches better, and which provider is
better inside each mode.

The screen is the same in both. What is underneath is not, and the asymmetries below are what any
conclusion has to be read against.

## What each mode leaves behind

| | live | tap-to-speak |
|---|---|---|
| record | `assets/live/<sessionId>.json` | `assets/sessions/<runId>.json` + `assets/turnlog/` |
| speaker word | `user` / `tutor` | `student` / `tutor` |
| provider | per session, in the log | per turn, `provider` on the record |
| crediting | one grade at teardown, from the transcript | the evidence contract, per turn |

The join is the **run id**: the client mints one per sitting and sends it to both, so a live session and
the tap turns beside it name the same sitting.

```bash
npm run runs                  # every sitting, newest first, both modes with what each credited
npm run runs -- <runId>       # one sitting with both transcripts
npm run runs -- --json        # the same, normalised, for a scorer
```

`server/scripts/runs.ts` reads both stores and normalises each record to the same four facts and the same
transcript. It does not rewrite either store — the two shapes stay as they are, and the normalisation
lives in the one place that has to see both.

## Both modes move the learner model, by different routes

Tap-to-speak credits **per turn**: the model reports evidence in the same JSON that carries its reply,
and `mastery.creditFromEvidence` adjudicates it before the turn returns.

Live credits **once, at teardown**. A speech stream has no return path for an evidence contract, so
`server/live/prompt.ts` sends only the teaching half and the bookkeeping happens afterwards: when the
session ends, [server/live/grader.ts](../server/live/grader.ts) reads the finished transcript against the
target set the prompt froze at connect and produces the same `WitnessResult` envelope — which the same
firewall then adjudicates. Live gains credit without the app gaining a second way of granting it.

So the two halves of a sitting are comparable on per-learnable progress, and `npm run runs` prints what
each half moved. Read the difference against three asymmetries:

- **Live grades against a frozen set.** Tap re-selects its targets every turn as the learner progresses;
  a live session's are fixed at second zero.
- **Live's evidence is lower-fidelity.** A tap record separates `userVerbatim` from the English gloss; a
  live user line is the vendor's running hearing of continuous speech, and it can be plainly wrong about
  Slovene. The grader reads two channels rather than one because of it (live-tutor.md).
- **Live's SUCCESS bar is stricter**, so expect it to under-credit relative to tap until the two-channel
  record says otherwise.

## Naming a provider

Both modes take one per request, so two providers can be compared inside a single sitting without a
restart in between:

- **live** — `?provider=grok`, resolved per session (`server/live/registry.ts`).
- **tap-to-speak** — `?e2=<name>`, sent with each turn and resolved in `server/adapters/index.ts`.

A name that is not registered falls back to the configured one rather than failing the turn. Today
`E2_REGISTRY` holds one entry and `E3_REGISTRY` holds one, so there is nothing to switch to until a
second adapter lands; the voice provider (E3) is still chosen process-wide by `E3_PROVIDER`.

## Each sitting is its own learner

The learner model is held under a per-page-load id and kept in memory by default
([learnable-subsystem-spec.md](learnable-subsystem-spec.md) §2.3). That is what makes the comparison
trustworthy: "the same lesson" really is the same prompt for every tester, and alternating the two modes
no longer drifts a shared model underneath the comparison.
