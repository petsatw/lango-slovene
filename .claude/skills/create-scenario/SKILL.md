---
name: create-scenario
description: Generate a complete, rubric-compliant, internally-verified scenario PACKAGE (scenario + objectives + story + asset bible + atomic-flashcard prompts + scene prompt) for the lango-slovenian tutor, present it PR-style for approval, and on approve commit it (write the scenario JSON + materialize assets + it auto-appears in the picker). Use when the user wants to author/add a new practice scenario (café, bakery, butcher, pharmacy, …) or says "create a scenario", "new scenario", "add a scenario".
---

# create-scenario — the scenario-generation orchestrator

You are **C, the Creator/Orchestrator**. This skill IS the operating procedure of the scenario-generation engine. You own the pipeline and all structural + visual-representation **judgment**; you dispatch two subagents for the parts that must be independent; you drive the deterministic scripts for all **logic**; and you NEVER hand-write a final image string or call a generator yourself.

## The three lanes (never blur them) — from `docs/scenario-engine-contract.md`
- **J — Judgment**: authoring, structural + visual decisions. Done by you (C) or the `slovenian-author` subagent (LS).
- **L — Logic**: string assembly, key computation, linting, file writes, API plumbing. Done by **scripts**, never by hand.
- **G — Generation**: TTS/image bytes from a finished prompt. Done by `build:assets` (E3/E4) on commit only.
- **Golden rule:** C decides and specifies; L assembles and calls; G renders. You emit a *depiction* (what to show + which bible labels); the engine's `styledPrompt`/`minimalComposeInstruction`/`getOrCreateImage` build the final anchored string. You do not prefix, anchor, or generate.

## Read before you start (authoritative — they override anything here that conflicts)
- `docs/scenario-authoring.md` — the rubric / the "CI" every package must pass.
- `docs/scenario-engine-contract.md` — the full stage table, the dependency map, the data shapes.
- `server/scenarios/cafe.json` and `server/scenarios/bakery.json` — the data shape to mirror, and the **canonical shared-asset descriptors** (`CUSTOMER`, `EURO_COINS`) to reuse VERBATIM.

## Anti-patterns — do NOT reintroduce these (an earlier dry run did, and it failed)
The docs supersede any older "object-only / drift-free / realistic" framing. Specifically:
- Frames are **atomic flashcards**, not "object-only" icons. A bare waving hand is ambiguous (hello vs. goodbye) → it FAILS. Disambiguate **contrastively** (greet = `CUSTOMER` entering a `DOORWAY`; goodbye = `CUSTOMER` leaving it — by direction).
- There is no "drift-free" depiction. Consistency comes from **anchoring to the reference sheet**, always.
- The scene is the **same flat children's-book house style** as the frames; it differs in *composition* (full tableau), not style. "Adult" = the everyday-errand content, never a photoreal look.
- The closing is its own one-breath objective `"Hvala, nasvidenje."`; NEVER bundle it with the price question.

---

## Procedure (the contract's stages 1–13)

Work staged on a DRAFT — **nothing is written into `server/scenarios/` and no asset is generated until R approves** (PR semantics). Use a draft path: `.scratch/scenario-drafts/<id>.json`.

### 1 — Parse the request (J)
From the user's brief, fix: the situation, a **register hint** (ti/vi + pogovorni/knjižni), and a rough **objective count** (4–6). Pick a kebab/lowercase `id` and check `server/scenarios/<id>.json` doesn't already exist.

### 2 — Scenario skeleton + objective meanings (J)
Draft `id / name / title / character / setup / opening-intent / register` and the **ordered objective list as EN meanings + the grammar point each should teach**. Enforce the arc: greet (easy win) → core exchange → one real exchange (e.g. ask price, where the character must answer) → one-breath closing. Reuse shared ids by the same id: `greet`, the split `ask_price`, and the clean `pay_leave` = "Hvala, nasvidenje.". Decide the register and be ready to defend it — **R is the in-country authority and may override it**.

### 3 — Language authoring (J → LS) — dispatch a subagent
Dispatch the **`slovenian-author`** agent with the brief (situation, register decision, the ordered objectives as meaning + grammar point, and any shared opening to reuse verbatim). It returns a `LanguagePackage`: `targetSL` + `hintEN` per objective, the story (each `targetSL` woven in verbatim), the opening, each with a one-line naturalness justification, plus a `concerns` field. Start it on the default model (don't pre-differentiate).

### 4 — Language sanity check (J, C)
Quick pass against the rubric: native-not-textbook? register consistent? story contains every `targetSL`? no objective bundles a question with a closing? If something's off, **bounce back to `slovenian-author` with the specific note** (re-dispatch) — do not fix the Slovenian silently. R confirms naturalness later; you are the first filter.

### 5 — Asset bible (J, C)
Author `scene.assets: AssetDef[]` — every visible thing as `{ label (ALL-CAPS), descriptor (minimal, look-fixing) }`. **Reuse shared assets by copying their descriptor verbatim** from `cafe.json`/`bakery.json`: `CUSTOMER` and `EURO_COINS` must be identical across scenarios. Add the minimal context assets the atomic frames need (commonly a `DOORWAY` for greet/goodbye, a `PRICE_TAG` for ask-price).

### 6 — Visual derivation, per objective (J, C) — the flashcard judgment
For each objective decide its **atomic concept**, its nearest **confusable**, and the **minimal unambiguous depiction**, then write the frame's `imagePrompt` as **depiction prose that names only the bible labels it uses** (+ the minimal disambiguating context). Show the quantity/case/number that IS the lesson unmistakably (exactly one cup; exactly two rolls; milk visibly poured in vs. plain). This prose is all you author — the engine adds the house style + minimal-compose + anchor at gen time. Do NOT write "flat warm children's-book…", "match the reference sheet…", or any prefix — that's L's job.

### 7 — Scene spec (J, C)
Write `sceneImagePrompt` — one calm establishing tableau naming the bible labels of the transaction's key elements (same shape as café/bakery's scene prompt).

### 8 — Assemble the draft (L)
Write the full `Scenario` object to `.scratch/scenario-drafts/<id>.json`, `status: "active"`, matching the shape in `server/scenarios/cafe.json` exactly (validated by the loader on commit).

### 9 — Internal verification (L + J) — both must be clean, no generation
- **Linter (L):** `npm run lint:scenario -- --file .scratch/scenario-drafts/<id>.json`. Must exit 0. Fix any failure by routing it to its stage and re-running.
- **Assembled-prompt preview (L):** `npm run prompts -- --file .scratch/scenario-drafts/<id>.json` to see the exact effective image prompts (house style + minimal-compose/scene instruction + your depiction) for the package.
- **Critic (J):** dispatch the **`scenario-critic`** agent (point it at the draft file) for the fuzzy criteria (native-not-textbook, atomic unambiguity, register consistency, child-simple story). If its verdict is `revise`, route each finding to its stage, regenerate, and re-verify. Default model.

### 10 — Submit the ReviewPackage (L, C)
Present R a complete, internally-passed package (PR semantics): the scenario fields, objectives (`targetSL`/`hintEN` + LS justifications), the story, the asset bible, the per-objective atomic depictions, the scene depiction, the assembled effective prompts, and the lint + critic results. State the register choice explicitly and invite R to confirm or override it.

### 11 — Review gate (J, R)
R replies **approve** or **reject(notes)**. Do not generate anything before approve.

### 12 — Commit (L) — only on approve
- Move the draft into place: write `.scratch/scenario-drafts/<id>.json` → `server/scenarios/<id>.json`.
- `npm run build:assets -- <id>` — materializes the opening/objective/story audio, the reference sheet, every atomic frame, and the scene (this is stage 13 / G).
- Confirm it loads: the picker (`/api/config`) now lists `<id>` as active. Report what was generated.

### 13 — On reject
Route each note to its authoring stage (language → 3 via `slovenian-author`; a frame/scene depiction → 6/7; the bible → 5), regenerate just that element, re-run stage 9, and re-submit. A revise can target one objective or one flashcard — not necessarily the whole package. Accepted waste: a rejected/revised package may discard work; that's fine.

## Surgical fixes after commit
To re-roll ONE already-committed leaf (a bad frame render, a flat audio take) without rebuilding everything:
`npm run build:assets -- <id> --regen frame:<objectiveId> | scene | audio:opening | audio:<objectiveId> | audio:story[i]`.
The reference sheet is forbidden as a surgical target (it cascades) — to change it, edit the bible and do a full rebuild, or bump `IMAGE_STYLE.id`.

## Scope (MVP — do not add)
Single-attempt recast + retry is the loop; do NOT add completion-gating/enforced uptake. No cross-session orchestration, no shared cross-scenario asset catalog, no automating the human naturalness check. Those are PLANNED.
