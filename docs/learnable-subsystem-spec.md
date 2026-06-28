# The Mastery Loop — Build Spec (roadmap 4, inner mechanic)

**Status: spec (ready to build).** This closes the mechanism gap the design docs left open. It is
subordinate to [learnable-subsystem-stories.md](learnable-subsystem-stories.md) (the source of truth —
decisions, user stories, flows) and [learnable-subsystem.md](learnable-subsystem.md)
(structure/capabilities). Where any of those conflict with this spec, **they win** and this spec is wrong
and must change. This document adds only what they deliberately stop short of: the **data model**, the
**per-turn and cross-session control flow**, the **verdict/API changes**, **persistence**, and an
**ordered build plan** with per-step verification against the real local stack.

Grounded in the current app: [orchestrator.ts](../server/orchestrator.ts) (`applyProgress`,
`TURN_CAP=14`, ephemeral session), [prompt.ts](../server/prompt.ts) (turn policy, the single-retry
ratchet, the **per-objective** verdict), [types.ts](../server/types.ts), [scenarios.ts](../server/scenarios.ts)
+ [catalog.ts](../server/catalog.ts), [adapters/gemini.ts](../server/adapters/gemini.ts) (E2 response
schema), [assets/sessions.ts](../server/assets/sessions.ts) (the durable-JSON-on-disk pattern this
follows).

---

## Part 0 — Resolved open questions

The stories doc Part 6 parked several. Resolved for this build (operator-confirmed where noted):

| Question | Resolution | Source |
|---|---|---|
| Learner-model persistence | **Server-side disk JSON**, one file `assets/learner.json`, same pattern as session records. Single learner, one device, no accounts. | operator-confirmed |
| Flub of a mastered learnable | **Decrement successes by 1** (clamp ≥ 0) — *not* reset-to-0. Gentle: a flub costs one, doesn't wipe progress. | operator-confirmed (overrides the doc's assumed reset-to-0) |
| Operator inspection (US-17) | **Minimal, read-only.** A `GET /api/learner` endpoint + a CLI print. No learner-facing UI, no scores/streaks — the engine stays invisible. | operator-confirmed |
| Per-learnable judgment latency | **In-E2** (same model hop that already returns the per-objective verdict — adding a per-learnable verdict adds no extra hop). Background scoring stays a future fallback only if measured latency demands it. | doc-derived (Part 2 "Latency"; handoff) |
| "core" designation | A `core: boolean` flag on the catalog learnable, plus optional `rank: number` (from the [core pattern library](research/core-pattern-library-2026-06-26/RANKED-PATTERNS.md)). Ranking is consulted **only** for core patterns, **only** where there is a genuine free choice (free-conversation new-item pick; later, resurfacing) — never as a general in-scene scheduler. | doc-derived (Part 2 "Patterns vs vocab", "Steering") |
| Predictable-error hint placement | On the **learnable** (`predictableError`), surfaced by presentation. The objective keeps `hintEN` for scene framing. | doc-derived (Part 6) |
| "understandable" / "correct" defs | **Parked** — remains the model's in-context judgment (no rule/string match), exactly as today's objective verdict. | doc Part 2/6 |
| exposure-shaped-hole signal | **Parked** — future. Entry stays attempt-only. | doc Part 2/6 |
| dual `dve …`, kind boundaries, non-visual cueing | **Parked** — authoring concerns, not blocking the loop. | doc Part 6 |

---

## Part 1 — The shape in one paragraph

Today's machine moves one **objective** `pending ○ → recast ◐ → completed ●` inside a single **ephemeral**
sitting (the *scene layer*). The mastery loop adds a **second, durable layer**: a **learnable catalog**
(vocabulary · chunk · pattern) that objectives reference, a **learner model** that counts per-learnable
`attempts`/`successes` on disk across sittings, and **per-learnable crediting** from the same E2 verdict.
The two layers are independent: scene completion never gates mastery and vice-versa. Presentation reads
the learner model to pick, within each objective, the still-unmastered learnable to steer toward. Free
conversation is the same crediting machine with a scenario-less prompt bounded by the learner model.

```
            ┌────────────────────── SCENE LAYER (exists, ephemeral) ──────────────────────┐
  /api/turn │  applyProgress: objective pending→recast→completed ; 14-turn cap ; complete  │
            └─────────────────────────────────────────────────────────────────────────────┘
            ┌──────────────────── MASTERY LAYER (new, durable on disk) ───────────────────┐
            │  presentObjectives(scenario, learnerModel) → which learnable to steer to      │
            │  E2 returns learnable_progress[] → applyCredit(model, …) → assets/learner.json│
            └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2 — Data model

### 2.1 The learnable catalog (NEW)

A language catalog parallel to the asset catalog, keyed by id, file
`server/catalog/learnables.json`, loaded + validated by a new module `server/learnables.ts` (mirrors
`catalog.ts`). Shape (TypeScript for precision):

```ts
type LearnableKind = "vocabulary" | "chunk" | "pattern";

interface Learnable {
  id: string;            // stable id, referenced by objectives (e.g. "eno_femacc", "kava")
  kind: LearnableKind;
  sl: string;            // canonical Slovene — the word (vocab), the whole phrase (chunk),
                         // or the frame with the slot marked "___" (pattern: "Eno ___, prosim")
  gloss: string;         // short English gloss ("coffee", "one ___, please")
  core?: boolean;        // high-leverage (US-15); default false
  rank?: number;         // leverage rank from the core pattern library; only consulted for core patterns
  predictableError?: string; // the one predictable beginner error, surfaced by presentation
}
```

- **Why kinds matter mechanically (US-9 / capability C):** kind selects how presentation treats the item.
  A `pattern` is a **carrier** (a frame reused with many fillers — it stays in play and masters fast). A
  `vocabulary`/`chunk` is a **filler** (each needs its own threshold of successes). This is the only
  behavioural switch the kind drives in this build.
- The catalog is the **starter pack** (Part 1 of stories): the learner starts at zero against it. No
  generation in this build.

### 2.2 Objective → learnable references (schema change)

The `Objective` (in `server/types.ts`, authored in `server/scenarios/*.json`) gains references to the
learnables it exercises. Today an objective carries `targetSL`; that stays (back-compat + the scene's
default steer line). Added fields, **both optional** so un-migrated scenarios keep working:

```ts
interface Objective {
  id: string;
  label: string;
  targetSL: string;                 // unchanged — the default/primary target line
  hintEN: string;                   // unchanged — scene framing for the model
  learnables?: string[];            // NEW: catalog learnable ids this objective exercises (carrier + fillers)
  fillerLines?: Record<string, string>; // NEW: per-filler full inflected target line, e.g.
                                    //   { "kava": "Eno kavo, prosim.", "voda": "Eno vodo, prosim." }
}
```

- **Carrier vs fillers is derived, not authored:** among `learnables`, the `pattern`-kind items are
  carriers; `vocabulary`/`chunk` items are fillers. (Keeps authoring flat — no role bookkeeping.)
- **Why `fillerLines` (not pattern+filler composition):** composing "Eno **kavo**, prosim" from the frame
  `Eno ___, prosim` + the lemma `kava` requires accusative inflection (`kava → kavo`) the app cannot do
  deterministically (no morphology engine). So each filler's full line is **authored**. The single-filler
  case (café today: only `kava`) needs **no** `fillerLines` — presentation falls back to `targetSL`.
- **`order_coffee`** becomes `learnables: ["eno_femacc", "kava"]`. A `greet` chunk is `learnables:
  ["dober_dan"]` (one item → stays targeted on repeat, per the group rule).

### 2.3 The learner model (NEW, durable)

One file `assets/learner.json` (path overridable by `LEARNER_PATH` so tests use a temp file), written by
`server/assets/learner.ts` (mirrors `sessions.ts`: load / save, content small, no byte copies).

```ts
interface LearnableMastery {
  attempts: number;    // rises on EVERY swing (success or fail)
  successes: number;   // rises only on a successful production; mastery measures THIS
}

interface LearnerModel {
  learnables: Record<string, LearnableMastery>; // absent id ⇒ "unseen"
  updatedAt: string;   // ISO
}
```

- **Status is derived, never stored** (US-16 small & swappable): `unseen` = absent; `mastered` =
  `successes ≥ THRESHOLD`; `attempted` (a.k.a. shaky/due) = present and below threshold. Inspection
  (US-17) maps these to owned / shaky / unseen.
- **THRESHOLD = 5**, a single tunable constant (`server/mastery.ts`).

### 2.4 The E2 verdict (schema change)

The model already returns `objective_progress` (per-objective, scene layer — **unchanged**). It gains a
**per-learnable** verdict for the mastery layer:

```ts
type LearnableResult = "success" | "attempt";
interface LearnableProgress { id: string; result: LearnableResult; }
// E2Result gains:  learnableProgress: LearnableProgress[]
```

- `success` = produced **understandably AND correctly AND without needing a recast**.
- `attempt` = exercised but not a success (unintelligible, incorrect, or carried by a recast).
- The model includes **only learnables the learner actually addressed** this turn. Credit follows only
  from what was produced; an unaddressed learnable yields nothing (Part 2 "Per-learnable crediting"). The
  model is told **nothing** about durable mastery state — the server owns all durable rules (the app owns
  the pedagogy). In particular the model does **not** know about flub/decrement; it only reports
  success/attempt, and the server decides what that means against the stored counts.

---

## Part 3 — Control flow

### 3.1 Crediting (the pure rule — `applyCredit`)

Pure function `applyCredit(model, progress: LearnableProgress[], threshold)` → new model. Per entry:

```
entry      = model[id] ?? { attempts: 0, successes: 0 }
wasMastered = entry.successes >= threshold
entry.attempts += 1
if result == "success":
    entry.successes += 1                                   // climbs past threshold (5,6,7…)
else: // "attempt"
    if wasMastered: entry.successes = max(0, entry.successes - 1)  // FLUB → decrement by 1
    // else: pre-mastery miss → STALL, successes unchanged (no penalty, US-4)
model[id] = entry
```

- **Mastered** is the threshold check on `successes` — there is no stored flag.
- **First production (success or fail) is entry** into the model (unseen → attempted). Exposure does not
  enter (Part 2 "entry into the model is an attempt").
- **Flub decrement consequence (documented, deliberate):** an item deep past threshold (e.g. 7) flubbed
  → 6, *still mastered*; an item at exactly threshold (5) flubbed → 4, *back in the pool*, re-masterable
  with one clean success. This is the "very dumb for now" reading of decrement-by-1; revisit if the
  operator wants "drop to threshold-1 regardless."
- Maps to flows: **F1/F4/F10** success climbs; **F3b/F7/F9** attempts rise, successes stall; **F6** flub.

### 3.2 Presentation (the pure rule — `presentObjectives`)

Pure function `presentObjectives(scenario, model, threshold)` → per-objective view used to build the
prompt. Per objective (when it has `learnables`):

```
mastered(id)  = (model[id]?.successes ?? 0) >= threshold
patterns      = learnables of kind "pattern"      // carriers
fillers       = learnables of kind vocab|chunk     // each needs its own threshold
activeFiller  = first filler (authored order) that is NOT mastered, else first filler (review)
reviewMode    = every learnable in the objective is mastered          // "review with teeth"
activeTargetSL = objective.fillerLines?[activeFiller] ?? objective.targetSL
focusLearnables = the not-yet-mastered carriers + the activeFiller (the items to push)
predictableError = predictableError of the first focus learnable (if any)
```

Rules this encodes (stories Part 2 "Groups & presentation", "Patterns vs vocab"):
- **A group with any unmastered item presents that item** — `activeFiller` = next unmastered.
- **Random review only when the whole group is mastered** — `reviewMode`; **flub during review** resets
  the item (via `applyCredit`), which on the next sitting makes it the unmastered `activeFiller` again
  ("turns random off and re-targets it"). *Implementation note:* "random" is realised as "pick the first
  filler for a light review touch"; true randomisation is cosmetic and omitted for determinism/testing —
  the load-bearing behaviour (review until a flub re-targets) holds either way. Flagged for the operator.
- **One item → stays targeted on repeat** (greet): nothing to switch to.
- **Mastered pattern stays as carrier** — `patterns` are never swapped out for an unrelated pattern; a
  pattern only ever varies within an equivalent pattern group (not modelled in this build — no equivalent
  groups authored yet; noted as future).
- **No fancy ordering** — authored order, "next unmastered." Ranking is **not** applied in-scene.

Scenarios **without** `learnables` (un-migrated) produce an empty presentation and the prompt falls back
to today's behaviour exactly.

### 3.3 One turn (in-scene), end to end

```
POST /api/turn (audio + history + session)
  → load learner model (assets/learner.json)
  → presentObjectives(scenario, model) → enriched objective lines (active target, predictable error,
       mastered/review flags)
  → buildSystemPrompt(scenario, session, presentation)   // scene layer unchanged + mastery-aware lines
  → E2.understand → { …, objectiveProgress, learnableProgress }
  → applyProgress(scenario, session, objectiveProgress)  // SCENE layer — unchanged
  → applyCredit(model, learnableProgress, THRESHOLD); save model   // MASTERY layer — new, durable
  → capture run (best-effort, unchanged) ; return UnderstandResult (+ optional learner snapshot)
```

The two layers are applied side by side and never gate each other (F10: extra successes count even after
the dot is already ●).

### 3.4 Cross-session & resume

- **Met where I left off (US-1) / Resume (US-8) fall out of the durable model.** The learner model is on
  disk; counts persist. The ephemeral `SessionState` (dots) may still reset on reload — that is
  acceptable per US-8 ("durable progress persists *even if the scene restarts*"). No ephemeral-session
  persistence is added. The only resume work is that **presentation consults the model at session boot**,
  so a returning learner is not re-targeted on what they've mastered (F1 step 4: dot back to ○, but counts
  persist and the mastered learnable is no longer pushed). `/api/config` MAY include a learner summary so
  the client reflects this; the prompt-side behaviour is what matters and is covered by presentation.
- **A lost sitting (F8):** the learner model is untouched by the 14-turn cap or an abandon — crediting
  only ever happens on a real produced turn, so an abandoned/capped sitting changes no counts. Nothing
  extra to build.

### 3.5 Free conversation (NEW, levels 1–2)

> **Governing ethos:** [free-conversation.md](free-conversation.md) — the philosophy + methodology (situation-first
> selection, honor-the-topic/hold-the-level, the focus-set/credit firewall, cold-vs-echo, evidence-gated
> crediting, the seed). The mechanism below must serve that intent; on conflict, the ethos wins. **Note:**
> the naive "list the entire familiar set + credit any id" implementation described here is superseded by
> the situation-first, server-bounded **focus set + allowlist** design — see free-conversation.md and the
> consensus run. This section documents the first cut; the bounded design is the target.

The same crediting machine with a scenario-less prompt:

- `POST /api/converse` (audio + history + `level: 1 | 2`). No scenario, no objectives, no scene.
- `buildConversationPrompt(model, level, catalog)`:
  - **familiar** = every learnable in the model (attempted + mastered).
  - **working set** = familiar-but-not-mastered — the tutor steers these toward mastery (the bulk of the
    mode).
  - **new items**: level 1 → none (only what I've seen); level 2 → 1–2 **un-attempted catalog** items
    (preferring `core`, by `rank`) — new *to the learner*, still the starter pack. **No generation.**
  - policy: casual, warm, Slovene-only, short turns, recast errors, stay **within familiar + the 1–2 new
    items** (the tutor's vocabulary is bounded by the learner model, US-12).
- Returns `learnableProgress` only; `applyCredit` runs identically (counting happens wherever the tutor
  assesses live input — Part 2 "Where counting happens"). `objectiveProgress` is empty.
- **Level 3 (edge-finding) is OUT** (tutor-leads, roadmap 5). New-item *creation* is OUT (off-latency
  generation is a far-edge/tutor-leads concern). Latency: never make the learner wait — selection is a
  cheap pick from the existing catalog.

### 3.6 Operator inspection (US-17, minimal)

- `GET /api/learner` → `{ threshold, learnables: [{ id, kind, sl, gloss, attempts, successes, status }],
  counts: { owned, shaky, unseen } }` (status derived). Read-only, bills nothing.
- `npm run learner` → the same, printed. (A new probe-style script.)

---

## Part 4 — API & file changes (surface summary)

| Area | Change |
|---|---|
| `server/catalog/learnables.json` | NEW — the learnable catalog (starter pack) |
| `server/learnables.ts` | NEW — load + validate the catalog; `getLearnable(id)`, `LEARNABLES` |
| `server/types.ts` | `Objective.learnables?`, `Objective.fillerLines?`; `LearnableProgress`; `E2Result.learnableProgress`; `LearnerModel`/`LearnableMastery` |
| `server/mastery.ts` | NEW — `THRESHOLD`, `applyCredit`, `presentObjectives` (pure) |
| `server/assets/learner.ts` | NEW — durable store (`load`/`save`, `LEARNER_PATH`) |
| `server/scenarios.ts` | validate the new objective fields; resolve nothing else |
| `server/prompt.ts` | accept presentation; add mastery-aware objective lines + a `learnable_progress` instruction; NEW `buildConversationPrompt` |
| `server/adapters/gemini.ts` | add `learnable_progress` to the response schema + parse it |
| `server/orchestrator.ts` | load model → present → credit → save; `understand` returns a learner snapshot; NEW `converse` path |
| `server/server.ts` | `POST /api/converse`; `GET /api/learner`; optional learner summary in `/api/config` |
| `server/scenarios/cafe.json` | author `learnables` on objectives (worked example) |
| `public/app.js` | minimal free-chat entry (push-to-talk → `/api/converse`, level toggle) |
| `package.json` | `test:learnable`, `probe:converse`, `learner` scripts |
| `docs/*` | DATA-MODEL (new shapes), ARCHITECTURE (the second layer), stories Part 6 (flub→decrement) |

No change to: the asset store/catalog ontology, E3/E4 adapters, session records, the 14-turn cap, the
scene layer's `pending→recast→completed` rules.

---

## Part 5 — Ordered build plan (each step says how it's verified on the real local stack)

The local stack mirrors cloud, so a test exercising the real client against the real local stack is
genuine production evidence (AGENTS.md). Pure logic → unit-test with plain inputs; disk effects →
seed→invoke→assert→cleanup against a temp file; the model hop → a real-Gemini probe. Phases land in
dependency order; each is independently verifiable and leaves the app runnable.

**Phase 1 — Learnable catalog.** `learnables.json` + `server/learnables.ts` (load/validate). Seed café's
learnables + a few core items from the ranked library.
*Verify:* `tsx` a tiny load assertion (catalog parses, ids unique, kinds valid) — pure load against the
real file; and `npm run dev` boots (loader runs at startup).

**Phase 2 — Objective→learnable references.** Add `learnables?`/`fillerLines?` to the `Objective` type +
`validateScenario`; author them on `cafe.json` (`order_coffee → ["eno_femacc","kava"]`, the chunks).
*Verify:* extend `lint:scenario`/load to assert every referenced learnable id exists; `npm run dev` boots
café; existing `npm run test:mastery` still green (scene layer untouched).

**Phase 3 — Learner model + crediting (pure + store).** `server/mastery.ts` (`THRESHOLD`, `applyCredit`),
`server/assets/learner.ts` (`load`/`save`, `LEARNER_PATH`).
*Verify:* **unit** (`test:learnable`, pure inputs) — success climbs to mastered at 5; pre-mastery attempt
stalls (no regress, US-4); flub of a mastered item decrements by 1 (F6); first attempt enters the model.
**integration** — point `LEARNER_PATH` at a temp file, `applyCredit`+`save`+`load`, assert persisted
state, clean up (seed→invoke→assert→cleanup).

**Phase 4 — Per-learnable verdict + presentation.** `LearnableProgress`/`E2Result.learnableProgress`;
gemini schema + parse; `presentObjectives`; mastery-aware `prompt.ts` lines + the `learnable_progress`
output instruction.
*Verify:* **unit** — `presentObjectives` picks the next-unmastered filler, flips to review when all
mastered, falls back to `targetSL` with no `fillerLines`, and is a no-op for objectives without
`learnables`. **live** — `npm run probe:e2` still parses; a real café clip through `understand` returns a
non-empty, well-formed `learnableProgress` (extend `test:mastery`'s print).

**Phase 5 — Wire crediting into the turn loop.** `orchestrator.understand` loads→presents→credits→saves;
returns a learner snapshot; `/api/turn` passes it through unchanged otherwise.
*Verify:* **e2e on real Gemini** (`test:learnable --live`, temp `LEARNER_PATH`): run the café fixture clip
("Ena kava…", the nominative error) through `understand`; assert the learner model gained an `attempt`
(not a success) for the pattern (F3 step 1), and that a clean clip credits a `success`. Assert outcomes
(the persisted counts), not call logs.

**Phase 6 — Free conversation (levels 1–2).** `buildConversationPrompt`; `orchestrator.converse`;
`POST /api/converse`; a `probe:converse` script; a minimal client free-chat entry (push-to-talk + level
toggle) reusing the existing capture/play path.
*Verify:* **unit** — the prompt includes only familiar items at level 1 and exactly 1–2 un-attempted core
items at level 2. **live** — `probe:converse` runs a real clip → asserts a credited `learnableProgress`
and a Slovene reply; manual: `npm run dev`, free-chat one turn, confirm the dots/counts move
(screenshot per the "screenshot UI before claiming verified" memory).

**Phase 7 — Resume + inspection + docs.** Presentation consulted at boot (mastered items not re-pushed);
`GET /api/learner` + `npm run learner`; optional learner summary in `/api/config`. Update DATA-MODEL,
ARCHITECTURE, and stories Part 6.
*Verify:* **live** — seed a temp learner model with `kava` mastered, boot café, confirm `order_coffee`'s
presentation no longer pushes `kava` (F1 step 4 / US-6); `GET /api/learner` returns the derived
owned/shaky/unseen counts; `npm run learner` prints them.

**Final.** Full real-stack pass: `npm run probe:e2`, `npm run test:mastery`, `npm run test:learnable`
(+`--live`), `npm run probe:converse`, `npm run dev` smoke (café turn + free chat). Report what is
verified live vs. unit-only, honestly.

---

## Part 6 — Still parked (not built here)

Concrete "understandable"/"correct" definitions; the exposure-shaped-hole signal and exposure-based
entry; the dual `dve …`; kind-boundary authoring guidance; non-visual cueing; equivalent **pattern
groups** (carrier swap within a group); true randomised review; ranking as anything more than the
free-conversation new-item tiebreak. All steering/selection/edge-finding (free-conversation level 3) and
new-item **generation** remain tutor-leads (roadmap 5); motivation/scores/streaks remain roadmap 10.
