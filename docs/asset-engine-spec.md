# Asset Engine & Story-Scenario Architecture — Spec

**Date:** 2026-06-17
**Status:** SPEC ONLY — to be built in a fresh session. First milestone is the asset store + reuse engine.
**Decisions locked:** images are AI-generated via a **pluggable image adapter**; the **persistent local asset store + reuse engine** is the first thing to build.

---

## Purpose
Every TTS clip and (later) image we generate is **reusable content**. Today it's regenerated or cached only in memory (lost on restart). The goal: a **persistent, content-addressed, local asset library** so that:
- Re-using any generated phrase/story-line/image is **free and instant** (no API call, no re-bill).
- The library accumulates into the raw material for **scenarios** and a **free "play-clip-and-practice" review mode**.
- It aligns with the **story feature**: each scenario carries a narrated story, one visual frame per learning objective, and a final scene image containing all objectives.

### Why local-first (verified)
ElevenLabs self-serve content "may be deleted after 180 days of inactivity" (no obligation to retain), and generations are deletable at any time ([retention docs](https://elevenlabs.io/docs/agents-platform/customization/privacy/retention), [content-after-subscription](https://help.elevenlabs.io/hc/en-us/articles/15993008593297-What-happens-to-my-content-after-my-subscription-ends)). So provider history is a **liability to depend on**. A local library gives free reuse, offline review, provider independence, and full control — provider history is at most a fallback, never the strategy.

---

## Target content model (what the story feature implies)
A **Scenario** (café, farmer's market, grocery, vet, doctor, …):
```
Scenario {
  id, title, status, character, setup, opening,        // exists today in server/scenarios.ts
  objectives: Objective[],                              // exists today (id, label, targetSL, hintEN)
  story: {                                              // the narrated opener (≤5 simple-SL sentences)
    sentences: string[],                                // one line per story beat
    frames: StoryFrame[],                               // one visual frame per learning objective
    sceneImagePrompt: string,                           // final image: ALL objectives in one picture
  }
}
StoryFrame { objectiveId, lineSL, imagePrompt }         // a concept = a frame (image + its SL line + audio)
```
**Assets a fully-built scenario owns** (all content-addressed in the store):
- per-objective **practice audio** (the `targetSL` phrases, native voice),
- **story narration audio** (each story sentence),
- **story-frame images** (one per objective),
- **final scene image** (all objectives),
- plus the dynamic per-turn tutor audio generated during live sessions (also cached).
- **per-student completion status** per objective — ties to the PLANNED persistent learner model (ARCHITECTURE.md › Planned #4).

This model is the *target*; M1 below does not require all of it — it requires the store that will hold it.

### Session record (a played run — distinct from authored assets)
The assets above are a scenario's **authored** content (materialized by `build:assets`, M3). A **session record** is different: the captured, ordered transcript of **one actual played run**, each turn pointing at the store clip that voices it.
```
SessionRecord {
  id,                    // unique per run (e.g. cafe-2026-06-17T10-29-22Z, or a uuid)
  scenarioId,            // which scenario was played
  createdAt,             // ISO timestamp the run started
  status,                // "completed" | "abandoned"  (abandoned = killed mid-run)
  finalObjectives,       // ObjectiveState[] snapshot at the point the run ended
  turns: SessionTurn[],  // ordered
  label?,                // optional human name (UC3: "the one I like")
  favorite?,             // optional bool — a promoted/preferred run
}
SessionTurn {
  index,                 // 0-based order
  role,                  // "tutor" | "student"
  text,                  // SL text spoken/heard this turn
  userVerbatim?,         // student turns: exactly what was heard (errors preserved)
  audioKey?,             // store key of the clip voicing this turn (absent if not voiced)
  objectiveId?,          // objective this turn addressed, if any
}
```
Records live in `assets/sessions/<id>.json` (gitignored with the rest of the library). They reference clips by `audioKey` and **never copy bytes**, so a record is cheap and a replay is free — every referenced clip is already on disk. An `abandoned` record is what a future resume feature reloads.

---

## M1 (BUILD FIRST) — Persistent asset store + reuse engine
Retrofit today's in-memory audio cache into a durable, content-addressed library.

### Today (the seam to retrofit)
- `server/server.ts`: an in-memory `audioCache` Map keyed by `audioKey(provider, voiceTag, text)` = `sha256(provider|voiceTag|text)`, bounded to 200, lost on restart. `/api/speak` checks it, else streams from the provider and tees bytes into it (`X-Audio-Cache: hit|miss`).
- `server/adapters/elevenlabs.ts`: `synthesize()`, `stream()`, `voiceTag` getter.

### Design
- **Archive location:** gitignored `assets/` at repo root (already added to `.gitignore`). Configurable via env (`ASSET_DIR`).
- **Layout:**
  ```
  assets/
    audio/<sha256>.mp3        # one file per unique (provider|voiceTag|text)
    image/<sha256>.png        # (M2) one file per unique (provider|model|style|prompt)
    manifest.jsonl            # append-only metadata index (one JSON line per asset)
  ```
- **Hot-path cache check = file existence.** `fs.existsSync(assets/audio/<key>.mp3)` is the cache hit; no manifest read needed to serve. The manifest is a *sidecar* for metadata/queries, not the lookup path.
- **Key function:** generalize the existing `audioKey`. Audio key = `sha256(provider|voiceTag|text)` (unchanged, so existing keys are compatible). Image key (M2) = `sha256(provider|model|styleId|prompt)`.
- **Manifest entry (JSONL):** `{ key, type:"audio"|"image", path, provider, voiceOrModel, text|prompt, scenarioId?, objectiveId?, createdAt }`. Append on write. Enables "all assets for scenario X" queries and the future library UI.
- **Module:** `server/assets/store.ts` exposing:
  ```
  has(key): boolean
  getPath(key, type): string
  read(key, type): Buffer | null
  put(key, type, bytes, meta): void          // write file + append manifest line
  getOrCreate(key, type, meta, gen: () => Promise<{bytes, mimeType}>): Promise<{bytes, hit}>
  ```
  `getOrCreate` is the core reuse primitive: hit → return from disk (free); miss → run generator, persist, return.
- **Integration:** `/api/speak` becomes: compute audio key → `store.read` → if present stream from disk (free, survives restart); else stream from provider AND `store.put` (tee). Keep an optional small in-memory LRU as L1 in front of disk L2 for hot items (recommended, not required). The synthesize path used by probes goes through the store too.
- **Scenario tagging on the live path:** `/api/speak` must pass the active `scenarioId` (and `objectiveId` when the spoken `text` equals a known objective's `targetSL`) into `store.put`'s `meta`, so every clip generated during a live session is scenario-tagged in the manifest. Today `/api/speak` accepts only `text` as a query param; extend its contract to also accept `scenarioId` and `objectiveId` — the client already holds both via `SessionState`. Without this, manifest entries written from live sessions leave `scenarioId`/`objectiveId` empty and the "all assets for scenario X" query (and §M6) cannot see them.
- **Provider-agnostic:** the key includes provider + `voiceTag`, so swapping E3 (Chirp/Azure) never collides; each provider's audio is stored separately. Consistent with the existing adapter philosophy.

### What M1 deliberately does NOT persist
M1 makes generated **asset bytes** durable. It does **not** persist **session state** or the **conversation transcript**. `SessionState` (per-objective `pending`/`recast`/`completed`, turn count, history) stays in-memory and client-held; killing the server or closing the browser mid-session discards it, and the next visit starts a `freshSession`. A clip generated during an abandoned session survives (it is content-addressed in the store), but the *session it belonged to* does not. Capturing or resuming a half-finished run — e.g. returning to the café with `with_milk` still in `recast` — is **out of scope for M1 and is not implied by it**; it belongs to §M6 (Session capture) and the persistent learner model (ARCHITECTURE.md › Planned #4).

### M1 acceptance (verify with real services, no mocks)
- Generate a phrase once (miss, provider call) → second request **after a server restart** is a hit served from `assets/audio/` with **no provider call** (confirm via the provider dashboard or by killing network). `X-Audio-Cache: hit` after restart.
- `assets/` is git-ignored (already true); `manifest.jsonl` grows by one line per new asset.

---

## M2 — Pluggable image-generation adapter (BUILT) — provider: xAI Grok (E4)
Mirrors the E2/E3 swap pattern; the image slot is **E4**.
- **Interface** (`server/types.ts`): `ImageAdapter { name; model; generate({prompt, referenceImages?, params?}) → {bytes, mimeType} }`.
- **Registry + env** (`server/adapters/index.ts`): `E4_REGISTRY` + `getE4()`, selected by **`E4_PROVIDER`** (default `grok`).
- **Provider — xAI Grok** (`server/adapters/grok-image.ts`): `POST https://api.x.ai/v1/images/generations`, Bearer `GROK_API_KEY`, model `GROK_IMAGE_MODEL` (default `grok-imagine-image-quality`), `response_format: b64_json` → **JPEG**. Verified against xAI docs 2026-06.
- **Stored** in the same asset store via `server/assets/images.ts` (`getOrCreateImage`); image key = `sha256(provider|model|styleId|prompt)`, so regenerating an identical frame/scene is free. Store extension for images is `.jpg` (matches Grok); the manifest records the actual `mimeType`.
- **Style consistency:** shared style in `server/adapters/image-style.ts` — `id` `v1-flat-warm` + prompt prefix; the `styleId` is part of the image key. Incidental Slovenian text in images is **embraced** (user decision). **Character/landmark consistency across frames is the known open gap** → to be addressed with Grok's **reference images** (≤3): `referenceText` + `referenceImages` are STUBBED in the style module and threaded through `generate(referenceImages)`, but the multi-image-editing call is **not wired yet**.

---

## M3 — Scenario/story content model + prebuild script
- Expand `server/scenarios.ts` (or move scenarios to per-file JSON as they multiply) to the target content model above. The café already has a `scene.story` stub to evolve.
- **`build:assets` script** (`npm run build:assets -- <scenarioId>`): walks a scenario and `getOrCreate`s **all** its static assets — objective phrase audio, story-narration audio, frame images, scene image. Idempotent and **free on re-run** (store hits). This is the engine that "aligns with the story feature": author a scenario → prebuild materializes its asset set into the local library.
- Scenario roadmap: many **café** variants first → **farmer's market** / **grocery** → official: **vet** / **doctor**. Cross-cutting objectives (greet, "can you repeat", etc.) reuse the same audio across all of them (free).

## M4 — Story playback in the app (the visual story feature)
Render the narrated opener: story frames one-per-objective (image + SL line + audio from the store), ending on the final all-objectives scene. This is PLANNED ARCHITECTURE.md feature #2, now backed by the asset store.

## M5 — Free practice mode (BUILT, enabled by the store)
A **practice** mode over a scenario's **authored** canonical phrases (objective `targetSL`): a "🎧 Practice" player steps through objectives — auto-plays the canonical clip from the store (free disk hit), the student **records their attempt locally** (MediaRecorder) and plays it back to self-compare. **Zero API cost, offline** (beyond the cached `/api/speak` hit). Client-only (`public/`), no new server route. The optional E2 speaking-check is intentionally deferred to keep practice free. Distinct from replaying a specific past run (§M6).

## M6 — Session capture, replay & versioning ("come back to my run")
Covers what M1–M5 do not.
1. **Capture.** During every live session the server appends each turn to an in-progress **SessionRecord** (§Session record) at `assets/sessions/<id>.json`. On normal completion `status` becomes `"completed"`; if the run is abandoned (server/browser killed), the last-written record stays `status:"abandoned"` with the partial `turns` and the `finalObjectives` snapshot as of the last completed turn. *(UC1: the partial run is on disk, not silently lost.)* On completion the server also ensures the scenario's objective `targetSL` clips all exist in the store (a `build:assets` pass scoped to that scenario's objectives), so the run has a clean per-objective **recap** set. *(UC2: "objective audio generated as a recap.")*
2. **Replay.** A turn-based static replay of a chosen SessionRecord: step through `turns` in order, playing each turn's `audioKey` clip from the store. **Zero API cost** — every clip is already persisted. Student turns with no `audioKey` are voiced per §Open decisions (student-turn audio). *(UC2: replay the encounter I had without burning credits.)*
3. **Versioning & promotion.** Multiple SessionRecords for one `scenarioId` coexist as distinct runs — a redo is a **new** record, never an overwrite. A run may be given a `label` and marked `favorite`; a promoted run is the candidate for practice reuse and for export (§Open decisions, session export). *(UC3: keep the version I like; use it / publish it.)*

**M6 acceptance:** complete a café session; kill + restart; open the prior run from `assets/sessions/` and replay all turns end-to-end with `X-Audio-Cache: hit` on every clip and **no provider call**. A second, differently-worded run of the same scenario writes a **second** SessionRecord (not an overwrite), and only genuinely new phrases add clips to the store.

---

## Integration points (existing code to build against)
- `server/server.ts` — `audioKey`, `audioCache`, `cachePut`, `/api/speak` tee logic → retrofit to `store.getOrCreate` (M1).
- `server/adapters/elevenlabs.ts` — `voiceTag`, `synthesize`, `stream` (audio source for the store).
- `server/adapters/index.ts` — registry pattern to copy for `ImageAdapter` (M2).
- `server/types.ts` — adapter interfaces; add `ImageAdapter` (M2); per-scenario/per-objective asset + status types.
- `server/scenarios.ts` — `Scenario.scene { image, story }` stub → evolve to the content model (M3).
- `SessionState` / mastery loop — supplies per-objective completion status that the scenario/library view reads.

## Open decisions / verify-first
- **Image provider** — RESOLVED: **xAI Grok** (E4), model `grok-imagine-image-quality`, JPEG. Adapter is provider-agnostic; a second provider is an A/B away.
- **Character/landmark consistency (next image task)** — frames currently share the *style* but drift on specifics (café name, barista). Wire Grok multi-image editing (≤3 reference images) behind the existing `IMAGE_STYLE.referenceImages` stub; bump `styleId` when it changes output.
- **Manifest format** — JSONL for MVP; **sqlite** is the scaling path if queries/concurrency grow.
- **Library promotion** — `assets/` is gitignored now; design so it can later be synced to a server/CDN or committed as shippable content without restructuring.
- **Per-text determinism** — TTS is not byte-deterministic; the store keys on *input* (text+voice), so the *first* generation is canonical and reused thereafter. That's intended (one canonical clip per phrase).
- **Student-turn audio (replay/export)** — student turns are not stored today. In a replay/export they can be voiced three ways: (a) persist & replay the student's **real captured audio** — most authentic, but requires storing learner audio (privacy + size; `/api/turn` would have to tee incoming audio to the store); (b) **TTS the canonical `targetSL`** in a distinct voice — clean, consistent, free after first gen; (c) **TTS the `userVerbatim`** — preserves the actual (errored) utterance. **Default proposal: (b)**, with (a) as opt-in. This decision sets whether `/api/turn` must persist learner audio.
- **Session export (headless YouTube)** — a promoted SessionRecord must be renderable to a shareable artifact: ordered audio for both roles, plus M4 story/scene images once they exist, without restructuring the store. Format/tooling TBD; the SessionRecord + store clips are designed to be sufficient input. **Distinct from "Library promotion" above**, which promotes the whole `assets/` library to a CDN/committed content, not a single run.
