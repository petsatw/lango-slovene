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
| crediting | none | the full evidence contract |

The join is the **run id**: the client mints one per sitting and sends it to both, so a live session and
the tap turns beside it name the same sitting.

```bash
npm run runs                  # every sitting, newest first, both modes on one line each
npm run runs -- <runId>       # one sitting with both transcripts
npm run runs -- --json        # the same, normalised, for a scorer
```

`server/scripts/runs.ts` reads both stores and normalises each record to the same four facts and the same
transcript. It does not rewrite either store — the two shapes stay as they are, and the normalisation
lives in the one place that has to see both.

## Only tap-to-speak moves the learner model

Crediting rides the JSON evidence contract in `buildConversationPrompt`, and a speech stream has no
return path for it, so `server/live/prompt.ts` uses only the teaching half (`conversationTeachingBody`).
A live session teaches and credits nothing.

**So "which mode is more useful" cannot be answered from learner progress** — only one mode produces any.
The comparison has to be scored some other way (transcripts, operator judgement), or live-mode crediting
has to be built first. That is an open decision, not a detail.

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
