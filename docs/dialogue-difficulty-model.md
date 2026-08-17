# Dialogue difficulty is computed, not authored — the A1 tag + band model

**Status:** implemented (operator, 2026-08-15; built out 2026-08-16). See
[rehearsal-dialogues.md](rehearsal-dialogues.md) (data model + authoring) and
[a1-taxonomy.md](a1-taxonomy.md) (the A1 competency reference).

## 1. The A1 lint is a difficulty yardstick

`lint:a1` **classifies** how advanced a dialogue is and reports its band; all content ships at whatever band
it measures, and above-A1 language is **labelled** by band. The lint **gates on integrity** — every `a1-map`
reference resolves in the catalog — and everything else is a **readout**: the band per dialogue, and which
learnables sit in the tagged superset versus the curated core. It reads the map; it grows the map only when
the operator promotes an item (§7).

## 2. Two-tier A1 — a curated core, a tagged superset

- **CORE** = the curated `a1-map` mappings ([a1-taxonomy.md](a1-taxonomy.md)): a small Pareto set of the
  highest-frequency, highest-leverage survival language. It **grows by deliberate promotion** (§7), which is
  what keeps its signal sharp.
- **Tagged-A1** = catalog learnables carrying the `a1: true` tag — the **superset** of "also A1 material"
  (CORE ⊆ Tagged-A1). The tag is the **primary signal** the classifier reads, and a run grows it freely.
- A new learnable gets a **deliberate A1 decision as it is minted**: tag it `a1: true` when it is A1 material.
  The tag is the standard home for A1 material; the core stays the Pareto few, entered by promotion.

## 3. The three bands (computed per dialogue)

Measured over the dialogue's **produced (client) learnables** (NPC receptive lines are not learnables):

| Band | Rule |
|---|---|
| **Basic** | the dialogue is **short & simple** AND **≥80%** of its content is from the **CORE** (`a1-map`). |
| **Intermediate** | **≥80%** of its content is **Tagged-A1** (the superset). |
| **Advanced** | anything beyond that threshold (**<80%** Tagged-A1). |

Basic & intermediate remain **A1-focused**, so introducing new A1 learnables stays a value at those bands.
**If a dialogue introduces no new learnables, check the catalog first** — it may be missing A1 items it
should carry.

## 4. levelLabel is derived from the computed band

The dialogue's `levelLabel` is **assigned from the computed band, after authoring** — the classifier sets it.
What the author needs is to **understand how the bands are derived** so they can *aim* content at a target
level; the determination happens post-authoring. Ordinal `level` (for tab ordering) is likewise derived —
order dialogues by ascending band.

## 5. Trees support more than two choices

- A node may offer **more than two client choices**.
- A **context** (e.g. *the book is damaged*, *your card has expired*) is carried **either explicitly in the
  choice text or as a parenthetical** on the choice — so an outcome that depends on context is a branch the
  learner selects.
- When more than one choice is present, the client shows a **visual indicator so the user can scroll through
  the options** (rendered in [public/app.js](../public/app.js)).

## 6. What this unlocks

A native-authored, situation-organized, complication-rich scenario (the library flowchart is the worked
example) is **buildable close to as authored**: its complications are choices/parentheticals, its full A2–B2
spread is carried by band classification, and its breadth is preserved.

## 7. Operating headlessly — conventions hold, deviations become recommendations

A headless run keeps the **deterministic gates as its only hard stops** (tree structure, catalog integrity,
`a1-map` ref-integrity) — those guard genuinely-wrong output. Wherever the run's *aim* meets a *convention*,
it **produces convention-honoring output and carries a specific recommendation into its final report** for
the operator to ratify. Two cases recur:

**Growing the core.** The standard home for any new A1 learnable is the `a1: true` tag, which is all the
classifier needs. When a new learnable clearly clears the core's bar — very high frequency *and* broad unlock
leverage, essential survival language — the run tags it `a1: true` as usual **and records a core-promotion
recommendation** naming the item and why it qualifies. On the operator's go-ahead the item joins the
`a1-map`, and the affected bands recompute. The run proceeds within convention; the operator owns the core.

**A lesson aimed at Basic that computes Intermediate.** This is a signal to evaluate, and the run picks the
true reading:
- *The lesson leans on new above-core language it doesn't need* → revise it toward already-core survival
  language so it legitimately reaches ≥80% core and lands Basic.
- *The lesson genuinely rests on a few extremely high-leverage items the core happens to lack* → **ship it at
  the computed Intermediate band** and recommend promoting those specific items to the core. On the operator's
  go-ahead the core updates and the band recalibrates to Basic.

So the run ships correct, convention-honoring output and hands the operator a short, firm list of the
promotions it recommends — a silent override or a mid-run block on a judgment call is neither needed nor used.

## Decided specifics

- **Measurement basis:** produced/client learnables only (a level's `introduces` set).
- **"Short & simple"** (basic gate): a node ceiling of **≤16 nodes** (`BASIC_NODE_CEILING`).
- **Lint:** gates on `a1-map` ref-integrity; band and coverage are a readout, never a block; the core is never
  force-filled.
- **Tag:** `a1: true` on the catalog learnable, set at mint by author/critic.
