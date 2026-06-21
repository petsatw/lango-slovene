# Scenario-Generation Engine — Responsibility Contract (MVP)

**Date:** 2026-06-20
**Status:** ACTIVE — the contract the MVP skill implements. Defines *who does what* and the *handoffs* between parties, before the skill is built.
**Reads with:** [scenario-authoring.md](scenario-authoring.md) (the rubric / acceptance criteria), [asset-engine-spec.md](asset-engine-spec.md) (the pipeline + asset engine).

## Purpose

The engine turns a scenario request into a committed scenario + its assets. Several *kinds* of work are interleaved — including *inside* a single prompt-building step. This contract draws the lines so the skill never blurs them: **judgment** (contextual intelligence — an LLM), **logic** (deterministic code/API plumbing), and **generation** (an audio/image model rendering bytes from a finished prompt). The image side carries real visual-representation judgment (flashcard vs. scene, which references, how to disambiguate a concept); that is the part this contract is most careful about.

**MVP form = a skill that orchestrates subagents.** The skill (`create-scenario`) is the invocable SOP — it encodes this contract, the pipeline order, and the gates, and bundles the deterministic scripts. Running *in* it, the orchestrator (C, the main agent) dispatches two subagents — **`slovenian-author`** (role LS) and **`scenario-critic`** (the independent fuzzy-criteria check) — and calls scripts for all logic/generation. Per-subtask **model differentiation** is available via the Agent tool's per-call model override (and agent-definition frontmatter); **don't pre-differentiate** — start every role on the strong default and pin a different model for a subagent only once a subtask demonstrably needs it. Eventually headless (a user submits a request, or the tutor identifies adjacent/needed learning) — see *Deferred*.

## Parties

- **R — Requestor.** Supplies the request and holds the final approve/reject gate. The **in-country authority** on whether Slovenian is natural/typical for everyday Ljubljana. (MVP: the human user. Later: a user form, or the tutor proposing the next scenario.)
- **C — Creator / Orchestrator.** The skill's main agent (me). Owns the pipeline, all visual-representation and structural **judgment**, delegation, the internal sanity check, and assembling the package for R. Drives — never *is* — the code and the generators.
- **LS — Language subagent.** A focused Slovenian-authoring role. Produces the SL content (objective phrases, the error each targets, the story, the opening line) **natural for everyday Ljubljana**, and returns it to C for a sanity check.
- **AG — Asset generators.** **Audio** = E3 TTS (`e3.synthesize`). **Image** = E4 (`getE4()`) behind the reference-sheet consistency engine. They render bytes from a finished prompt; they make no decisions.

## The three kinds of work (the key)

| tag | work | who | property |
|-----|------|-----|----------|
| **J** | Judgment — contextual intelligence, authoring, visual-representation decisions | C or LS (LLMs) | non-deterministic; must be reviewed |
| **L** | Logic — string assembly, anchoring, key computation, file writes, deterministic linters, API plumbing | code | deterministic; no judgment |
| **G** | Generation — TTS / image model producing bytes from a finished prompt | E3 / E4 | a service call |

**Golden rule:** **C decides and specifies; L assembles and calls; G renders.** C never hand-writes a final image-prompt *string* or invokes a generator directly — C emits a structured spec, and L turns it into the prompt + API call. L never makes a linguistic or visual judgment.

## Pipeline — responsibility per stage

| # | stage | work | party | in → out |
|---|-------|------|-------|----------|
| 1 | Parse request | J | C | request brief → scenario intent (situation, register hint, rough objective set) |
| 2 | Scenario skeleton | J | C | intent → `id/name/title/character/setup/register` + objective *meanings* (EN), ordered, shared-ids reused |
| 3 | Language authoring | **J** | **LS** | objective meanings + register + situation → `targetSL` per objective, the `hintEN` error each targets, the story (contains each `targetSL`), the `opening` — each with a one-line "why this is everyday-Ljubljana natural" |
| 4 | Language sanity check | J | C | LS package → pass, or bounce back to LS with a note (native-not-textbook? register consistent? story contains each `targetSL`?) |
| 5 | Asset bible | J | C | scenario → `AssetDef[]` (labels + descriptors), reusing shared assets (`CUSTOMER`, money) |
| 6 | Visual derivation (per objective) | **J** | C | `targetSL` + `hintEN` + bible → atomic concept, nearest confusable, **depiction spec** (which labels + disambiguating context) — the flashcard judgment |
| 7 | Scene spec | J | C | bible → scene depiction spec (full tableau) |
| 8 | Prompt assembly | **L** | code | depiction spec → final prompt (`styledPrompt` = house prefix + `referenceInstruction(relevantLabels)` + depiction); `IMAGE_FORMAT[kind]`; `referenceSheetPrompt(bible)` for the sheet |
| 9 | Internal verification | L + J | code (linters) + C (critic) | package → pass/fail list (see below) |
| 10 | Submit | L | C | assemble package for R |
| 11 | **Review gate** | J | **R** | package → approve \| reject(notes) |
| 12 | Commit | L | code | approved package → write scenario data file → `build:assets` → mark `active` |
| 13 | Generation | **G** | E3 / E4 | finished prompts/texts → audio + image bytes (during `build:assets`) |

On **reject**, C routes the noted element back to its authoring stage (3 for language, 6/7 for visuals, 5 for the bible) and re-submits. Waste accepted (see asset-engine-spec § pipeline).

## Image prompt-building — the judgment/logic/generation split (the crux)

One image is produced by three hands. Keep them separate:

1. **Atomic derivation — J (C).** Decide the objective's atomic concept, its nearest *confusable* concept, and therefore the **minimal unambiguous depiction** (per [scenario-authoring.md › atomic flashcards](scenario-authoring.md)). Output is a structured **VisualSpec**, e.g.:
   ```
   VisualSpec {
     kind: "flashcard" | "scene" | "sheet",
     objectiveId?,                         // flashcards
     atomicConcept,                        // EN, e.g. "greeting on arrival"
     confusableWith?,                      // EN, e.g. "goodbye"
     labels: string[],                     // bible labels this image uses
     depiction: string,                    // the authored prose: WHAT to show + disambiguating context
   }
   ```
   This — *the prose `depiction` and the choice of labels/context* — is the visual-representation judgment. It is the ONLY thing C authors for an image.
2. **Prompt assembly — L (code).** Given a VisualSpec, code builds the final string with the existing helpers — no judgment added:
   - `relevantLabels(depiction, bible labels)` → the labels actually used
   - `styledPrompt(depiction, { referenceLabels })` = `IMAGE_STYLE.prefix` + reference instruction + `depiction`
   - `IMAGE_FORMAT[kind]` for aspect/resolution; `referenceSheetPrompt(bible)` for the sheet
   - **NOTE (MVP gap):** `referenceInstruction` today says "compose a new scene." Flashcards need the **minimal-compose** variant (isolate the disambiguating assets, neutral background, no label). Adding that variant is L's part of the MVP build; *which* assets/context it composes is still C's VisualSpec.
3. **Anchor + key + render — L → G.** `getOrCreateImage(prompt, { ...IMAGE_FORMAT[kind], referenceImages: [sheet], assetLabels })` computes the key, hits the store, and on miss calls E4. The sheet is generated first and anchors every later image. E4 (**G**) renders.

So: **depiction + labels + kind = C (judgment); `styledPrompt`/`relevantLabels`/`IMAGE_FORMAT`/`getOrCreateImage` = code (logic); E4 = generation.** C never emits the prefixed/anchored final string and never calls E4.

## Language subagent + the sanity-check loop

- **Why a subagent, not C inline:** independent authoring + a verification boundary — C *critiques* the Slovenian rather than grading its own homework — and it is the seam that later becomes a dedicated Slovene-expert step (or model) in the headless version.
- **C → LS (the brief):** the situation, the register decision (ti/vi, pogovorni/knjižni), and each objective's *meaning* + the grammatical point it should teach (so LS picks a `targetSL` that naturally carries that error).
- **LS → C (the return):** `targetSL` per objective, the `hintEN` (the one predictable English-speaker error), the story (child-simple, **containing each `targetSL`**), the opening line — **each with a one-line justification of why it's what a Ljubljana local actually says here.**
- **Sanity check (C):** a quick pass against the rubric — native-not-textbook, register consistent, story contains every `targetSL`, one-utterance objectives. On a miss, bounce back to LS with the specific note (don't fix it silently).
- **Final authority = R.** C's check is a first-pass filter; the in-country requestor confirms naturalness at the review gate. (Headless later: this human check is the last thing to automate.)

## Audio (already clear)

Pure **G** triggered by **L**, on text authored by **LS**: `build:assets` computes `store.audioKey(provider, voiceTag, text)`, and on a miss calls `e3.synthesize`. No judgment beyond the text itself (which came from stage 3 and passed the sanity check). Texts voiced: each `targetSL`, the `opening`, each story sentence.

## Internal verification (stage 9) — split

- **Deterministic linters (L):** each `targetSL` appears in the story; 4–6 objectives; ≥1 shared id reused; no objective bundles a question with a closing (heuristic: `?` plus a separate closing clause in one `targetSL`); every image label exists in the bible.
- **LLM critic (J, C):** the fuzzy criteria — native-not-textbook, each flashcard's depiction unambiguous for its atomic concept, register consistent, story is genuinely child-simple. Ideally a *separate* critic pass, not the author marking its own work.

## Data contracts (handoff shapes — sketch)

- **R → C** `ScenarioRequest { brief, registerHint?, objectiveCountHint? }`
- **C ↔ LS** `LanguagePackage { objectives:[{ id, meaningEN, grammarPoint, targetSL, hintEN, justification }], story:{ sentences[] }, opening, justifications }`
- **C → code** `VisualSpec[]` (above) + `AssetDef[]` (the bible)
- **C → commit** the `Scenario` **data file** (per-file JSON — the MVP move off TS literals; see asset-engine-spec § pipeline)
- **C → R** `ReviewPackage { scenario, objectives, story, bible, visualSpecs, assembledPrompts, lintResults }` — complete and internally-passed (PR semantics)

## Dependency map & force-regenerate scope

The pipeline's asset graph is finite. The **only** asset→asset edges are `reference sheet → each frame` and `reference sheet → scene` (frames/scene anchor to the sheet bytes). So there is exactly **one interior generated node (the reference sheet)**; everything else is a leaf.

**Generated assets:**

| asset | depends on | dependents | force-regen |
|---|---|---|---|
| opening audio | opening text, E3 | — | **LEAF — surgical** |
| objective audio ×N | `targetSL`, E3 | — | **LEAF — surgical** |
| story-sentence audio ×≤5 | story sentence, E3 | — | **LEAF — surgical** |
| frame image ×N | frame `imagePrompt`, **sheet (anchor)**, E4/style/format | — | **LEAF — surgical** |
| scene image | `sceneImagePrompt`, **sheet (anchor)**, E4/style/format | — | **LEAF — surgical** |
| **reference sheet** | asset bible, E4/style/format | **all frames + scene** | **INTERIOR — cascade, NOT surgical** |

**Surgical force-regenerate allowlist** = `{ opening audio, objective audio, story audio, frame image, scene image }`. A frame/scene regen reads the **existing** sheet to anchor. The **reference sheet is forbidden** as a surgical target (regenerating it ⇒ regenerate all frames + scene) — the skill rejects `--regen sheet`. *(Caveat: the sheet→frame/scene dependency is real but the cache tracks it only via a manual global `styleId` bump; making it automatic + per-scenario is PLANNED.)*

**Content-edit fan-out** (distinct from force-regen):
- *Single-fan-out (one leaf → effectively surgical):* opening text→opening audio · one story sentence→its audio · one frame `imagePrompt`→its image · `sceneImagePrompt`→scene.
- *Multi-fan-out (NOT surgical):* **`targetSL(i)`** → objective audio + story (must still contain it)→story audio + `frame.lineSL` + possibly the frame's atomic concept + the runtime tutor prompt. **asset bible / any descriptor** → sheet → all frames + scene.

**Runtime-composed (no stored asset, no regen):** `character`, `setup`, `register`, objective `label`, `hintEN` feed `buildSystemPrompt` fresh each turn — edits are live next turn.

**Global config (type-wide recreation, not surgical):** E3 voice/provider → all audio · E4 provider/model → all images · `IMAGE_STYLE.id` → all images (also the manual sheet-change lever) · `IMAGE_FORMAT[type]` → that type.

## Deferred (PLANNED — not this contract's MVP)

- Headless / tutor-initiated requests (the tutor identifying adjacent or crucial learning) replacing R's manual brief.
- Cross-session orchestration deciding *which* scenario comes next and *when* objectives resurface (the orchestration layer over `LearnerProfile`).
- Automating the naturalness check so it no longer needs R.
- The shared asset catalog (cross-scenario consistency) — assets are per-scenario until then.
