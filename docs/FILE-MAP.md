# File map — where everything lives

The project layout, directory by directory. This is the reference relocated out of
[ARCHITECTURE.md](ARCHITECTURE.md) so the architecture stays about *decisions and shape* and this stays
about *where things are*. For the why, read ARCHITECTURE; for schemas and the HTTP API, read
[DATA-MODEL.md](DATA-MODEL.md).

## Top level

| Path | What it is |
|---|---|
| `public/` | the browser PWA (the entire client) |
| `server/` | the Node/Express backend, adapters, catalog, scenarios, scripts |
| `assets/` | **generated, durable** output — the content-addressed store + session records (git-ignored) |
| `docs/` | this documentation set |
| `.claude/skills/create-scenario/` | the scenario-authoring procedure (the engine's "front end") |
| `.env` | provider keys + selection (never committed — see [SECRETS.md](SECRETS.md)) |

## The client — `public/`

| File | What it does |
|---|---|
| `public/index.html` | the app shell: talk button, transcript, objective dots, story / practice / runs panels, takeaway, and the chrome-free **spoken-scene** surface (`#scene`) |
| `public/app.js` | the whole front end: push-to-talk capture, `POST /api/turn`, streaming playback, the story player, free-practice, the **rehearsal-dialogue** overlay (branching tree + level tabs + single audio channel), past-runs replay, the **spoken scene** (beat pacing, slow re-speak, stall ladder, discard-on-release mic), the live observability overlay |

The client holds the live `SessionState` in memory and talks only to `/api`. Keys never reach it.

## The server — `server/`

### Request path (a live turn)

| File | What it does |
|---|---|
| `server/server.ts` | HTTP endpoints + the hot-audio LRU; serves the PWA, `/api`, and `/gallery`. Captures each run. |
| `server/orchestrator.ts` | runs a turn: the E2 understand call + the **deterministic mastery rules** (`applyProgress`, `TURN_CAP`); credits the durable learner model; `converse` (free conversation) |
| `server/prompt.ts` | builds the tutor system prompt fresh each turn (turn policy + mastery-aware lines); `buildConversationPrompt` |
| `server/scenarios.ts` | loads `scenarios/*.json`; `getScenario`, `freshSession`, `characterVoiceProfile` |
| `server/learnables.ts` | loads + validates the **learnable catalog** (`catalog/learnables.json`); `getLearnable`, `LEARNABLES` |
| `server/seeds.ts` | loads + validates the **seed** onboarding dialogues (`seeds/*.json`); `getSeed`, `SEEDS`, `STARTER_SEED_ID` |
| `server/dialogues.ts` | loads + validates the **rehearsal dialogues** (`dialogues/*.json`), grouped by scenario, level-sorted; `getDialoguesForScenario`. See [rehearsal-dialogues.md](rehearsal-dialogues.md) |
| `server/adapters/dialogue-scripted.ts` | the **dialogue-tree adapter** — one step of an authored tree in either input mode: `advanceDialogue` picks the client line (tapped choice, or `next[0]` when spoken), returns the attempts to plant, never judges the audio. Pure; the caller credits |
| `server/adapters/seed-scripted.ts` | the **seed adapter** — a static-dialogue stand-in for the model: `scriptedSeedTurn` returns the next scripted line + attempts; `converse` uses it when `seedId` is set |
| `server/mastery.ts` | the durable mastery-layer pure rules: `applyCredit` (threshold/flub), `presentObjectives`, free-conv selection, `inspect` |
| `server/assets/learner.ts` | the durable **learner model** store — `assets/learner.json` (`LEARNER_PATH`), `load`/`save` |
| `server/types.ts` | shared types + the **adapter contracts** (`E2Adapter`, `E3Adapter`, `ImageAdapter`) |

### Adapters — `server/adapters/` (the swap point)

| File | What it does |
|---|---|
| `server/adapters/index.ts` | the registry: `getE2` / `getE3` / `getE4`, selected by `E2_PROVIDER` / `E3_PROVIDER` / `E4_PROVIDER` |
| `server/adapters/gemini.ts` | **E2** — audio understanding + in-character tutoring |
| `server/adapters/elevenlabs.ts` | **E3** — Slovene text-to-speech, with progressive streaming |
| `server/adapters/grok-image.ts` | **E4** — image generation with reference-image anchoring |
| `server/adapters/image-style.ts` | the house image style (`IMAGE_STYLE` prefix + id) and `IMAGE_FORMAT` (asset 1:1·1k / frame 4:3·2k / scene 16:9·2k) |

To add a provider: implement the interface ([DATA-MODEL.md](DATA-MODEL.md#adapter-interfaces)), register
it in `index.ts`, set the env var. The core never changes.

### Assets — `server/assets/`

| File | What it does |
|---|---|
| `server/assets/store.ts` | the content-addressed cache for audio + images (keys + provenance manifest) |
| `server/assets/images.ts` | `getOrCreateImage` / `getOrCreateAssetRender` / `assetRenderKey` |
| `server/assets/compose.ts` | the one resolver: render any catalog node (object / character / concept) → its render, composing **recursively** |
| `server/assets/reference-sheet.ts` | composes the per-image labelled montage from per-asset renders (jimp, local) |
| `server/assets/sessions.ts` | session capture — writes/loads `assets/sessions/<id>.json`, incrementally per turn |

### Catalog — `server/catalog/` (the relational ontology, data)

| File | Holds |
|---|---|
| `server/catalog.ts` | loads and resolves the catalog |
| `server/catalog/objects.json` | **objects** — `{ label, descriptor, gender? }` |
| `server/catalog/characters.json` | **characters/actors** — `{ type, visualRef, voiceProfile, gender?, name? }` |
| `server/catalog/concepts.json` | **concepts** — `{ label, prompt, composedFrom, aspectRatio?, format? }` (recurring depictions + location sets) |
| `server/catalog/voices.json` | **voices** — the teacher voice + named provider-agnostic profiles |
| `server/catalog/learnables.json` | **learnables** — the language catalog (`vocabulary`·`chunk`·`pattern`) objectives reference for durable mastery (loaded by `server/learnables.ts`) |

Field-level detail and examples are in [DATA-MODEL.md › The catalog](DATA-MODEL.md#the-catalog).

### Scenarios — `server/scenarios/` (data, not code)

`bakery.json` · `butcher.json` · `cafe.json` · `lekarna.json` — one JSON per scenario, referencing
assets by catalog id. Full shape in [DATA-MODEL.md › A scenario](DATA-MODEL.md#a-scenario).

### Rehearsal dialogues — `server/dialogues/` (data, not code)

`<scenario>-<level>.json` — one JSON per scenario × competency level (e.g. `bakery-1/2/3.json`), a
pre-authored branching decision tree with pregenerated per-speaker audio. Full shape + pipeline in
[rehearsal-dialogues.md](rehearsal-dialogues.md).

### Scripts — `server/scripts/` and the npm commands

Every operator command maps to a file here (or in `server/probes/` / `server/utils/`):

| Command | File | What it does |
|---|---|---|
| `npm run dev` / `start` | `server/server.ts` | run the server (watch / once) |
| `npm run probe:e2` | `server/probes/e2-probe.ts` | check E2 credentials + latency |
| `npm run probe:e3` | `server/probes/e3-probe.ts` | check E3 with a real synthesis |
| `npm run replay` | `server/probes/replay.ts` | real recorded audio → full E2+E3 pipeline, verify output |
| `npm run test:mastery` | `server/probes/mastery-test.ts` | one clip through the mastery loop, verify objective progress |
| `npm run test:learnable` | `server/probes/learnable-test.ts` | durable mastery rules — unit + temp-file store + `--live` end-to-end |
| `npm run probe:converse` | `server/probes/converse-probe.ts` | one clip through free conversation; verify reply + per-learnable crediting |
| `npm run build:seed-assets` | `server/scripts/build-seed-assets.ts` | pre-build the seed's teacher-voice line audio for the starter pack (operator-run; bills) |
| `npm run build:dialogue-assets` | `server/scripts/build-dialogue-assets.ts` | pregenerate a scenario's **rehearsal-dialogue** audio (per-speaker voice; `deliverySL` drives synthesis), flip each level to `audio:ready`; `--level <n>`, `--regen` (operator-run; bills). Also emits each node's `slowSL` chunked-slow clip |
| `npm run build:backchannels` | `server/scripts/build-backchannels.ts` | pregenerate a voice profile's **backchannels** (`"Mhm."`) — declared on `voices.json`, not on any tree; `[<profile>] [--regen]` (operator-run; bills) |
| `npm run learner` | `server/scripts/learner-show.ts` | print the durable learner model (owned/shaky/unseen) |
| `npm run build:assets` | `server/scripts/build-assets.ts` | materialize a scenario's audio + images; `--regen` for one leaf |
| `npm run render:asset` | `server/scripts/render-asset.ts` | render one/more catalog objects or characters by id |
| `npm run render:concept` | `server/scripts/render-concept.ts` | render one/more composed concepts (greet, leave, a location) |
| `npm run lint:scenario` | `server/scripts/lint-scenario.ts` | the deterministic scenario linter (gates the engine) |
| `npm run prompts` | `server/scripts/show-prompts.ts` | view the exact prompts sent to E4 + provenance; `--backfill` to reconstruct |
| `npm run prune:assets` | `server/scripts/prune-assets.ts` | remove unused assets from the store |
| `npm run fetch:assets` | `server/scripts/fetch-assets.ts` | download/refresh assets from upstream (sustainability bundle) |
| `npm run rekey:assets` | `server/utils/rekey-assets.ts` | re-key / harvest / restyle — move bytes to new keys without regenerating |
| (no script) `GET /gallery` | `server/scripts/gallery.ts` | the live visual catalog, rebuilt from the catalog + on-disk renders on each request |

The render-vs-rekey decision behind these is in [asset-pipeline.md](asset-pipeline.md).

### Maintenance utilities — `server/utils/`

Asset-store maintenance (re-keying, harvesting, restyling). See
[server/utils/README.md](../server/utils/README.md) and [asset-pipeline.md](asset-pipeline.md).

## Generated output — `assets/` (git-ignored)

| Path | What it is |
|---|---|
| `assets/audio/*.mp3` · `assets/image/*.jpg` | content-addressed clips/images (key = filename) |
| `assets/manifest.jsonl` | append-only provenance sidecar (referenceKeys, provider, prompts, ids) |
| `assets/sessions/*.json` | one captured run each (replay + versioning) |
