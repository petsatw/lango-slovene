# Data model & HTTP API

The concrete shapes — endpoints, scenario/session JSON, catalog nodes, and the adapter interfaces. This
is reference: read [ARCHITECTURE.md](ARCHITECTURE.md) for what these mean and why, and
[FILE-MAP.md](FILE-MAP.md) for where they live. Types are sourced from
[`server/types.ts`](../server/types.ts); shapes are shown as TypeScript for precision.

## HTTP API

The browser talks only to these. No endpoint ever returns a key.

| Method | Path | Purpose | Returns |
|---|---|---|---|
| `GET` | `/` | the PWA | `public/index.html` (static) |
| `GET` | `/api/health` | liveness | `{ ok: true }` |
| `GET` | `/api/config?scenarioId=` | boot a scenario | providers, the chosen scenario (id, title, opening, objectives, story frame order), a fresh `session`, and the scenario list for the picker. Unknown/planned ids fall back to café. |
| `POST` | `/api/turn` | one conversational turn (E2 only) | `UnderstandResult` — text fast; audio is fetched separately. Also captures the run if `runId` is sent. |
| `GET` | `/api/speak?text=&voice=&scenarioId=&objectiveId=` | stream tutor/teacher audio (E3) | `audio/mpeg`, streamed progressively. `voice=character` → the scenario character's voice; otherwise the teacher voice. Cache: L1 memory → L2 disk → synthesize+persist. |
| `GET` | `/api/image?scenarioId=&objectiveId=` | a story frame or scene image | `image/jpeg` from the store. `objectiveId=scene` → the full tableau. 404 with a build hint if not yet built (`npm run build:assets`). |
| `GET` | `/api/sessions` | list past runs (newest first) | `{ sessions: [{ id, scenarioId, createdAt, status, turns, label, favorite, completed, objectives }] }` |
| `GET` | `/api/sessions/:id` | one run's full record | `SessionRecord` (ordered turns + final objectives) |
| `POST` | `/api/sessions/:id/meta` | promote a run | sets `label` and/or `favorite`; returns the updated `SessionRecord` |
| `GET` | `/gallery` · `/gallery/image/:key.jpg` | live visual catalog | HTML rebuilt from the catalog + on-disk renders each request; read-only, bills nothing |

### Turn request / response

```ts
// POST /api/turn  — request body
{
  audioBase64: string;   // 16 kHz mono WAV, base64 (the client transcodes before sending)
  mimeType: "audio/wav";
  history: { role: "user" | "tutor"; text: string }[];
  session: SessionState; // the client's current session state
  runId?: string;        // groups turns into one captured SessionRecord; one per page load
}

// 200 response — UnderstandResult
{
  userVerbatim: string;  // EXACTLY what was heard — errors/code-switching preserved
  userSaid: string;      // short English gloss of intended meaning
  tutorReply: string;    // the Slovene reply (what E3 will speak)
  correction: string;    // one-line note on what was recast ("" if nothing); shown silently
  session: SessionState; // updated AFTER the deterministic mastery rules
  timings: { e2Ms: number };
  providers: { e2: string };
}
```

## The teaching model (objectives & session)

```ts
type ObjectiveStatus = "pending" | "recast" | "completed";

interface Objective {       // authored in the scenario
  id: string;
  label: string;            // short English label for the UI dot
  targetSL: string;         // the canonical Slovene the learner should PRODUCE
  hintEN: string;           // internal model guidance — never spoken to the learner
}

interface ObjectiveState {  // live, per session
  id: string;
  status: ObjectiveStatus;
  attempts: number;
}

interface SessionState {
  scenarioId: string;
  objectives: ObjectiveState[];
  complete: boolean;        // all completed OR turn cap (14) hit
  turns: number;
}

// The model's per-turn verdict the server applies (orchestrator.ts):
//   "completed" → status completed ; "attempted" → status recast
type TurnVerdict = "completed" | "attempted";
interface ObjectiveProgress { id: string; result: TurnVerdict; }
```

## A scenario

`server/scenarios/<id>.json`. References assets by catalog id (`{ ref }`); inline `{ label, descriptor }`
assets are discouraged (the linter flags them). Abbreviated from `cafe.json`:

```jsonc
{
  "id": "cafe",
  "name": "Café",
  "title": "Ordering at a café in Ljubljana",
  "status": "active",                       // "active" | "planned"
  "character": "a friendly barista …",      // role text for the prompt
  "characterRef": "barista",                // catalog character id (voice + identity)
  "setup": "You are a friendly barista …",  // scene framing for the prompt
  "opening": "Dober dan! Izvolite?",        // the tutor's first line (character voice)
  "register": { "form": "vi", "variety": "pogovorni" },  // ti|vi · pogovorni|knjizni
  "objectives": [
    { "id": "greet", "label": "Greet", "targetSL": "Dober dan.", "hintEN": "Return the greeting." }
    // … 4–6 objectives
  ],
  "scene": {
    "assets": [ { "ref": "cafe" }, { "ref": "barista" }, { "ref": "customer" }, { "ref": "coffee" } ],
    "story": {
      "sentences": ["Vstopiš v kavarno …", "Naročiš: »Eno kavo, prosim.«"],  // ≤5, child-simple
      "frames": [
        { "objectiveId": "greet", "lineSL": "Dober dan.",
          "imagePrompt": "… {{CUSTOMER}} stands in the open {{DOORWAY}} …" }  // one per objective
      ],
      "sceneImagePrompt": "Ordering a coffee in a {{CAFE}}: {{CUSTOMER}} … {{BARISTA}} …"
    }
  }
}
```

`{{TOKEN}}` markers in image prompts are catalog labels — they anchor the generated image to that
asset's canonical render. The rubric for authoring all of this is in
[scenario-authoring.md](scenario-authoring.md).

## A session record

`assets/sessions/<id>.json` — one per run, written incrementally per turn. References audio by key;
copies no bytes.

```ts
type SessionStatus = "completed" | "abandoned";

interface SessionTurn {
  index: number;            // 0-based order
  role: "tutor" | "student";
  text: string;             // the SL text spoken/heard
  userVerbatim?: string;    // student turns: exactly what was heard
  audioKey?: string;        // store key of the voicing clip (absent if not voiced)
  objectiveId?: string;
}

interface SessionRecord {
  id: string;
  scenarioId: string;
  createdAt: string;        // ISO
  updatedAt: string;
  status: SessionStatus;
  finalObjectives: ObjectiveState[];
  turns: SessionTurn[];
  label?: string;           // optional human name
  favorite?: boolean;
}
```

## The catalog

`server/catalog/*.json`. The id is the JSON **key**; the value is the node. (See
[ARCHITECTURE.md › The asset model](ARCHITECTURE.md#the-asset-model) for the ontology.)

```jsonc
// objects.json — a renderable image
"customer": { "label": "CUSTOMER", "descriptor": "friendly woman, slim, short brown hair …",
              "gender": "feminine" }            // gender optional; fixes depiction + Slovene agreement

// characters.json — an actor: owns no pixels, points at objects
"barista": { "type": ["barista"], "visualRef": "barista",
             "gender": "feminine", "voiceProfile": "female-speaker" }   // name? optional

// concepts.json — a composed depiction (id = key, no id field in the value)
"cafe": { "label": "CAFE", "prompt": "A small café interior … {{ESPRESSO_MACHINE}} …",
          "composedFrom": ["espresso_machine"], "aspectRatio": "16:9", "format": "scene" }
// greet/leave are concepts too (format defaults to flashcard, aspectRatio to 4:3)

// voices.json — the teacher voice + named profiles
{ "teacher": "female-speaker",
  "profiles": { "female-speaker": { "description": "warm female teacher voice …" },
                "male-speaker":   { "description": "warm male voice …" } } }
```

## Adapter interfaces

The three swap points. Implement one, register it in
[`server/adapters/index.ts`](../server/adapters/index.ts), set the env var.

```ts
// E2 — understand: one model hop, audio → tutoring verdict
interface E2Adapter {
  readonly name: string;
  understand(input: { audioBase64: string; mimeType: string;
    systemPrompt: string; history: ConversationTurn[] }): Promise<E2Result>;
  ping(): Promise<string>;              // cheap credential check (probe:e2); must not log the key
}
interface E2Result {
  userVerbatim: string; userSaid: string; tutorReply: string; correction: string;
  objectiveProgress: ObjectiveProgress[]; focusObjectiveId: string;
}

// E3 — voice: Slovene TTS with optional streaming
interface E3Adapter {
  readonly name: string;
  readonly voiceTag: string;                       // cache-key tag for the teacher voice
  voiceTagFor(voiceProfile?: string): string;      // cache-key tag for a named profile
  synthesize(input: { text: string; voiceProfile?: string }): Promise<E3Result>;
  stream?(input: { text: string; voiceProfile?: string }): Promise<ReadableStream<Uint8Array>>;
}

// E4 — image: generation with reference-image anchoring
interface ImageAdapter {
  readonly name: string;
  readonly model: string;               // part of the image cache key
  generate(input: { prompt: string; aspectRatio?: string; resolution?: string;
    referenceImages?: string[];         // ≤3 anchors: URL / data URI / file_id
    params?: Record<string, unknown> }): Promise<ImageResult>;
}
```

## Cache keys

Why reuse is automatic and regeneration is safe (full treatment in
[asset-pipeline.md](asset-pipeline.md)):

- **Audio** — `sha256(provider | voiceTag | text)`. Same line in the same voice = one clip, anywhere.
- **Image** — `sha256(provider | model | styleId | aspectRatio | resolution | prompt)`. Identical inputs
  reuse the file; any changed input is a new, distinct key.
