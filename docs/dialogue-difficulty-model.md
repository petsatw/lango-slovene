# Dialogue difficulty is computed, not authored — the A1 tag + band model

**Status:** implemented (operator, 2026-08-15; built out 2026-08-16). See
[rehearsal-dialogues.md](rehearsal-dialogues.md) (data model + authoring) and
[a1-taxonomy.md](a1-taxonomy.md) (the A1 competency reference).

## 1. The A1 lint is a difficulty yardstick

`lint:a1` **classifies** how advanced a dialogue is and reports its band; all content ships at whatever band
it measures, and above-A1 language is **labelled** by band. The lint **gates on integrity** — every `a1-map`
reference resolves, and every core and/or A1-tagged learnable is placed in the map (§2) — and everything
else is a **readout**: the band per dialogue, and its core/A1 line counts.

## 2. Two-tier A1 — a core flag, a tagged superset

- **CORE** = the learnable's own **`core: true`** flag: a small set of the highest-frequency,
  highest-leverage survival language. One flag, one source of truth, read by the classifier, mastery
  selection and the authoring gates alike. It **grows by deliberate promotion** (§7), which keeps its
  signal sharp.
- **Tagged-A1** = catalog learnables carrying the `a1: true` tag — the **superset** of "also A1 material"
  (CORE ⊆ Tagged-A1). The tag is the **primary signal** the classifier reads, and a run grows it freely.
- A new learnable gets a **deliberate A1 decision as it is minted**: tag it `a1: true` when it is A1 material.
  The tag is the standard home for A1 material; the core stays the few, entered by promotion.

### What the a1-map is

The `a1-map` ([a1-taxonomy.md](a1-taxonomy.md)) is **only** a mapping of competencies to learnables that are
core and/or A1-tagged. It answers *which life domain does this item serve, and how far along is the learner
in that domain* — it does **not** answer *is this core*. It is many-to-many by design (`hvala` serves both
`pragmatics` and `personal_relations`), which is exactly the right shape for coverage.

Its one live product job is `GET /api/a1`, the **A1 Readiness screen** — the only place progress is visible
to the learner, and the finite map the no-measures invariant promises. So a core/A1-tagged item that reaches
the catalog without landing in the map can be mastered with nothing moving on screen; `lint:a1` fails on
exactly that.

## 3. The three bands — measured PER LINE, not per level

**The unit of measurement is the line, not the level.** A line is what the learner actually faces; counting
learnable *ids* instead weighs a noun as a demand equal to the frame it sits inside, so a lesson of nine
core frames with a word dropped into each slot scores as a mixed bag rather than the 9/9 core it is.

### Classifying one line

From the `learnables` on that node:

| | |
|---|---|
| **core line** | contains **at least one core item**, and everything else in it is A1 (or core) |
| **A1 line** | contains **no** core item, but everything in it is A1 |
| **outside line** | contains at least one item that is neither core nor A1 |

The core item is the frame; A1 vocabulary filling its slots rides along. `En kruh, prosim.` =
`en_masacc` (core) + `kruh` (A1) → **a core line**.

### Which lines count — the ONLY difference between the two surfaces

| surface | denominator | why |
|---|---|---|
| **spoken lesson** (`advance: "audio"`) | **client nodes only** | The band is what the learner is *required to produce*. The character's lines are input they are supported through — captioned, glossed, hint on tap — and are held to a **guideline** for the target band, not counted in it. |
| **rehearsal dialogue** (`advance: "tap"`) | **every node, npc and client** | A worked example is read and heard end to end, so the character's lines are exposure that counts. |

### The bands

| Band | Rule |
|---|---|
| **Basic** | **≥80%** of counted lines are **core lines** |
| **Intermediate** | **≥80%** are core-or-A1 lines **AND ≥50%** are core lines |
| **Advanced** | **≥75%** are core-or-A1 lines |
| *(below that)* | above A1 |

**Length is not an input** — see "Decided specifics".

### What this requires

`learnables` on **every** node, npc included. On an npc node it means *what this line is made of*; it is
**not** a crediting instruction — crediting stays client-only and spoken-only (docs/free-conversation.md).
A dialogue whose nodes carry no `learnables` falls back to the per-`introduces` count until it is tagged
(`lint:a1` reports which basis each band was computed on).

**Two open questions**, to settle once real tagged data exists rather than by guessing now:
- **An untagged line** is either trivial or above-A1 language that was never minted. Those are opposite
  answers and the data can't yet tell them apart, so an untagged line is currently excluded from the
  denominator and counted in a separate `untagged` tally.
- **A multi-sentence node** (`Me veseli! Jaz sem Slavko. Zdaj pa še ti.`) takes one classification, where
  the same content split across three nodes takes three. Decide whether the unit is the node or the
  utterance.

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

- **Measurement basis:** lines, per §3 — client nodes for a spoken lesson, every node for a rehearsal
  dialogue.
- **Length is NOT a band input.** Length is amount, not difficulty: a long lesson built entirely of core
  survival language, heavily scaffolded and recycling what the learner already owns, is easier than a short
  one carrying three above-core items. `lint:a1` still reports node count beside the band, and per-level
  size guidance lives in AGENTS.md › Lesson shape. **Core utilisation decides the band.**
- **Lint:** gates on `a1-map` ref-integrity and readiness coverage (§2); the band is a readout, never a
  block; the core is never force-filled.
- **Tag:** `a1: true` on the catalog learnable, set at mint by author/critic.
