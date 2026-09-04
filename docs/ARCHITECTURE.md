# Architecture

Govori is a voice tutor for everyday Slovene. You hold a button and speak — mixed English is fine —
the server understands you, replies in native Slovene, and corrects by recasting. It ships with four
scenarios (café, bakery, butcher, pharmacy) and an engine that authors new ones.

This is the **keystone document**. It explains what the system is, what you can do with it, why it's
shaped the way it is, and how the parts fit — then points to the satellite docs that carry the depth.
Read it top to bottom to get oriented; follow the links when you need detail. A full file index is available in [FILE-MAP.md](FILE-MAP.md), and exact schemas/endpoints are documented in
[DATA-MODEL.md](DATA-MODEL.md).

**Contents**

- [What it is](#what-it-is)
- [What you can do with it](#what-you-can-do-with-it) — the capability surface
- [The load-bearing decisions](#the-load-bearing-decisions) — why it's shaped this way
- [The shape](#the-shape) — components and boundaries
- [One turn, and the mastery rules](#one-turn-and-the-mastery-rules)
- [The teaching model](#the-teaching-model)
- [The asset model](#the-asset-model) — the relational ontology
- [State and persistence](#state-and-persistence)
- [The scenario engine](#the-scenario-engine)
- [What's built vs. what's next](#whats-built-vs-whats-next)
- [Map of the docs](#map-of-the-docs)

## What it is

A learner opens the app, picks a situation (ordering a coffee, buying bread), and has a short spoken
exchange with an in-character native speaker. They can preview the situation as a narrated picture
story first, practice the key phrases solo, then do the live exchange — held to a few minutes, with
the tutor doing less talking than the learner. Every run is recorded so it can be replayed later.

Underneath, the teaching is **owned by the app, not the language model**: the server tracks what the
learner is meant to produce, decides when each objective is met, and rebuilds the model's instructions
from that state on every turn. Everything provider-specific — understanding, voice, images — sits
behind a swappable adapter. New scenarios aren't hand-written; a quality-gated engine authors them.

## What you can do with it

The two audiences are the **learner** (the browser app) and the **operator** (someone running,
extending, or authoring content for the system). While the heart of the app is live turn-based tutoring, as much as possible learner-facing content is served from durable caches — replays, story narration, and practice to minimize expensive asset generation and maintain consistency. 

### Learner (the browser PWA)

| Capability | What it does | Where |
|---|---|---|
| **Push-to-talk turn** | Hold to speak (mixed EN/SL is fine); get an in-character spoken Slovene reply that recasts errors; objective dots update from the server's verdict. | [`public/app.js`](../public/app.js) · `POST /api/turn` · `GET /api/speak` |
| **Story preview** | Before speaking, step a narrated picture story — one frame per objective (image + SL line + audio), opening on the full-scene tableau. Comprehensible-input priming. | story player · `GET /api/image` · `GET /api/config` |
| **Rehearse (branching dialogue)** | Click through a pre-authored **decision-tree** version of the exchange — pick a line, hear it, reveal the English — at ascending competency levels. Comprehensible-input rehearsal before the live mic; no mastery credit. | 🎭 Rehearse · [rehearsal-dialogues.md](rehearsal-dialogues.md) · `GET /api/config` · `GET /api/speak` |
| **Free practice** | Hear the canonical phrase for each objective, record your own attempt **locally**, play it back to compare. No upload, no API spend. | practice panel |
| **Live progress** | Objective dots `pending ○ → recast ◐ → completed ●`; an end-of-session takeaway lists the phrases you can now say, each replayable. | objective dots · takeaway |
| **Past runs / replay** | Every run is captured. Reopen the list, replay any run turn-by-turn (free, from the store), and **name** or **favorite** a run. | `GET /api/sessions` · `GET /api/sessions/:id` · `POST /api/sessions/:id/meta` |
| **Scenario picker** | Switch among active scenarios (planned ones are listed but disabled); each boots a fresh session. | `GET /api/config?scenarioId=` |
| **Live observability** | An on-screen overlay mirrors state, active providers, what was heard (verbatim), the reply, the recast note, and timings — so failures are visible, not mysterious. | overlay |

### Operator (CLI + env)

| Capability | Command / surface | Notes |
|---|---|---|
| **Run / serve** | `npm run dev` · `npm run start` | thin Node/Express server; serves the PWA, `/api`, and `/gallery`. |
| **Probe a provider** | `npm run probe:e2` · `npm run probe:e3` | cheap credential/latency check before a large run. |
| **End-to-end verify** | `npm run replay` · `npm run test:mastery` | real recorded audio through the full pipeline / through the mastery loop. |
| **Author a scenario** | the create-scenario skill · `npm run lint:scenario` | deterministic lint gates the skill; a `--self-directed` mode discovers the next scenario itself. See [scenario-authoring.md](scenario-authoring.md). |
| **Materialize assets** | `npm run build:assets -- <id> [--regen frame:<obj>\|scene\|audio:…]` | builds a scenario's audio + frames + scene; `--regen` surgically re-rolls one leaf. |
| **Render catalog assets** | `npm run render:asset` · `npm run render:concept` | render one object/character, or a composed concept/location. |
| **Re-key without regenerating** | `npm run rekey:assets [-- --restyle\|--harvest\|--apply]` | move bytes to new keys when the picture is unchanged — billing-free. See [asset-pipeline.md](asset-pipeline.md). |
| **Inspect / audit** | `GET /gallery` (live) · `npm run prompts` · `npm run prune:assets` | visual catalog index; exact prompts + provenance; remove unused assets. |
| **Swap a provider** | `E2_PROVIDER` / `E3_PROVIDER` / `E4_PROVIDER` env vars | implement the adapter interface, register it, flip the env var — the core never changes. |

The full command-to-file mapping is in [FILE-MAP.md](FILE-MAP.md); the asset toolkit and the
render-vs-rekey decision model are in [asset-pipeline.md](asset-pipeline.md).

## The load-bearing decisions

1. **The app owns the teaching, not the model.** Each objective moves `pending → recast → completed`
   under deterministic rules that live in the *server* (see [the mastery rules](#one-turn-and-the-mastery-rules)).
   The prompt is rebuilt from that state every turn, so the model stays on a short leash: short turns,
   simple Slovene, recast corrections, learner does most of the talking.
2. **Everything provider-specific is an adapter.** Understanding (E2), voice (E3), and image
   generation (E4) sit behind adapters chosen by one `.env` line. Swapping a provider — or, later, the
   language — never touches the core.
3. **Scenarios are data, not code.** A scenario is a JSON file (`server/scenarios/*.json`) that
   references shared assets by catalog id. Adding one is authoring data, not changing the engine.
4. **Visible assets are a relational catalog, built once.** Every depictable thing is a node with a
   stable id; scenes are *composed* from those nodes and anchored to a build-once location "set". Cost
   is *sets + scenes*, not *sets × scenes* — the film/game model. See [The asset model](#the-asset-model).
5. **Assets are content-addressed.** A clip or image is keyed by its inputs, so identical inputs reuse
   the same file automatically and a changed input is a new, safe key. Reuse is automatic; regeneration
   is explicit and billing-free to undo. See [asset-pipeline.md](asset-pipeline.md).
6. **The live session is ephemeral; the artifacts are durable.** Per-sitting learning *progress* lives
   in the browser and resets on reload, but every *run* is recorded to disk and every generated asset
   is cached durably. See [State and persistence](#state-and-persistence).

## The shape

```
 browser PWA  ──/api──►  thin Node server  ──adapters──►  E2 understand (Gemini)
 (public/)               (server/server.ts)               E3 voice     (ElevenLabs)
   capture/play            holds keys                      E4 image     (Grok)
   story · practice        runs the turn
   replay · dots           applies mastery rules     ──►  durable stores (on disk)
   live SessionState       serves PWA + assets + gallery     · asset store (audio+images)
   (in memory)                                               · session records
```

- **Client** — a browser PWA in [`public/`](../public/). It captures audio, plays replies, and runs the
  story / practice / replay UIs and the objective dots. It holds the live `SessionState` (objective
  progress for the current sitting) in memory and talks **only** to `/api` — keys never reach it.
- **Server** — a thin Node/Express process, [`server/server.ts`](../server/server.ts). It holds the
  keys (from `.env`), runs a turn, applies the mastery rules, and serves the PWA, the asset endpoints,
  and the live gallery. It is stateless between requests apart from a small hot-audio LRU.
- **Providers — the three external slots.** Numbered for the pipeline stage they own:
  - **E2 — understand.** One model hop takes the learner's audio + history + the rebuilt system prompt
    and returns the verbatim hearing, an English gloss, the in-character Slovene reply, a recast note,
    and a per-objective verdict. (Currently Gemini.)
  - **E3 — voice.** Native-quality Slovene text-to-speech, with progressive streaming. (Currently
    ElevenLabs.)
  - **E4 — image.** Scene/frame/asset image generation with reference-image anchoring. (Currently Grok.)

  There is **no E1**: a separate speech-recognition stage isn't needed because E2 understands the audio
  directly. Each slot is one adapter interface in [`server/adapters/`](../server/adapters/); swap by env
  var. The interfaces are in [DATA-MODEL.md](DATA-MODEL.md).
- **Durable stores** — the content-addressed **asset store** (audio + images,
  [`server/assets/store.ts`](../server/assets/store.ts)) and the **session records**
  (`assets/sessions/*.json`). Both survive restarts.
- **The scenario engine** — an out-of-band authoring pipeline (a skill + scripts) that writes scenario
  JSON and materializes its assets. It is **not** part of the request path; see
  [The scenario engine](#the-scenario-engine).

The request surface (every `/api` route + `/gallery`, with request/response shapes) is documented in
[DATA-MODEL.md › HTTP API](DATA-MODEL.md#http-api).

## One turn, and the mastery rules

```
hold button → record → POST /api/turn (audio + history + session state)
   → server rebuilds the tutor prompt from the live session state
   → E2: understand mixed speech + reply in character
        → { userVerbatim, userSaid, tutorReply, correction, objectiveProgress }
   → server applies the deterministic mastery rules → updated session
   → the run is captured to disk (best-effort, never fails the turn)
   → text shown immediately; GET /api/speak streams native Slovene audio (E3),
     played progressively and cached on the way through
```

The **mastery rules** live in [`server/orchestrator.ts`](../server/orchestrator.ts) — server-owned, not
left to the model's whim. Each turn the model returns a per-objective verdict; the server applies it:

- verdict `completed` → objective status becomes **completed**.
- verdict `attempted` → status becomes **recast** (it must *resurface and be produced correctly* before
  it can complete — recast is not a dead end).
- The session **completes** when every objective is completed, or a safety cap of **14 turns** is hit.

Alongside this scene layer, the same turn now also credits the **durable mastery layer**: E2 returns a
per-**learnable** verdict, and the server folds it into the learner model (`assets/learner.json`) —
independent of objective/scene status. See [State and persistence](#state-and-persistence) and
[learnable-subsystem-spec.md](learnable-subsystem-spec.md).

Because the prompt is rebuilt from this state every turn, the model always knows what's left and what's
shaky. The turn policy it's held to (in [`server/prompt.ts`](../server/prompt.ts)) is the
[teaching model](#the-teaching-model) below.

## The teaching model

The loop in one line: the tutor recasts an error in character, the learner gets one natural retry, and
an objective completes when the model judges it produced acceptably — **mastery is production, not
recognition.**

What the rebuilt prompt enforces every turn:

- **Register-first.** The scenario declares `ti`/`vi` and the variety (`pogovorni`/`knjižni`); the
  tutor fixes that before each reply, which also keeps replies as terse as a real local.
- **Recast, don't lecture.** Say the correct form back inside an in-character reply; never explain
  grammar, never break character, always Slovene-only.
- **Steer and interleave.** Drive toward the first uncompleted objective; bring `recast` objectives back
  naturally so they can be produced correctly; reuse completed phrases.
- **Single-retry scaffold (ratchet down).** On a stumble, drop exactly one rung of support on the next
  prompt — open prompt → either/or that includes the target → leading choice that contains it — never
  the same prompt louder. One good production still completes the objective (no forced cold repetition
  *within* a session).

The full pedagogy — the 18-step learning loop, the rubrics, and the research behind each rule — is in
[research/](research/) (the expert panel) and codified into the authoring
[rubric](scenario-authoring.md). This describes the **inner loop** (one sitting). The **outer loop** —
**count-based mastery across contexts** on a persistent learner model — is now **built** (the mastery
loop, item 4; see [learnable-subsystem-spec.md](learnable-subsystem-spec.md)). What's still out is
**cross-session spaced *resurfacing*** (scheduling *what to bring back when*), which is tutor-leads (item 5).

## The asset model

The catalog is **relational**: everything visible is a node with a stable id, and the *edges between
the nodes* are the model. There are four kinds (`server/catalog/*.json`), and one unifying primitive.

| Kind | Is | Holds | References (edges) |
|---|---|---|---|
| **object** | a renderable image (one descriptor → one canonical render). Props *and* figure-images both live here (`coffee`, `counter`, `baker`, `customer`). | `label`, `descriptor`, optional `gender` | — |
| **character** (actor) | a cross-media identity that **owns no pixels** — it *points at* objects. Image ↔ voice live here. | `voiceProfile`, optional `gender`, optional `name` | `type` → object(s) it is a kind of · `visualRef` → the object used as its image |
| **concept** | a **composed** depiction: rendered by montaging its parts' renders and anchoring to that sheet. Recurring depictions (`greet`, `leave`) *and* **locations** (`cafe`, `bakery`, `mesnica`, `lekarna`) are concepts. | `prompt`, `aspectRatio`, `format` (`flashcard` = atomic card · `scene` = full tableau) | `composedFrom` → objects, characters, **or other concepts** |
| **voice** | a named, provider-agnostic voice profile | `description` | — |

**The unifying primitive: a *renderable asset* = a label + one canonical render.** Objects,
character-visuals, and concept-renders all reduce to that — so anything that composes
(`concept.composedFrom`, `scene.assets`) just references nodes by id and gets their renders.
Object-vs-character-vs-concept is only *how* the render is produced (a descriptor · a referenced object
· a recipe), never a different thing being composed. [`server/assets/compose.ts`](../server/assets/compose.ts)
is the one resolver that turns any id into its render, recursively.

**The edges, end to end:**
- scenario → `characterRef` → a **character** (its voice + identity)
- scenario.scene → `scene.assets: [{ ref }]` → **objects / characters / concepts** (the cast, the props, and the **location**)
- character → `type` / `visualRef` → **objects** (a generic role now; a named individual — "Nataša the baker" — later, pointing at her own render)
- concept → `composedFrom` → objects / characters / **concepts**

That last edge is what makes a **scene a composition**: a scene anchors on a **location concept** (the
"standing set" — counter + fixtures, built and rendered *once*), plus the cast and props. Many
scenarios can play on the same set, so cost is *sets + scenes*, not *sets × scenes* — the film/game
model. The simple case keeps everything thin (`baker` the actor points at `baker` the object); the
shape scales to named individuals, multi-type actors, and reusable sets without new kinds.

> **One deliberate sharp edge:** a composed image keys on its *authored prompt*, not on its
> constituents' render keys — so changing a source asset does **not** auto-invalidate its dependents.
> That propagation is intentionally **decision-gated** (you choose what to re-render). The full key
> model, the toolkit, and the render-vs-rekey decision are in [asset-pipeline.md](asset-pipeline.md);
> the field-level catalog schemas are in [DATA-MODEL.md](DATA-MODEL.md#the-catalog).

## State and persistence

What's **ephemeral** vs. **durable** is a deliberate line, and it's the most common source of
confusion — so, precisely:

- **Ephemeral (per sitting).** The live `SessionState` — which objectives are pending/recast/completed
  *right now* — lives in the browser and the conversation history is per-page-load. Reload and the
  *scene-layer dots* start fresh. This is one of **two layers**: the ephemeral scene layer (objective
  dots, 14-turn cap) and a **durable mastery layer** (below) that does carry forward.
  - **The learner model** — the mastery layer, held under a **learner id** the client mints per page
    load and sends as `x-learner-id`. Per **learnable** (vocabulary · chunk · pattern, in
    `server/catalog/learnables.json`) it counts `attempts`/`successes`; a learnable is *mastered* at a
    threshold (5) of successful productions, credited per-learnable from the same E2 verdict, with a flub
    decrementing it. It carries across the whole sitting — the scene dots reset, this does not — and the
    default store keeps it in memory, so it ends with the sitting. `LEARNER_STORE=file` holds one model on
    disk at `assets/learner.json` instead, which is what dev and the probes use. Accounts arrive by making
    the id an account id and the store durable. Mechanism:
    [learnable-subsystem-spec.md](learnable-subsystem-spec.md) §2.3; subsystem design:
    [learnable-subsystem.md](learnable-subsystem.md). (Steering/selection over this model — *what* to
    practise next — is still roadmap 5.)
- **Durable (on disk).**
  - **Session records.** Every *run* is captured to `assets/sessions/<id>.json`, written incrementally
    on each turn — so even an abandoned run (browser/server killed mid-session) leaves its partial
    record. A run is `completed` or `abandoned`, replayable turn-by-turn, and can be named or
    favorited. Records reference audio by key and copy no bytes, so they're tiny and replay is free.
    (See [`server/assets/sessions.ts`](../server/assets/sessions.ts).)
  - **The content-addressed asset store.** All generated audio and images live in
    `assets/{audio,image}/` keyed by their inputs, with an append-only `manifest.jsonl` sidecar. They
    survive restarts and are never re-billed. A small in-memory LRU (200 clips) just skips a disk read
    on hot replays.

So "no persistence" is **not** accurate: artifacts, runs, **and** the cross-sitting learner model are
durable. What's still missing is the *tutor that leads* — the layer that chooses what to practise next
from this model (roadmap 5).

## The scenario engine

New scenarios aren't hand-written. A pipeline authors the Slovene, checks it with a **deterministic
linter**, and has an **independent critic** sign off before it ships; then `build:assets` materializes
the audio and images and it auto-appears in the picker. A `--self-directed` mode lets the engine
*discover* the best next scenario from the existing repertoire plus the research principles (generation
still gated on approval).

- The procedure is the create-scenario skill (`.claude/skills/create-scenario`).
- The acceptance rubric every scenario must pass is [scenario-authoring.md](scenario-authoring.md).
- Making the procedure tool-neutral (any agent, any language) is [roadmap](ROADMAP.md) item 7.

## What's built vs. what's next

**Built today**, all running against real providers and verified end-to-end: the live turn loop and the
server-owned mastery rules; four scenarios (café, bakery, butcher, pharmacy) each with a narrated story,
per-objective flashcard frames, and a scene composed on a reusable location set; the relational asset
catalog (objects · actors · composed concepts/locations · voices) and the content-addressed store;
durable session capture, replay, and favorites; the generation engine and its gates (including
`--self-directed`); the live `/gallery`; and the **rehearsal dialogues** — pre-authored branching
decision-tree exchanges at ascending competency levels, with pregenerated per-speaker audio
([rehearsal-dialogues.md](rehearsal-dialogues.md)).

**Next** — see [ROADMAP.md](ROADMAP.md) for the dependency-ordered plan:

- **The mastery loop — built** *(roadmap 4)*: the durable learner model with count-based per-learnable
  mastery, per-learnable crediting, flub-reset, groups/presentation, and free conversation (levels 1–2).
  Design:
  [learnable-subsystem.md](learnable-subsystem.md) · decisions + stories:
  [learnable-subsystem-stories.md](learnable-subsystem-stories.md) · mechanism + build:
  [learnable-subsystem-spec.md](learnable-subsystem-spec.md).
- **A tutor that leads** — an orchestration layer that chooses what to practice next *(roadmap 5)*.
- **A tool-neutral, multi-language engine** *(roadmap 7)* and **a sustainability bundle** *(roadmap 8)*.
- **Lower latency.** Today ≈6 s/turn (E2 ≈5 s + E3 first-audio ≈1.4 s). Level-1 E3 streaming is done and
  the `E3Adapter.stream` seam exists; Level-2 (E2 token streaming + sentence pipelining → ~1–2 s) is
  planned.

## Map of the docs

| Doc | Scope | Read it when |
|---|---|---|
| **ARCHITECTURE.md** (this) | the system: what it is, what you can do, why it's shaped this way | getting oriented; deciding where a change belongs |
| [FILE-MAP.md](FILE-MAP.md) | the project layout — every directory, module, script, and command → its file | finding where something lives |
| [DATA-MODEL.md](DATA-MODEL.md) | the HTTP API and the concrete data shapes (scenario, session, catalog, adapter interfaces) | building a client, extending the model, or adding a provider |
| [asset-pipeline.md](asset-pipeline.md) | the asset toolkit, the key model, and the render-vs-rekey decision | generating, restyling, or auditing assets |
| [scenario-authoring.md](scenario-authoring.md) | the acceptance rubric for a scenario, objective, story, frames, and scene | authoring or reviewing a scenario |
| [rehearsal-dialogues.md](rehearsal-dialogues.md) | the click-through branching **decision-tree** rehearsal mode — schema, levels, delivery notes, audio | authoring, wiring, or generating audio for a rehearsal dialogue |
| [ROADMAP.md](ROADMAP.md) | the future state and the dependency-ordered pieces to get there | planning what to build next |
| [learnable-subsystem.md](learnable-subsystem.md) | the cross-session memory subsystem (design): patterns + vocabulary as durable units, the learner model, mastery | building roadmap 4 (memory) or designing the learner model |
| [learnable-subsystem-stories.md](learnable-subsystem-stories.md) | the mastery loop's captured intent: decisions, canonical user stories, and the mastery-loop flows | speccing or building roadmap 4; reviewing whether the build serves the journey |
| [learnable-subsystem-spec.md](learnable-subsystem-spec.md) | the mastery loop's **build spec**: data model, per-turn + cross-session control flow, API changes, crediting/presentation rules, the ordered build plan | building/extending the mastery loop; tracing why a counter behaves as it does |
| [live-tutor.md](live-tutor.md) | the **continuous-speech** surface (Go live): the WebSocket contract, the shared lesson prompt, the spend ceilings, and the Gemini/Grok bake-off | running or extending the live tutor; adding a realtime vendor |
| [mode-comparison.md](mode-comparison.md) | the two speaking modes side by side: what each leaves behind, how a sitting is read across both (`npm run runs`), and which comparisons the asymmetries rule out | scoring a tester round; choosing between the modes |
| [free-conversation.md](free-conversation.md) | the **governing ethos** of free conversation: how it threads natural flow + laser mastery focus (situation-first selection, honor-the-topic/hold-the-level, the focus-set/credit firewall, the seed) | designing/building free conversation; deciding what the mode should and shouldn't do |
| [SECRETS.md](SECRETS.md) | API-key hygiene and the key-isolation boundary | handling credentials |
| [research/](research/) | the expert-panel research the pedagogy rests on | understanding *why* a teaching rule exists |
