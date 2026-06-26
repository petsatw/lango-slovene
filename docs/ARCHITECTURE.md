# Architecture — present state

Govori is a voice tutor for everyday Slovene. You hold a button and speak — mixed English is fine —
the server understands you, replies in native Slovene, and corrects by recasting. It ships with
four scenarios (café, bakery, butcher, and a pharmacy the engine authored itself) and an engine that
generates new ones.

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
| `server/scenarios/*.json` | the scenarios — **data, not code** (assets referenced by catalog id) |
| `server/catalog.ts` + `server/catalog/*.json` | the shared asset CATALOG — the relational ontology: objects, characters (**actors**), concepts (composed, incl. **locations**), voices (see [Ontology](#the-asset-ontology) below) |
| `server/assets/store.ts` | content-addressed cache for audio + images (keys + provenance manifest) |
| `server/assets/images.ts` | `getOrCreateImage` / `getOrCreateAssetRender` / `assetRenderKey` |
| `server/assets/compose.ts` | render any catalog node (object / character / concept) → its render, composing **recursively** (a scene anchors on a location concept, which anchors on its parts) |
| `server/assets/reference-sheet.ts` | composes the per-image labelled montage from per-asset renders (jimp, local) |
| `server/scripts/build-assets.ts` | materialize a scenario's audio + images |
| `server/scripts/render-asset.ts` · `render-concept.ts` | (re)render one catalog asset / composed concept (greet, leave, a location) |
| `server/scripts/gallery.ts` | the visual catalog gallery — served live by the dev server at `GET /gallery` |
| `server/utils/rekey-assets.ts` | re-key / harvest / restyle — move bytes to new keys **without regenerating** |

The asset toolkit and the render-vs-rekey decision model are documented in
[asset-pipeline.md](asset-pipeline.md).

## The asset ontology

The catalog is **relational**: everything visible is a node with a stable id, and the *edges between
the nodes* are the model. There are four kinds (`server/catalog/*.json`), and one unifying primitive.

| Kind | Is | Holds | References (edges) |
|---|---|---|---|
| **object** | a renderable image (one descriptor → one canonical render). Props *and* figure-images both live here (`coffee`, `counter`, `baker`, `customer`). | `label`, `descriptor`, optional `gender` | — |
| **character** (actor) | a cross-media identity that **owns no pixels** — it *points at* objects. Image ↔ voice live here. | `voiceProfile`, optional `gender`, optional `name` | `type` → object(s) it is a kind of · `visualRef` → the object used as its image |
| **concept** | a **composed** depiction: rendered by montaging its parts' renders and anchoring to that sheet. Recurring depictions (`greet`, `leave`) *and* **locations** (`cafe`, `bakery`, `mesnica`) are concepts. | `prompt`, `aspectRatio`, `format` (`flashcard` = atomic card · `scene` = full tableau) | `composedFrom` → objects, characters, **or other concepts** |
| **voice** | a named, provider-agnostic voice profile | `description` | — |

**The unifying primitive: a *renderable asset* = a label + one canonical render.** Objects,
character-visuals, and concept-renders all reduce to that — so anything that composes
(`concept.composedFrom`, `scene.assets`) just references nodes by id and gets their renders.
Object-vs-character-vs-concept is only *how* the render is produced (a descriptor · a referenced object
· a recipe), never a different thing being composed. `server/assets/compose.ts` is the one resolver
that turns any id into its render, recursively.

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

The live turn loop, the mastery rules, four scenarios (each with its narrated story, flashcard
frames, and a scene composed on a reusable location set), the relational asset ontology
(objects · actors · composed concepts/locations · voices), the generation engine and its gates
(including a `--self-directed` mode that discovers the next scenario itself), and the
content-addressed asset store — all running against real providers, verified end-to-end.

## Present limitations

The present-state facts the [roadmap](ROADMAP.md) is built to fix:

- **No persistence.** Session and conversation state are in-memory and per-sitting — closing the
  browser starts fresh. (Generated audio/image *assets* are cached durably; the *session* isn't.)
  This is why a persistent learner model is the keystone roadmap item.
- **Cross-scenario asset reuse is now first-class** (the asset-engine refactor shipped, then deepened into
  the [relational ontology](#the-asset-ontology)). Every asset is a **catalog node** with a stable id;
  scenarios reference it by id, so reuse is intentional, not accidental. Each asset has its own canonical
  render, composed on demand into a per-image labelled montage (no monolithic sheet). Recurring depictions
  (greet, leave) *and* **locations** (the café/bakery/butcher sets) are **concepts** — built once, reused
  everywhere; characters are **actors** that reference their figure object. See
  [asset-pipeline.md](asset-pipeline.md). *Known sharp edge:* because a
  composed image keys on its authored prompt (not its constituents' render keys), changing a source
  asset does **not** auto-invalidate its dependents — that propagation is deliberately **decision-gated**
  (you choose what to re-render; the audit's `used-by` edges show the candidates).
- **Latency ≈6 s/turn.** Today E2 ≈5 s + E3 first-audio ≈1.4 s; Level-1 E3 streaming is done and the
  `E3Adapter.stream` seam exists. Level-2 (E2 token streaming + sentence pipelining → ~1–2 s) is planned.

**Where it's going:** [ROADMAP.md](ROADMAP.md).
