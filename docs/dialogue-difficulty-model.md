# Dialogue difficulty is computed, not authored — the A1 tag + band model

**Status:** adopted design direction (operator, 2026-08-15). Parts are **not yet implemented** — this doc is
the target the next build works toward. See [rehearsal-dialogues.md](rehearsal-dialogues.md)
(data model + authoring) and [a1-taxonomy.md](a1-taxonomy.md) (the A1 competency reference).

## 1. The A1 lint is a difficulty yardstick

`lint:a1` **classifies** how advanced a dialogue is and reports its band; all content ships at whatever band
it measures, and above-A1 language is **labelled** by band. The lint hard-fails only on catalog **integrity**
— every learnable must resolve in the catalog.

## 2. Two-tier A1 — a narrow core, a tagged superset

- **CORE** = the curated `a1-map` mappings ([a1-taxonomy.md](a1-taxonomy.md)). Deliberately **narrow** — the
  high-frequency survival core. **Do not dilute it.**
- **Tagged-A1** = catalog learnables carrying an **A1 tag** — a **superset** of "also A1 material" that does
  not touch the core (CORE ⊆ Tagged-A1). The tag is the **primary signal** the lint reads.
- A learnable that is new to the catalog gets a **deliberate tag-or-not-A1 decision as it is added** — judge
  each item on its merits and tag it when it is A1 material.

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

## Open specifics to finalize at implementation (working defaults)

- **Measurement basis:** produced/client learnables only *(default above).*
- **"Short & simple"** (basic gate): a node/turn ceiling (≈ the current L1 sizing, ~16 nodes) with no deep
  nesting — exact number TBD.
- **Lint hard-fails:** catalog-resolution integrity only; band is emitted, never blocks.
- **Tag field shape:** a field on the catalog learnable (e.g. `a1: true`, or a `cefr` value), set at mint time
  by author/critic. Final shape TBD with the catalog schema work.
