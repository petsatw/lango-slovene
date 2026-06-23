# Architecture — present state

Govori is a voice tutor for everyday Slovene. You hold a button and speak — mixed English is fine —
the server understands you, replies in native Slovene, and corrects by recasting. It ships with
three scenarios (café, bakery, butcher) and an engine that generates new ones.

## Two load-bearing decisions

1. **The app owns the teaching, not the model.** Each objective moves `pending → recast → completed`
   under deterministic rules that live in the *server*. The prompt is rebuilt from that state every
   turn, so the model stays on a short leash: short turns, simple Slovene, recast corrections, learner
   does most of the talking.
2. **Everything provider-specific is an adapter.** Understanding (E2), voice (E3), and image
   generation (E4) sit behind adapters chosen by one `.env` line. Swapping a provider — or the
   language — never touches the core.

## One turn

```
hold button → record → POST /api/turn (audio + session state)
   → prompt built from session state
   → E2: understand mixed speech + reply in character → { reply, correction, objective progress }
   → server applies the mastery rules → updated session
   → GET /api/speak → E3 streams native Slovene audio (cached on the way through)
```

## The files that matter

| File | What it does |
|---|---|
| `public/app.js` | capture, call `/api/turn`, play the reply, show progress |
| `server/server.ts` | HTTP endpoints + the audio/image cache |
| `server/orchestrator.ts` | runs a turn: E2 understand + apply the mastery rules |
| `server/prompt.ts` | builds the tutor prompt from scenario + session state |
| `server/adapters/` | E2 understand · E3 voice · E4 image — swap by env |
| `server/scenarios/*.json` | the scenarios — **data, not code** |
| `server/assets/store.ts` | content-addressed cache for audio + images |
| `server/scripts/build-assets.ts` | materialize a scenario's audio + images |

The loop in one line: the tutor recasts an error in character, the learner gets one natural retry,
and an objective completes when the model judges it produced acceptably — mastery is *production*,
not recognition.

## The scenario engine

New scenarios aren't hand-written. A pipeline authors the Slovene, checks it with a deterministic
linter, and has an *independent* critic sign off before it ships; then `build:assets` materializes
the audio and images. The procedure is the
create-scenario skill (`.claude/skills/create-scenario`); the acceptance rubric every scenario must
pass is [scenario-authoring.md](scenario-authoring.md). Making that procedure tool-neutral is on the
[roadmap](ROADMAP.md).

## What's built today

The live turn loop, the mastery rules, three scenarios (each with its narrated story, flashcard
frames, and scene image), the generation engine and its gates, and the content-addressed asset store
— all running against real providers, verified end-to-end.

## Present limitations

The present-state facts the [roadmap](ROADMAP.md) is built to fix:

- **No persistence.** Session and conversation state are in-memory and per-sitting — closing the
  browser starts fresh. (Generated audio/image *assets* are cached durably; the *session* isn't.)
  This is why a persistent learner model is the keystone roadmap item.
- **Cross-scenario asset reuse is accidental.** The store is content-addressed on the finished prompt
  + anchor bytes, so two scenarios share an asset only when their keys happen to collide — no
  per-asset identity, no opt-in, and the one combined reference sheet forces every asset to re-render
  together. This is what the asset-engine refactor replaces.
- **Latency ≈6 s/turn.** Today E2 ≈5 s + E3 first-audio ≈1.4 s; Level-1 E3 streaming is done and the
  `E3Adapter.stream` seam exists. Level-2 (E2 token streaming + sentence pipelining → ~1–2 s) is planned.

**Where it's going:** [ROADMAP.md](ROADMAP.md).
