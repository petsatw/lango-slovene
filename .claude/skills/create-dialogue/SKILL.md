---
name: create-dialogue
description: Author a complete, gated, internally-verified REHEARSAL-DIALOGUE package for a lango-slovenian scenario — the branching npc/client trees (N levels), their catalog learnables, and the scenario MANIFEST — present it PR-style for approval, and on approve reconcile + gate it (audio stays a separate operator-run step). Use when the user wants to add or extend a scenario's click-through rehearsal dialogue (café, bakery, pharmacy, …) or says "create a dialogue", "author the rehearsal trees", "add levels to <scenario>". This is the `dialogue` surface of the authoring engine (see docs/authoring-pipeline.md); it mirrors create-scenario's author→critic→reconcile→gated-generation shape for the branching-tree surface the MVP practices.
---

# create-dialogue — the rehearsal-dialogue orchestrator (the `dialogue` surface)

You are **C, the Creator/Orchestrator** for the rehearsal-dialogue surface. This skill IS the operating procedure. You own the pipeline and all **structural** judgment (the branching graphs); you dispatch two subagents for the parts that must be independent + in-language; you drive the deterministic **reconcile** script for all file writes; and you NEVER hand-write a final Slovene line or generate audio yourself.

Read **docs/authoring-pipeline.md** (the engine model + the J/L/G lanes) and **docs/rehearsal-dialogues.md** (the data model, the **tree template + sizing**, the **minting rubric**, the voice/env matrix) before you start — they are authoritative and win over anything here.

## The three lanes (never blur them)
- **J — Judgment**: the situation, the per-level objectives, the **branching graph** (ids + who speaks + the English intent per node + where branches re-converge). Done by you (C) or the `slovenian-author` subagent (LS, who writes the Slovene).
- **L — Logic**: id assignment, catalog merge, `introduces` computation, file writes, the structural + catalog + a1 lints. Done by **scripts** (`reconcile-dialogue`, `lint:*`), never by hand.
- **G — Generation**: per-speaker audio bytes. Done by `build:dialogue-assets` — **operator-run, on approval only**. Trees ship `audio: "pending"`.
- **Golden rule:** C decides the graph + specs each node's English intent; LS writes the language; the reconcile assembles/mints/writes; the operator runs generation. You emit English intent, never Slovene.

## Umbrella-ready (D1) — why the input is a manifest
This skill is built as the **`dialogue` surface generator** of a future umbrella (`author-scenario --surface dialogue|handoff|guided-live|visual|a1`). Its input is therefore **manifest-shaped** (D2): a scenario package (situation/register/role/voices + the levels to author). The tree is the canonical **scene-script** (D3) — the same nodes a future guided-live mode will consume — so keep npc lines as clean scene beats and client choices as clean expected productions.

## Guardrails (every stage — from the handoff)
- **Never freehand Slovene.** All language goes LS → critic → lint. You author English intent only.
- **Never auto-generate audio.** `build:dialogue-assets` is operator-triggered; trees ship `audio: "pending"`.
- **Catalog: mint once by id, dedup by canonical `sl`.** Reuse existing ids; the reconcile enforces it and FAILS on a duplicate surface — resolve upstream, never by weakening the guard.
- **Keep J/L/G separate.** You spec; agents judge language and never write files; the reconcile writes; the lints gate; the operator generates.
- **Legacy stays; scope discipline.** No guided-live runtime, no A1 engine, no auto-competency assignment. Don't touch create-scenario.

---

## Procedure

Work on a DRAFT under `.scratch/dialogue-drafts/<scenarioId>/` — **nothing is written into `server/` and no audio is generated until R approves** (PR semantics).

### 1 — Parse the manifest-shaped brief (J)
Fix: the **situation**, a **register** (ti/vi + pogovorni/knjižni), the tutor **role** (Slovene role noun, e.g. `natakarica`), the **voices** (`npc` + `client` catalog voice profiles — and the learner's gender, which fixes first-person forms), and the **levels** to author (each: a `levelLabel`, a `title`, and its ordered **objectives** as EN meanings + the grammar point each teaches). Pick a kebab/lowercase `scenarioId`. If the scenario already exists, you are EXTENDING it — read its manifest + existing levels first so new levels don't re-introduce covered learnables.

### 2 — Design the per-level tree skeletons (J)
From the **template + sizing** in docs/rehearsal-dialogues.md (L1 Survival ≈16 nodes, L2 Basic-A1 ≈26, L3 Full-A1 ≈52; spine = npc node → **2 client choices** → each client's single `next` = the npc response → branches **re-converge** onto shared later nodes; `root` is an `npc` node; every path ends at `next: []`). For each level author the node graph as `{ <id>: { speaker, intentEN, next } }` — ids + who speaks + the English intent + the branching. Ensure each level's objectives are each demonstrated on a reachable path, and are distinct across the scenario's levels.

**Vary openers + closers across levels.** Give each level its own `n1` opener and its own terminal closers — do NOT reuse one greeting or one closing as every level's. Identical lines read monotonously *and* collapse to one audio clip (the audio key excludes the delivery tag, so same `sl` + same voice = one clip, first-built wins — a character's `deliverySL` only lands on lines whose `sl` is unique to that voice). Spec distinct intents; LS writes distinct lines. `lint:dialogue` warns on any delivery collision that slips through.

### 3 — Language authoring (J → LS), one subagent PER LEVEL, in parallel
Dispatch **`slovenian-author`** (dialogue mode) once per level, concurrently — each gets the situation, register, voices, and that level's node map (speaker + `intentEN` + `next`). Each returns `{ level, nodes:{id:{sl,en,deliverySL?}}, catalogDelta:{reuse,new}, concerns }`. Start on the default model.

### 4 — Sanity pass (J, C)
Quick read against the rubric: native-not-textbook? register consistent? client lines carry the learner's gender? no npc-only line minted in a delta? branches re-converge coherently? If something's off, **re-dispatch that level's LS with the specific note** — never fix the Slovene yourself.

### 5 — Independent critique (J → critic)
Dispatch **`scenario-critic`** (dialogue mode) over ALL levels' trees + deltas at once. It returns `{ verdict, fixes:[{level,nodeId,field,oldExact,newExact,reason}], deltaFindings, convergenceReviewed, notes }`. Its `fixes` are the **structured, addressed** edits the reconcile applies; its `deltaFindings` flag mint/reuse problems. If a `deltaFinding` is `block`, route it back to LS (stage 3) and re-critique.

### 6 — Assemble the reconcile input (L, C)
Write `.scratch/dialogue-drafts/<scenarioId>/reconcile-input.json` (shape in docs/authoring-pipeline.md): the `scenario` header, `dialogueVoices`, the `levels` (each with `levelLabel`, `title`, an optional `background` filename, `objectives:[{label,descriptorEN}]`, `root`, `nodes` merged from LS's `sl/en/deliverySL`, and `catalog:{reuse,new}`), the critic's `criticFixes`, and — folding A1 in (D5i) — `a1Candidates:[{learnableId,competencyId,note}]` proposing where each NEW learnable sits in the A1 map (competency ids from server/catalog/a1-map.json). You assemble English/structure only; every `sl` came from LS.

- **Mint-once across levels:** a learnable shared by several levels goes in `new` on **exactly one** level (its first use) and `reuse` on the rest. The same id under `new` twice makes the reconcile fail on a duplicate surface — split it here.
- **`background`** (optional): a per-level portrait image filename under `public/backgrounds/` (operator-supplied art, `<scenario>-<level>.jpg` or descriptive). The reconcile writes it onto the level and **preserves it on re-run**. The reconcile input is the source of truth for a level's nodes — a re-run rewrites the file from it, so make later node changes here and re-run, not by hand-editing `server/dialogues/*.json`.

### 7 — Reconcile deterministically (L)
`npm run reconcile:dialogue -- .scratch/dialogue-drafts/<scenarioId>/reconcile-input.json`. It normalizes kinds, dedups (fail-loud on a duplicate surface — if it fails, the semantic dedup slipped; fix the delta upstream and re-run), assigns ids + `introduces`, applies the critic's exact fixes, writes the dialogue files + the manifest, merges the catalog, and emits `a1-candidates.json`. Idempotent — safe to re-run.

### 8 — Gates (L) — all must be green, no generation
`npm run lint:dialogue && npm run lint:tree && npm run lint:a1 && npm run test:dialogue`. Fix any failure by routing it to its stage (a duplicate surface → LS reuse; a convergence node → re-check with the critic) and re-run. `lint:tree` will LIST the convergence nodes to eyeball — confirm each reads on all paths; `lint:dialogue` may WARN on a delivery collision (a shared `sl`+voice with differing delivery) — resolve by making the line textually distinct (stage 2/3) if the delivery matters.

**`lint:a1` gate + the fold-timing:** it FAILS while any newly-minted learnable is neither mapped nor excluded. So fold the reconcile's `a1-candidates.json` mappings into `server/catalog/a1-map.json` **here, provisionally**, to green the gate — then present those exact mappings in the ReviewPackage (stage 9) for R to confirm or override. This is the only way stage 9 shows all-4-green; "operator-confirmed, nothing auto-mapped" means R ratifies (or corrects) the provisional fold at stage 10/11, not that the fold waits until after approval.

### 9 — Submit the ReviewPackage (L, C) — PR semantics
Present R: the per-level objectives, the trees (with English intent + LS's Slovene + delivery tags), the catalog delta (reused vs newly minted, with each new item's gloss + predictable error), the computed `introduces`, the **A1 mappings you folded provisionally** (list each `learnableId → competency` for R to ratify or override), any `lint:dialogue` delivery-collision warnings and how you resolved them, the convergence nodes the critic reviewed, and the green lint/test output. State the register + voices explicitly and invite R to confirm or override.

### 10 — Review gate (J, R)
R replies **approve** or **reject(notes)**. Do not generate audio before approve. On reject, route each note to its stage (language → LS/3; a branch → 2; a mint → LS/3 + reconcile), re-run 6–8, re-submit.

### 11 — On approve: fold A1 + generate audio (L + operator)
- **A1 fold-in (L):** the mappings were folded provisionally at stage 8 to green `lint:a1`. Here R **confirms** them; apply any override into `server/catalog/a1-map.json` and re-run `npm run lint:a1` (green). This keeps A1 in sync as the catalog grew (D5i/D5ii).
- **Audio (G — OPERATOR runs it):** the operator runs `npm run build:dialogue-assets -- <scenarioId> [--level n]`. Its **preflight** fails fast if any voice binding is unset (D7ii); on a clean level it flips `audio: "pending" → "ready"` (turns on the play buttons). It is billed only for newly-synthesized clips. **You never run this** unless the operator explicitly asks. For a cheap pre-commit voice/delivery check, `--nodes <id,id>` auditions a few lines without flipping `ready`.
- **Ship the audio (release):** generated clips land in the gitignored `assets/audio/` store, so a git deploy does not carry them until they are **force-committed** (`git add -f assets/audio`). See docs/DEPLOY.md for the ship + serve-env contract.
- **Restart the server** to load the new JSON (data loads only at startup — D7i).

## Scope (do not add)
No guided-live runtime, no A1 scoring engine, no auto-competency assignment (candidates are operator-confirmed), no manifest consolidation beyond the `surfaces` block. Don't touch create-scenario. Audio is always a separate operator step.
