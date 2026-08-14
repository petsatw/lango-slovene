# The authoring pipeline — one engine, many surfaces

This is the resolved architecture for authoring lango-slovenian content: **author (native Slovene + a catalog
delta) → critic → deterministic reconcile + lint → operator-gated generation**, with the **learnable catalog
as the shared spine**. It supersedes the ad-hoc, hand-run dialogue process. Where it diverges from the older
per-surface tooling, the divergence was a decision — recorded inline below.

## The model — a scenario is a spine rendered onto surfaces

A **scenario** is not one artifact. It is **one canonical language spine rendered onto several surfaces**:

- **Spine (the invariant):** the situation + register + role + voices, and its **learnables in the catalog**
  (`server/catalog/learnables.json`) — minted once by id, referenced everywhere. The catalog is the
  cross-surface, cross-scenario review spine.
- **Surfaces (rendered from the spine):**
  1. **Rehearsal dialogue tree** — the Practice surface (npc/client branching, N levels). *Built.*
  2. **Live-chat handoff** — scene context: role + introduced learnables + focus set. *Built.*
  3. **Guided live dialogue** — a future live mode that follows the tree's shape dynamically (ROADMAP 5). *Not built.*
  4. **Visual / objective turn-loop** — create-scenario's original target; **retired** in the MVP, kept dormant.
  5. **A1 competency mapping** — the learnables' place in the readiness map (`server/catalog/a1-map.json`).

Every surface is a **parameterized output of the same engine**. Today two surfaces are authored through it:
the **visual** surface via the `create-scenario` skill, and the **dialogue** surface via the `create-dialogue`
skill. Both run the same shape; they differ only in what they render.

## The J / L / G lanes (never blur them)

- **J — Judgment:** authoring + structural decisions. The orchestrator (the skill) + the `slovenian-author`
  and `scenario-critic` subagents. Fuzzy, in-language, LLM-native.
- **L — Logic:** id assignment, catalog merge, key computation, file writes, deterministic lints. **Scripts**
  (`reconcile-dialogue`, `lint:dialogue`, `lint:tree`, `lint:a1`), never by hand.
- **G — Generation:** TTS/image bytes from finished content. `build:dialogue-assets` / `build:assets` —
  **operator-run, on approval only**. Generated audio lands in the gitignored `assets/` store — to *ship and
  serve* it on a deploy, see [DEPLOY.md](DEPLOY.md).

### Where determinism ends and LLM judgment begins (D4)

The L lane is deterministic — but "deterministic" does **not** mean "brittle regex doing a language job." The
reconcile splits cleanly:

- **Mechanical → deterministic code (idempotent, fail-loud):** normalize `kind` (closed enum, fail on the
  unknown), merge new learnables by id, assign canonical ids + compute `introduces`, apply the critic's
  **exact addressed** fixes, write the files. A conservative `normSurface` collision check backstops the DRY
  invariant — it only catches surfaces that are already identical; it never rules on whether two *different*
  surfaces mean the same thing.
- **Fuzzy → LLM judgment (upstream, in the agents):** the **minting-rubric filter** ("does the LEARNER
  produce this?") and **lexical-identity dedup** ("is this the SAME item already in the catalog — the same
  lemma/frame/phrase, just inflected, cased, or spelled differently?") are the author's/critic's calls. Dedup
  is by **lexical identity, NOT by function**: distinct commonly-used lexemes that share a communicative job
  are distinct learnables and all coexist (`Živjo`/`Zdravo`, `ja`/`da`) — the engine never forces a pick
  among them. The delta reaching the reconcile is already rubric-clean and identity-deduped; the reconcile's
  job is to apply it mechanically and **refuse loudly** on any invariant the agents were supposed to honor
  (its own `normSurface` backstop catches only *identical* surfaces, never a shared-function near-neighbour).

The pipeline order makes the couplings safe by construction:

```
author (provisional ids, rubric-clean delta)
  → critic (structured addressed fixes: {level,nodeId,field,oldExact,newExact})
    → reconcile: dedup/collision guard → assign canonical ids → merge → normalize kind (fail-loud)
                 → apply fixes (exact, idempotent) → write dialogue files + manifest + catalog → emit A1 candidates
```

Two input contracts hold this together: **the critic emits exact addressed fixes** (never free-text the script
must interpret), and **the reconcile owns id assignment** (authors propose provisional ids only).

## The dialogue surface, end to end

Skill: **`.claude/skills/create-dialogue/SKILL.md`** (the J-lane orchestrator). Agents:
**`slovenian-author`** (dialogue mode — writes the Slovene per node + the catalog delta) and
**`scenario-critic`** (dialogue mode — judges naturalness/register/branch coherence, emits structured fixes).
Script: **`server/scripts/reconcile-dialogue.ts`**. Gates: `lint:dialogue`, `lint:tree`, `lint:a1`,
`test:dialogue`. Generation: `build:dialogue-assets` (operator).

### The reconcile input contract

The orchestrator assembles ONE bundle at `.scratch/dialogue-drafts/<scenarioId>/reconcile-input.json`:

```jsonc
{
  "scenario": { "id", "name?", "title", "status?", "character", "role?", "setup", "opening",
                "register?": { "form", "variety" } },
  "dialogueVoices": { "npc": "<voice profile>", "client": "<voice profile>" },
  "levels": [
    { "level": 1, "levelLabel": "Survival", "title": "…", "background?": "cafe-1.jpg",
      "objectives": [ { "label", "descriptorEN" } ],
      "root": "n1",
      "nodes": { "n1": { "speaker": "npc", "sl": "…", "en": "…", "deliverySL?": "[warmly] …", "next": ["c1a","c1b"] } },
      "catalog": { "reuse": ["rad_bi"], "new": [ { "id": "…", "kind": "vocabulary|chunk|pattern", "sl": "…",
                                                  "gloss": "…", "predictableError?": "…" } ] } }
  ],
  "criticFixes": [ { "level": 1, "nodeId": "c2a", "field": "sl", "oldExact": "…", "newExact": "…" } ],
  "a1Candidates": [ { "learnableId": "…", "competencyId": "food_drink", "note": "…" } ]
}
```

The reconcile is **idempotent**: already-merged learnables are skipped by id, an already-applied critic fix is
detected and skipped, and an existing level's built `audio: "ready"` state and its `background` are preserved
rather than reset (a level's `background` also comes from the input if given). The reconcile input is the
**source of truth** for a level's nodes — a re-run rewrites the dialogue file from it, so post-hoc hand-edits
to `server/dialogues/*.json` are overwritten on the next reconcile. Make node changes in the input and re-run.

**A learnable is `new` in exactly one level — the first that introduces it — and `reuse` everywhere after.**
Listing the same id under `new` on two levels is a duplicate-surface error the reconcile refuses (the second
mint collides with the now-existing catalog entry). Across a scenario's levels the author/critic split shared
items accordingly: mint at first use, reuse thereafter.

### The tree is the canonical scene-script (D3)

The dialogue tree is the canonical scene-script for **both** today's canned playback **and** the future
guided-live mode (which will consume the same nodes: npc lines = scene beats, client choices = expected
productions, `introduces` = focus). Keep the nodes clean to that dual role. No guided-live runtime is built.

## The manifest is the source of truth (D2)

`server/scenarios/<id>.json` is the **package manifest**: situation/register/role/voices + a `surfaces` block
declaring what exists. The `dialogue` surface declares its shared voices + the levels; the per-level
`server/dialogues/<id>-<n>.json` files are the rendered surface, **keyed to the manifest**. `lint:tree` checks
the two agree (declared level ↔ file, matching label + voices). `surfaces.a1: true` marks a package whose
levels the A1 map references. The manifest is additive — legacy scenarios omit `surfaces` and still load.

## A1 mapping is folded into authoring (D5)

`server/catalog/a1-map.json` is grounded in the official Slovene A1 taxonomy (**docs/a1-taxonomy.md**): 3
foundational layers + 10 thematic domains; learnable→competency is many-to-many; a bucket may be an empty
**frontier** domain. The reconcile **emits candidate mappings** for each newly-minted learnable
(`a1-candidates.json`); the operator confirms them and folds them into the map (never auto-mapped —
no auto-competency assignment). `lint:a1` keeps it honest: every catalog learnable is mapped to ≥1 competency
**or** on the explicit `excluded` list, and every scenario ref resolves. Scope: the catalog is the
**production** inventory, so coverage is over produced learnables; the wider recognition set and the weighted
4-mode readiness scoring are out of scope (the MVP exercises Speaking/Listening/Reading; Writing is out by
design — see docs/a1-taxonomy.md).

## The umbrella end-state (D1) — staged, not big-bang

The engine's end-state is one umbrella —
`author-scenario --surface dialogue|handoff|guided-live|visual|a1` — sharing the J/L/G core + the
author/critic agents, with surface-specific generators + lints. We got there **staged**: `create-dialogue` is
built now **as** the `dialogue` surface generator (its input is the manifest; its stages are the shared core),
and `create-scenario` folds in later as `--surface visual` **only if that retired surface is revived** (D6 —
kept dormant, not deleted; not invested in for the MVP). No big-bang refactor of dormant visual code.

## Operational notes (D7)

- **Data reload:** scenarios/dialogues/learnables load only at **server startup** (`readdirSync`); tsx-watch
  reloads `.ts` only. After adding or editing JSON, **restart the server**. (Accepted — authoring is offline.)
- **Voice/env preflight:** `build:dialogue-assets` verifies every voice profile the target references resolves
  to a configured voice id (and the API key is set) **before** synthesizing — a run that would half-complete
  fails fast, listing every missing binding, instead of leaving a level partially generated.
- **`.env` is agent-locked.** The operator runs `build:dialogue-assets`; the agent never does unless asked.

## The scripts + gates at a glance

| command | lane | what it does |
|---|---|---|
| `npm run reconcile:dialogue -- <input>` | L | merge delta + write dialogue files + manifest + emit A1 candidates (idempotent, fail-loud) |
| `npm run lint:dialogue` | L | dialogue↔catalog seam: no duplicate canonical `sl`, `introduces` resolves, coverage |
| `npm run lint:tree` | L | tree structure: root-npc, reachable, terminating, manifest-consistent; lists convergence nodes to review |
| `npm run lint:a1` | L | A1 coverage: every learnable mapped or excluded; refs resolve; frontier report |
| `npm run test:dialogue` | L | dialogue loader schema + `introduces` referential integrity |
| `npm run build:dialogue-assets -- <id>` | G | **operator** — synth per-speaker audio; preflight; flips level `audio` → ready |
