---
name: create-scenario
description: Generate a complete, rubric-compliant, internally-verified scenario PACKAGE (scenario + objectives + story + asset bible + atomic-flashcard prompts + scene prompt) for the lango-slovenian tutor, present it PR-style for approval, and on approve commit it (write the scenario JSON + materialize assets + it auto-appears in the picker). Use when the user wants to author/add a new practice scenario (café, bakery, butcher, pharmacy, …) or says "create a scenario", "new scenario", "add a scenario". Pass `--self-directed` to let the engine itself DISCOVER the best next scenario for the current learner from the existing repertoire + research principles (headless authoring; generation still gated on approval).
---

# create-scenario — the scenario-generation orchestrator

You are **C, the Creator/Orchestrator**. This skill IS the operating procedure of the scenario-generation engine. You own the pipeline and all structural + visual-representation **judgment**; you dispatch two subagents for the parts that must be independent; you drive the deterministic scripts for all **logic**; and you NEVER hand-write a final image string or call a generator yourself.

## The three lanes (never blur them) — see `docs/ARCHITECTURE.md`
- **J — Judgment**: authoring, structural + visual decisions. Done by you (C) or the `slovenian-author` subagent (LS).
- **L — Logic**: string assembly, key computation, linting, file writes, API plumbing. Done by **scripts**, never by hand.
- **G — Generation**: TTS/image bytes from a finished prompt. Done by `build:assets` (E3/E4) on commit only.
- **Golden rule:** C decides and specifies; L assembles and calls; G renders. You emit a *depiction* (what to show + which bible labels); the engine's `styledPrompt`/`minimalComposeInstruction`/`getOrCreateImage` build the final anchored string. You do not prefix, anchor, or generate.

## Read before you start (authoritative — they override anything here that conflicts)
- `docs/scenario-authoring.md` — the rubric / the "CI" every package must pass.
- `server/scenarios/cafe.json` and `server/scenarios/bakery.json` — the data shape to mirror.
- `server/catalog/{objects,characters,voices}.json` — the **shared asset catalog**: the canonical source of
  reusable assets (`customer`, `euro_coins`, `price_tag`, `doorway`, the characters) + their identity
  metadata. Reuse a shared asset by **catalog id**, never by re-typing its descriptor (see stage 5).
- `npm run audit:assets` → `assets/migration-audit.html` — the **asset graph**: every existing canonical
  render and what each composed image is built-from. This is what you consult for the reuse decision (stage 6).

## Anti-patterns — do NOT reintroduce these (an earlier dry run did, and it failed)
The docs supersede any older "object-only / drift-free / realistic" framing. Specifically:
- Frames are **atomic flashcards**, not "object-only" icons. A bare waving hand is ambiguous (hello vs. goodbye) → it FAILS. Disambiguate **contrastively** (greet = `CUSTOMER` entering a `DOORWAY`; goodbye = `CUSTOMER` leaving it — by direction).
- There is no "drift-free" depiction. Consistency comes from **anchoring to the per-asset canonical renders** (composed into a labelled montage at gen time), always.
- The scene is the **same flat children's-book house style** as the frames; it differs in *composition* (full tableau), not style. "Adult" = the everyday-errand content, never a photoreal look.
- The closing is its own one-breath objective `"Hvala, nasvidenje."`; NEVER bundle it with the price question.

---

## Self-directed mode (`--self-directed`)

When invoked with `--self-directed`, the engine runs **headless**: no user brief, no pausing for image
review, and **no clarifying questions** — you DISCOVER the best next scenario yourself, author it end to
end, and present the finished package. The selection is driven by the research principles, applied to the
**current learner's repertoire** (what's already in `server/scenarios/` + the catalog). This adds **stage 0**
below and makes stage 1 automatic; **everything else (stages 2–13) is unchanged**.

**Hard boundary — the generation gate stays.** Self-directed removes the human from *discovery and
authoring*, NOT from *generation*. You still STOP at stage 11 and present the package; you never generate
images/audio or commit without explicit approval. ("Never auto-generate assets" is a standing rule —
self-directed authoring up to the gate is fine; auto-rendering past it is not.)

### 0 — Autonomous scenario discovery (J) — self-directed only
Pick the scenario that most advances *this* learner. Do it by evidence from the repertoire, not by taste.

1. **Survey the repertoire + catalog.** Read every `server/scenarios/*.json` and `npm run audit:assets`.
   Build a coverage map: per existing scenario, its **register**, its objectives' **grammar features**
   (case / gender / number / the dual / agreement), and — most important — each objective's
   **negotiation rung** (see ladder). Note which ids are **shared** across scenarios (today: only the
   `greet` / `pay_leave` bookends).
2. **Locate the frontier.** The progression ladder (the research's circling ladder, inverted — each rung
   is a harder comprehend-and-respond turn):
   - **0** recite one case-marked chunk into a fixed slot · **1** learner-*initiated* exchange (you ask,
     the character answers — `ask_price`) · **2** respond to a **binary either/or** the character asks
     (`specify_beef`) · **3** respond to an **open question** (answer not contained in the prompt) ·
     **4** **repair** (handle "didn't catch that" / ask for repetition).
   The frontier = the lowest rung not yet well-covered. Target **one rung above** what the learner has
   saturated; never skip a rung.
3. **Enumerate candidates** that ALL hold: (a) sit exactly one rung above the frontier; (b) overlap the
   existing catalog/scenarios enough to reuse a **majority** of assets (reuse-or-author, stage 6); (c)
   introduce **≤1 new hard feature** (one case/cluster/phrase, per the objective rubric); (d) are a real
   bounded transaction an adult in Ljubljana meets within ~2 weeks.
4. **Score and pick.** Prefer the candidate that, beyond the above, **adds a shared-id objective that
   interleaves** with an existing scenario (advances cross-session spaced review — the research's #1 gap),
   forces a **negotiation** the repertoire still lacks, and keeps register coverage balanced. Highest score
   wins; ties → lowest new-asset cost.
5. **Narrate the decision.** Before authoring, state in one short block: the coverage map's gap, the chosen
   rung + transaction, why it beat the runners-up, and the ≤1 new feature. Then feed this as the stage-2
   brief and proceed. (Selection is JUDGMENT; it obeys the same J/L/G lanes — you decide, scripts assemble,
   nothing generates.)

In self-directed mode **stage 1 is skipped** (its inputs come from stage 0); run stages 2–13 normally,
narrating each reuse-or-author call (stage 6) as you go.

---

## Procedure (stages 1–13)

Work staged on a DRAFT — **nothing is written into `server/scenarios/` and no asset is generated until R approves** (PR semantics). Use a draft path: `.scratch/scenario-drafts/<id>.json`.

### 1 — Parse the request (J)
*(Self-directed mode skips this — the brief comes from stage 0.)* From the user's brief, fix: the situation, a **register hint** (ti/vi + pogovorni/knjižni), and a rough **objective count** (4–6). Pick a kebab/lowercase `id` and check `server/scenarios/<id>.json` doesn't already exist.

### 2 — Scenario skeleton + objective meanings (J)
Draft `id / name / title / character / setup / opening-intent / register` and the **ordered objective list as EN meanings + the grammar point each should teach**. Enforce the arc: greet (easy win) → core exchange → one real exchange (e.g. ask price, where the character must answer) → one-breath closing. Reuse shared ids by the same id: `greet`, the split `ask_price`, and the clean `pay_leave` = "Hvala, nasvidenje.". Decide the register and be ready to defend it — **R is the in-country authority and may override it**.

### 3 — Language authoring (J → LS) — dispatch a subagent
Dispatch the **`slovenian-author`** agent with the brief (situation, register decision, the ordered objectives as meaning + grammar point, and any shared opening to reuse verbatim). It returns a `LanguagePackage`: `targetSL` + `hintEN` per objective, the story (each `targetSL` woven in verbatim), the opening, each with a one-line naturalness justification, plus a `concerns` field. Start it on the default model (don't pre-differentiate).

### 4 — Language sanity check (J, C)
Quick pass against the rubric: native-not-textbook? register consistent? story contains every `targetSL`? no objective bundles a question with a closing? If something's off, **bounce back to `slovenian-author` with the specific note** (re-dispatch) — do not fix the Slovenian silently. R confirms naturalness later; you are the first filter.

### 5 — Asset bible (J, C)
**Every asset is a catalog item — there is no scenario-local asset.** `scene.assets` entries are ALWAYS `{ ref: "<catalogId>" }`; recurring characters come via `Scenario.characterRef`. An inline `{ label, descriptor }` is legacy and must not be authored.
- **Reuse first.** If the thing already exists in the catalog (`server/catalog/objects.json` · `characters.json` · `concepts.json`), ref it by id. A `{ ref }` resolves at load to a render that's content-addressed once and reused everywhere. Note the [ontology](../../../docs/ARCHITECTURE.md#the-asset-ontology): a **character is an actor** that references its figure object; a **location** (`cafe`, `bakery`, `mesnica`) is a `scene`-format **concept** — a build-once "set" the scene composes its cast and props onto (compose it via `scene.assets: [{ ref: "cafe" }]` + a `{{CAFE}}` token), not a per-scenario backdrop.
- **New thing → add it to the catalog first, then ref it.** Pick a lowercase id (label = `ID.toUpperCase()`), add `{ label, descriptor (minimal, look-fixing) }` to `objects.json`, then reference `{ ref: "id" }`. Don't inline.
- **Declare identity metadata** on any new catalog person/figure (e.g. `gender`) — it both fixes the depiction and drives the language; its absence is what let the customer drift male.
- **People proportions:** the house style's soft, "rounded" look is an ART choice — edges and linework — NOT a body-shape directive; it never dictates build. Draw people in all natural shapes and sizes; give a specific character a build only if it's part of who they are.

### 6 — Visual derivation, per objective (J, C) — the flashcard judgment
For each objective decide its **atomic concept**, its nearest **confusable**, and the **minimal unambiguous depiction**.

**First, the reuse-or-author decision** (consult the asset graph — `npm run audit:assets`). This is a semantic JUDGMENT — a multimodal call on meaning, never prompt-string matching. **Reuse an existing render iff ALL three hold:**
1. **Same referent, right specificity.** The render depicts *the very thing the line is about*, not merely the same category. A loaf or rolls both depict *bread*, so either serves a generic "naročim kruh"; neither depicts *burek* or *štruklji* — those need their own render. If the line names a specific item or count (`dve žemlji` = two rolls), the render must show *that* item/count — a loaf won't do even though both are bread.
2. **No added Action / Relation / State (A/R/S).** A physical action ("slice the bread"), a second asset it must be shown *with* ("hand the coins to the baker"), or a state change (whole → sliced) means the as-is render under-specifies it → author a new frame, **anchored on the existing render** so the asset stays consistent.
3. **Metadata holds.** Declared identity/constraints match — `{{CUSTOMER}}` is the girl, register/setting particulars fit. A render contradicting declared metadata is unsuitable even if the object matches.

Outcome: **pass** → reuse that render (free; no new prompt). **fail / uncertain** → author. A dissonant wrong-reuse costs more than a regen, so reuse only on a confident match; the `scenario-critic` (stage 9) re-checks every reuse call.

**If authoring**, write the frame's `imagePrompt` as **depiction prose that names the assets it uses as braced `{{TOKEN}}`s** (+ the minimal disambiguating context). Show the quantity/case/number that IS the lesson unmistakably (exactly one cup; exactly two rolls; milk visibly poured in vs. plain). This prose is all you author — the engine adds the house style + minimal-compose + anchor (composing the labelled montage from the per-asset renders) at gen time. Do NOT write "flat warm children's-book…", "match the reference sheet…", or any prefix — that's L's job.

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
Renders are now per-asset (composed into a labelled montage at gen time), so there is no monolithic sheet to surgically target — re-roll the frame/scene that's wrong, or edit the asset's catalog descriptor and let its dependents be re-rendered by decision (the audit shows them). **Do NOT bump `IMAGE_STYLE.id` to force a re-render** — that is a brute-force global re-roll reserved for a deliberate art-style change; a content fix is a per-asset decision, and an unchanged-picture key shift is a re-key, not a regeneration.

## Scope (MVP — do not add)
Single-attempt recast + retry is the loop; do NOT add completion-gating/enforced uptake. No cross-session orchestration, no automating the human naturalness check. Those are PLANNED. (The shared cross-scenario asset catalog now EXISTS — reuse it; that line is no longer a scope exclusion.)
