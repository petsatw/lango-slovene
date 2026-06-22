# Architecture — Baseline & Trajectory

**Project:** Govori — AI voice tutor for everyday Ljubljana Slovene. Mobile-first PWA + Node server.
**Date:** 2026-06-15 · **Updated:** 2026-06-22
**Status:** Working MVP — three scenarios (café, bakery, butcher) authored by the scenario engine; real providers, verified end-to-end.

This captures what exists *today* as a stable baseline, the **extension seams** where future
features plug in, and the **trajectory** it is built toward (see *Vision & trajectory* below).
Anything not actually built is marked **[PLANNED]**.

## Vision & trajectory

Today this is a voice tutor with a working, gated **scenario-generation engine**. The trajectory is
an **immersive, generative language-learning platform** — *building with AI in Ljubljana, for
Ljubljana*, in the open.

- **Now:** native-quality, everyday-Ljubljana Slovene; a constrained mastery-scaffold tutor; an
  engine that authors new immersive scenarios on demand (lint + independent critic before ship).
- **Near [PLANNED]:** cross-session mastery (objectives resurface and harden across scenarios over
  time) and a learner-facing scenario selector — see *Planned features* #1, #4.
- **Bigger [PLANNED]:** the tutor as an agent that works *with* the learner — steering deeper or
  broader into whatever they care about — and an engine whose pedagogy scaffold and asset pipeline
  generalize beyond Slovene to other languages and places. The model layer is already abstracted
  behind swappable adapters; the pedagogy is language-shaped, not Slovene-specific.

---

## Guiding principle
The value is **not** "an LLM that talks to you" (that's the commodity that fails learners — verbose, accent-drifting, poorly calibrated). The value is a **structured mastery scaffold that uses the LLM but constrains it hard**: short tutor turns, simple Slovenian, recast corrections, learner does most of the talking. The app — not the model — owns the pedagogy. Everything below is built so that scaffold can grow.

## Surface
- **Mobile-first PWA** (`public/`), also works on desktop. Installable (manifest). No native app.
- **Push-to-talk** capture — deterministic turns, never cuts off a hesitant beginner, and doubles as the iOS audio-unlock gesture.

## Data flow (one turn)
```
[capture]  hold button → MediaRecorder (webm/mp4)
   → re-encode to 16 kHz mono WAV in-browser (Gemini accepts wav, not webm/mp4)
   → POST /api/turn { audioBase64, mimeType, history, session }
        → prompt built FROM session (objectives + statuses + tutor turn policy)
        → E2 adapter (Gemini): audio + prompt → JSON
             { userSaid, tutorReply, correction, objective_progress[], focus_objective_id }
        → orchestrator applies deterministic MASTERY RULES → updated session
   ← { tutorReply, correction, session } returned fast; dots + transcript update; observability overlay
   → GET /api/speak?text=<tutorReply>
        → E3 adapter (ElevenLabs eleven_v3): streamed mp3, teed into a server cache
   ← browser plays progressively (Level 1 streaming); replay serves from cache (instant, no re-bill)
```
The **mastery loop** is the session-aware spine: the prompt is rebuilt from objective state each turn,
the model reports per-objective production, and the server (not the model) owns the pending→recast→completed
rules. See [mastery-loop-spec.md](mastery-loop-spec.md).

## Components
| Path | Role |
|---|---|
| `public/app.js` | capture, WAV encode, turn request, streaming playback, per-bubble replay, observability overlay |
| `public/index.html` / `styles.css` / `manifest.webmanifest` | PWA shell + UI |
| `server/server.ts` | endpoints (`/api/config`, `/api/health`, `/api/turn`, `/api/speak`), provider-agnostic audio cache |
| `server/orchestrator.ts` | session-aware `understand()` (E2 + mastery rules, used by /api/turn) and `runTurn()` (full, used by replay) |
| `server/adapters/` | `E2Adapter` (Gemini), `E3Adapter` (ElevenLabs), `index.ts` registry selected by env |
| `server/scenarios.ts` + `server/scenarios/*.json` | scenario + objective data as one JSON per scenario (café, bakery, butcher active); each carries the visual `scene` field (assets, story, frames) |
| `server/prompt.ts` | `buildSystemPrompt(scenario, session)` — character, **objectives + statuses**, recast policy, turn policy, JSON contract |
| `server/types.ts` | swappable adapter contracts + session/objective types |
| `server/probes/` | `e2`/`e3` contract probes + `replay` harness (real services, no mocks) |

## Endpoints
- `GET /api/config` — active providers + scenario opening (no secrets).
- `GET /api/health` — liveness.
- `POST /api/turn` — audio → tutor text + correction (E2 only; fast).
- `GET /api/speak?text=` — streamed Slovenian audio (E3), cached for replay (`X-Audio-Cache: hit|miss`).

## Swap seams (already abstracted)
- **E2 provider** — implement `E2Adapter`, register, set `E2_PROVIDER`. (For the blind A/B.)
- **E3 provider/voice** — implement `E3Adapter` (`synthesize` + optional `stream` + `voiceTag`), set `E3_PROVIDER`. Cache and replay work for any provider.
- **Scenario / tutor behavior** — `server/prompt.ts` builds the system prompt from scenario data; scenarios are JSON in `server/scenarios/` (café, bakery, butcher), authored by the engine.

## Verification approach
Test the seams with **real** services; never mock the heart. `probe:e2`, `probe:e3`, `replay` (real recorded/real-TTS clips through the live pipeline), plus a live observability overlay showing each stage + latency. See [README](../README.md).

## Known state / limitations (today)
- **Mastery loop: built** — objective-driven sessions, constrained recast tutor, deterministic mastery gating, takeaway. Three scenarios (café, bakery, butcher), authored by the engine.
- **Voice quality**: `eleven_v3` is the only ElevenLabs model covering Slovenian; native quality not yet judged by ear / blind A/B.
- **History/session**: client holds conversation history + session state in memory; nothing persisted across reloads/restarts (audio cache is in-memory, bounded 200).
- **Asset reuse is implicit and colliding (observed)** — the asset store is content-addressed on the *finished prompt + anchor bytes*, so cross-scenario reuse happens silently whenever two scenarios produce the same key (e.g. `greet`/`ask_price`/`pay_leave` audio + frames hit cache across café/bakery/butcher). That is convenient now but it is reuse *by accident, not by intent*: there's no per-asset identity, no opt-in, and the combined per-scenario **reference sheet** forces every asset to be re-rendered together and bound to one sheet, so a single asset can't be varied (outfit/setting) without disturbing the others. This is already pushing us toward the cross-session architecture sooner than planned — see Planned feature #5.

## Scenario & objective design — research basis (the "scenario-generation engine")
Any future scenario-generation engine (whether hand-authored or model-generated) MUST enforce the acceptance criteria and learning-loop design distilled from an 8-expert stochastic-consensus panel (2026-06-20). The panel was scoped to three questions, *given exactly the tools this app already has*: how to construct the learning loop; the acceptance criteria for an "excellent" scenario and for each objective; and whether the feature set suffices when in-person practice is unavailable (and what would make it *exceed* unstructured in-person chit-chat).

- **Synthesized outcome (start here):** [SUMMARY.md](research/scenario-engine-expert-panel-2026-06-20/SUMMARY.md) — the unified learning loop, the **"excellent SCENARIO" rubric** and **"excellent OBJECTIVE" rubric** (the acceptance criteria the engine must satisfy), the sufficiency verdict, and a prioritized buildable-now vs. net-new backlog. (Also mirrored at `.consensus-runs/2026-06-20-mastery-loop-expert-panel.md`; the `docs/` copy is the canonical, repo-durable one.)
- **Detailed per-expert transcripts (full reasoning, one `.jsonl` each):** in [research/scenario-engine-expert-panel-2026-06-20/](research/scenario-engine-expert-panel-2026-06-20/) —
  [`01` SLA acquisition researcher](research/scenario-engine-expert-panel-2026-06-20/01-sla-acquisition-researcher.jsonl) ·
  [`02` working speaking tutor / polyglot](research/scenario-engine-expert-panel-2026-06-20/02-working-speaking-tutor.jsonl) ·
  [`03` adult expat learner](research/scenario-engine-expert-panel-2026-06-20/03-adult-expat-learner.jsonl) ·
  [`04` cognitive scientist (memory/retrieval)](research/scenario-engine-expert-panel-2026-06-20/04-cognitive-scientist-memory.jsonl) ·
  [`05` psycholinguist (speech production)](research/scenario-engine-expert-panel-2026-06-20/05-psycholinguist-speech-production.jsonl) ·
  [`06` Slovene sociolinguist / pragmatics](research/scenario-engine-expert-panel-2026-06-20/06-slovene-sociolinguist.jsonl) ·
  [`07` conversation / voice-interface designer](research/scenario-engine-expert-panel-2026-06-20/07-voice-interface-designer.jsonl) ·
  [`08` behavioral / habit designer](research/scenario-engine-expert-panel-2026-06-20/08-behavioral-habit-designer.jsonl) ·
  [`09` synthesis agent](research/scenario-engine-expert-panel-2026-06-20/09-synthesis.jsonl).

Load-bearing conclusions (see SUMMARY for the full rubrics): an objective is one self-contained, in-character-elicitable utterance; `targetSL` is a whole formulaic chunk a native actually says; difficulty **ratchets down** on failure; the story is a comprehensible-input preview; and the single highest-value net-new investment is **cross-session spaced review**.

**The scenario-generation engine = three coordinated parts** (one MVP/PLANNED split runs across all of them):
- **Rubric (the "CI")** — [scenario-authoring.md](scenario-authoring.md): what an excellent scenario, objective, story, asset bible, and **atomic flashcard** must satisfy. The engine self-verifies against this before submission. *Active / MVP.*
- **Generation pipeline (operating model)** — [asset-engine-spec.md › Scenario-generation pipeline](asset-engine-spec.md): `[request] → generate full package + internal verification → [submit] → [reject & revise | approve & commit]`, PR-style (nothing surfaced half-built). *MVP: make it run end-to-end; waste accepted.*
- **Asset / image engine** — [asset-engine-spec.md › M1–M4](asset-engine-spec.md): the store, the per-scenario **reference sheet** (BUILT), the **flashcard-creation step** (LLM derives the atomic concept → minimal unambiguous depiction → prompt) + **minimal-compose render mode** (atomic flashcards; MVP, new), the scene image, and `build:assets`.

**Who does what** (judgment vs. logic vs. generation, and the requestor/creator/language-subagent/asset-generator handoffs) is the **[scenario-engine-contract.md](scenario-engine-contract.md)** — the interface the MVP skill implements.

**MVP components:** content generation (scenario / objectives / story per rubric) · per-scenario reference sheet (built) · flashcard-creation step + minimal-compose render (new) · scene image (built) · audio via `build:assets` (built) · internal verification against the rubric · PR-style approve-&-commit gate. MVP keeps today's **single-attempt recast + retry**.
**PLANNED (ride with the cross-session orchestration layer — feature #4 below):** **enforced uptake** · **accepted-variant acceptance sets** · **cross-scenario shared asset catalog** · cross-session spaced review.

## Planned features (stubbed, not built)
1. **Scenario selector / choose-your-own-adventure** — a selector of scenarios the student can master next. Default view = relevant scenarios that build on recently completed objectives; a separate **Completed** section for review. *Stub:* `scenarios.ts` declares planned scenarios with `status: "planned"` and `/api/config` returns the list; no selector UI yet. *(Scenario/objective design governed by the rubrics in [SUMMARY.md](research/scenario-engine-expert-panel-2026-06-20/SUMMARY.md).)*
2. **Visual story panels** — a short (≤5-sentence) simple-Slovenian story with story-panel frames that set the stage and give an audio+visual preview of the session's objectives; plus a scene backdrop. *Stub:* an optional `scene { image, story }` field on a scenario, marked PLANNED; not rendered. *(Story-as-comprehensible-input-preview, ending on the tutor's opening line — see [SUMMARY.md](research/scenario-engine-expert-panel-2026-06-20/SUMMARY.md).)*
3. **Latency Level 2** — E2 token streaming + sentence-level pipelining to cut time-to-first-audio toward ~1–2s (today: E2 ~5s, E3 first-audio ~1.4s, total ~6.4s; Level 1 E3 streaming is done). *Stub:* PLANNED; the streaming seam (`E3Adapter.stream`) already exists for E3.
4. **Persistent learner model (cross-session objective mastery)** — a per-student store that persists every objective the student has been *presented* with, across sessions, with a richer lifecycle than the in-session loop:
   - **attempted** — presented with / tried the objective.
   - **completed** — output was correct and met the objective (a single correct production). *(This is what today's in-session loop currently calls "mastered".)*
   - **mastered** — completed correctly **multiple times**, either by repeating a session/objective **or** because the same objective recurred in a *different* scenario.
   - Requires a **shared cross-cutting objective catalog**: common objectives that appear across many scenarios — e.g. `greet` ("dober dan" / "dobro jutro"), `how_do_you_say`, `can_you_repeat`, `didnt_understand` ("oprostite, nisem razumel") — are defined once and referenced by id, so a correct production *anywhere* counts toward the same objective's mastery. Scenario-specific objectives stay local.
   - **Storage:** keyed by student id; survives reloads/sessions (vs. today's in-memory, per-sitting `SessionState`). New layer — a `LearnerProfile` above `SessionState`.
   - **Feeds Feature 1:** the scenario selector's **Completed** section and its "recommend scenarios that build on recently completed objectives" default view read from this store.
   - **Terminology reconciliation:** the in-session enum is now `pending → recast → completed` (already renamed from "mastered" to reserve that term). **mastered** is reserved for the cross-session/multi-completion bar defined in this feature. *Stub:* PLANNED; no learner store or shared catalog yet.
   - **Enforced uptake (rides here):** the expert panel's highest-value mechanic — completing an objective only via a *later, unaided* reproduction of the recast — is **deliberately NOT in the MVP**. Genuine uptake needs repetition across turns, contexts, and days; forcing it inside a single session risks a repetitive doom loop with no real payoff. It belongs to this cross-session layer, where the same objective recurs in different scenarios over time and a correct *cold* production (not an in-session echo) advances `completed → mastered`. MVP keeps the single-attempt recast + retry. See [scenario-authoring.md › Scope](scenario-authoring.md).
   - **Cross-scenario image consistency [PLANNED]:** the visual analogue of the shared objective catalog. As the same student walks café → bakery → butcher over many sessions, the recurring visual assets — above all the student (`CUSTOMER`) and money (`EURO_COINS`) — must stay *identical* across scenarios, or the flashcard↔scene↔cross-scenario binding that teaches each phrase breaks. (Abstract concepts like greet/goodbye are NOT single icons — they're composed contrastively from `CUSTOMER` + the scenario's doorway + direction; the shared piece is the consistent `CUSTOMER`.) Today consistency is hand-copied per scenario (fragile); the fix is a **shared asset catalog** (canonical descriptor + pinned reference render per asset, referenced by label) — spec'd in [asset-engine-spec.md › Cross-scenario consistency](asset-engine-spec.md). This is not just an asset concern: deciding *which* assets recur, in *what order* a learner meets scenarios, and *when* an objective resurfaces is the same scheduling problem as mastery — so an **orchestration layer over `LearnerProfile`** owns both. It manages learning over time: it sequences scenarios, schedules objective resurfacing/uptake, and guarantees the shared catalog (objectives *and* visual assets) stays coherent as content grows. The shared objective catalog, enforced uptake, and the shared asset catalog are three faces of this one layer. **Feature #5 is the asset-engine refactor that makes this catalog mechanically possible.**

5. **Modular per-asset references + reuse-by-intent (asset engine refactor) [PLANNED]** — the current model (one combined per-scenario **reference sheet** anchoring every frame + scene, plus a content-addressed byte store that reuses across scenarios *by accident* whenever keys collide) does not scale and is already creating reuse problems (see Known limitations). The target architecture, for scale + modularity:
   - **Per-asset visual reference, composed dynamically.** Each asset (character, object, setting, icon) owns its **own** reference render — not a slot in a shared sheet. When generating a scene or frame, the engine **combines the relevant per-asset references algorithmically/dynamically** into the reference image passed to the generator (≤N refs chosen by the depiction's labels), instead of anchoring everything to one monolithic sheet. This lets one asset change (a new outfit, a new setting, a different object) without re-rendering or disturbing the others, and removes the sheet as a single interior cascade node.
   - **Unique by default; reuse only when asked.** A scenario builder generates its assets **uniquely for that scenario by default**. Reuse of a character / object / phrase across scenarios is **explicit opt-in** (reference a catalog asset by id), never an implicit consequence of a colliding content-address key. The default flips from today's accidental-reuse to deliberate-isolation.
   - **Identity-consistent, not render-identical, characters.** Consistency must be at the level of **identity/features**, not pixels: the main character (`CUSTOMER`) and recurring NPCs (the café owner, the butcher) must appear in **different settings and different outfits while keeping consistent facial/identity features**. The café owner stays recognisably the same person session to session; the objects on the counter change freely so the learner can practise ordering different things. This is a stronger, more flexible consistency model than "pixel-identical asset reuse" and is what makes the same character usable across many scenarios.
   - **Why it rides with #4:** the shared asset catalog (canonical per-asset reference + identity model + opt-in reuse) is the visual half of the cross-session orchestration layer; building #5's per-asset/dynamic-compose engine is the precondition for the catalog described above. *Spec home:* [asset-engine-spec.md](asset-engine-spec.md) (per-asset references + dynamic composition + identity-consistency to be added there). *Stub:* PLANNED; today's combined sheet + accidental byte-reuse is the interim.

## Extension seams for future features (feature-agnostic)
The baseline is built so the following can be added without re-architecting:
1. **Session / objective state** — a new layer above `orchestrator` that holds a session's learning objectives, tracks per-objective mastery, and shapes the E4 prompt per turn. (No such layer yet — the prompt is static.)
2. **Tutor turn policy** — constraints on tutor verbosity / learner talk-time / mastery-gating live in `prompt.ts` + orchestration; tightening them is additive.
3. **Visual layer** — the PWA can render a scene backdrop + storyboard frames; assets (static or generated) and a `scene` field on the scenario are the only new pieces.
4. **Content/sequencing** — vocabulary/objective sequencing (spiral/interleaving) is a data + prompt concern, above the providers. *(Sequencing/interleaving/spacing principles + acceptance rubrics: [scenario & objective design research](research/scenario-engine-expert-panel-2026-06-20/SUMMARY.md).)*
5. **Takeaway artifact** — end-of-session summary ("you can now…") composes from the turn history already held client-side.
6. **Learner profile (persistent)** — a per-student store above `SessionState` records attempted/completed/mastered per objective across sessions, against a shared cross-cutting objective catalog. The session loop already emits per-objective verdicts (`objective_progress`); persisting and aggregating them across sessions is the new piece. (Powers Planned feature #4.)

These are described as *seams*, not commitments — which feature lands first is the open decision.

## Scaling

How the baseline grows toward the platform vision without re-architecting:

- **Content scale (engine-driven).** Scenarios are *data*, authored by the engine, so coverage grows
  by generation rather than hand-coding. The two scale preconditions are already specced:
  cross-session orchestration (Planned feature #4) and the per-asset / reuse-by-intent asset engine
  (Planned feature #5). *[PLANNED]* beyond what those features describe.
- **Provider scale (actual).** The model layer is abstracted behind swappable `E2`/`E3` adapters
  selected by env, so providers can be A/B-tested or swapped without touching the app. Cost/repro is
  bounded by the content-addressed asset store + cache + surgical regen.
- **Language / market scale [PLANNED].** The pedagogy scaffold (constrained tutor, mastery loop) and
  the asset pipeline are language-shaped, not Slovene-specific; extending to another language is a
  content + rubric effort over the same engine, not a rebuild. No second language is built yet.
- **Multi-learner scale [PLANNED].** Today's session/audio state is in-memory and per-sitting; a
  persistent `LearnerProfile` (Planned feature #4) and durable storage are required before
  many concurrent learners are supported.

## Community [PLANNED]

The repo already ships its authoring engine — the `create-scenario` skill and its subagents
([../.claude/](../.claude/)) — so the generative core is forkable and inspectable, not hidden. The
project actively wants non-code participation as much as code: suggesting scenarios, native-speaker
review of Slovene naturalness, and helping it reach people in and around Ljubljana. A `CONTRIBUTING.md`
defining these roles and the "suggest a scenario" path is **[PLANNED]**; see [../README.md](../README.md)
for current framing.

## Licensing [PLANNED]

The intent is to build and share this **in the open**. A specific license has **not yet been chosen**
— this is an open decision (e.g. a permissive MIT/Apache-2.0 vs. a copyleft option), and no `LICENSE`
file exists yet. Until one is added, default copyright applies; treat reuse as "ask first."
