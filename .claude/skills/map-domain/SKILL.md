---
name: map-domain
description: Map a domain a learner wants to tackle next (a market stall, a dog walk, the pharmacy) into what the rest of the app builds from — the minimal card of vocabulary, phrases and sentence stems the learner must produce, the situation map of the independent actions they take there and how each can turn out, and a banded dialogue plan — then register the card and the live scene, and write the handoff that lets a fresh session author the tap trees with create-tap-tree. Use when the user wants to "map a domain", "plan a new scenario from scratch", "what does the learner need for <situation>", or to start a domain the way the market stall was started. The market stall (`trznica`) is the reference; the library is the reference for how situations branch.
---

# map-domain — from a domain to a card, a situation map and a dialogue plan

**A domain is mapped** when it names:
- the essential words, phrases and sentence stems a learner must produce to carry out the minimal actions
  of that domain;
- the learner's own use cases, the specific things they need to do there;
- the independent actions a person takes in the domain, each with its outcomes;
- a dialogue plan that walks those actions from basic to advanced.

Everything the domain needs is on its card, **whether or not it is already in the catalog, and whatever
the learner's progress on it**. The card is what the dialogues are checked against, so an item left off
because the learner "already knows it" is an item no dialogue is obliged to include.

**Minimal means functional.** Every item earns its place by an action that fails without it. Nothing is on
the card for completeness.

**The references.**
- **The market stall** (`trznica`): `server/scenarios/trznica.json` (the card: `surfaces.live.core / bank /
  stock`), `server/scenarios/harness/trznica.md` (the live scene), `authoring/dialogues/trznica/` (the trees
  built from its plan). It is the shape of a finished map: a card with sentence stems that keep a beginner
  on track, and ten levels from basic to advanced.
- **The library**: `authoring/dialogues/library/reconcile-input.json`. It shows how one visit branches into
  sub-situations and outcomes (L6: register / renew / lost card, each with a success and a setback).

**Roles.** C is you. **R** is the operator: the learner, or the person speaking for them. R owns the domain
and its use cases and approves the map. **LS** is `slovenian-author`, which writes every Slovene string. The
**critic** is `scenario-critic`. C never writes Slovene.

## Stage 1 — Intake (R)

Get from R, in their words:
- **The domain**, and where it happens.
- **The learner's use cases**: what they specifically need to do there, beyond what anyone would.
- **The people the learner deals with** (the interlocutors). For each: who they are, and the register the
  learner uses with them. Usually vi to adult strangers, ti to children and friends.
- **The facts that change the Slovene**: the gender of anyone or anything the learner talks about (it sets
  *ga / jo*, *star / stara*); the gender of whoever speaks the learner's lines in the trees (it sets the
  first-person forms); names, which go in as slots and are never learnables.

Ask only for answers that change the language. Everything else takes a default, stated in the map.

## Stage 2 — The situation map (C, English)

List the **independent actions** the learner takes or faces in the domain, the way the library's topics
are independent: each is something that happens on its own, on a given day.

For each action, give its sub-situations and **how it can turn out**:
- **✓** it goes as hoped
- **~** the other person asks something back
- **✗** a complication

and **the decisions the learner makes in it**, each with the other person's reaction: yes, no, "yes,
but …", this one or that one, ask first or wait. A refusal is a decision like any other and gets its own
reaction (they understand, they are disappointed, they ask why).

Mark each action as **minimal** (anyone in this domain meets it) or **use case** (R asked for it).
Repair, being able to say you didn't understand, is an action in every domain.

Write it in the stall's map format: the root encounter, then one branch per action, with the learner's
lines as **O** and the other person's as **K**, in English intent for now.

## Stage 3 — The card, in English (C)

For each action, list what the learner has to **say** as meanings, then reduce:
- **Prefer a stem over a list of phrases.** One frame with a slot (*Imate danes ___?*, *Ali lahko ___?*)
  that serves several actions beats several fixed phrases. Stems are what keep a beginner's dialogue on
  track.
- **Minimality test, per item:** name the action that fails without it. No action, no item.
- **Sort into three lists**:
  - **core** — said in nearly every encounter; practised every live session
  - **bank** — the rest of the learner's lines, scheduled a few at a time
  - **stock** — the words that go in the stems' slots (the goods, the body parts, the times)

Alongside the card, list the **heard-only lines**: what the other people say that the learner must
understand to act (a price, *Tega danes nimam*, *Lahko ga pobožam?*). These are never minted. They go into
the harness and the trees.

## Stage 4 — The card, in Slovene (LS, then the critic)

**LS** writes, per item:
- the citation form, per the minting rubric (docs/rehearsal-dialogues.md › The minting rubric; a frame that
  inflects is cited with its alternants)
- a gloss, and the one predictable error
- the register it is said in

It also writes each heard-only line in Slovene.

**C joins every item to the catalog** (`server/catalog/learnables.json`): an existing id with the same
lexical item is **reused and still listed on the card**; the rest are new mints.

**The critic** checks the card, with the situation map beside it:
- native, not textbook
- register right for each interlocutor
- **no gaps**: every action has the learner lines it needs
- **no padding**: every item passes the minimality test
- the stems cover the actions they are meant to cover

Its fixes are applied once. Anything it could not settle goes to R.

## Stage 5 — The dialogue plan (C)

Cut the situation map into levels, as the stall plan did:
- **Every level is a whole encounter**: the opening, the business, the close. The core lines come back in
  every level because every encounter needs them.
- **Every level is built on the learner's decisions.** Each choice leads somewhere different: the other
  person reacts to what the learner chose. **Basic** levels give decisions with simple consequences
  (which dog, yes or not now, how to leave). **Intermediate and advanced** levels add the map's outcomes,
  where the world decides as well. The last level is the longest tree in the domain: it strings the
  actions into one encounter with many outcomes, refusals among them, and introduces nothing.
- **Each card item is introduced in exactly one level and said again in at least one later level.** In the
  stall, 22 items were said in only one tree; plan the reuse here, where it is free.
- Basic levels lean on core items. A basic tree computes as Basic only when 80% of its lines, the other
  person's included, carry a core item and nothing above A1 (docs/dialogue-difficulty-model.md §3). Two
  stall levels aimed at Basic missed it.
- **The bank is ordered by the level that introduces each line**, so the live scene asks for what the trees
  just taught. The live scene opens after the level that completes the core.

For each level give: band, title, the actions and outcomes it covers, the learner's decisions and where
each leads, what it introduces, what it reuses.

## Stage 6 — The map, to R

Write `.scratch/dialogue-drafts/<scenarioId>/domain-map.md`:
1. **Settings** — the domain, the interlocutors with their registers, the voices, who speaks the learner's
   lines and their gender, the facts, the defaults taken.
2. **The card** — core, bank, stock. One row per item: id, Slovene, English, kind, `existing` or `new`, the
   actions it serves.
3. **Heard-only lines.**
4. **The situation map.**
5. **The dialogue plan.**
6. **Decisions for R** — each proposal with English beside the Slovene:
   - which new items to tag core (the rest are A1)
   - register choices
   - voices
   - anything LS or the critic could not settle

R approves, or returns notes; one pass on the notes, then back to R.

## Stage 7 — Register the domain (after approval)

1. **The catalog.** Mint the new items. Tag the core ones `core: true, a1: true` and the rest `a1: true`.
   Place every tagged item in `server/catalog/a1-map.json` under the competencies it serves.
2. **The live scene.**
   - Write `server/scenarios/<id>.json` with `surfaces.live`: `harness`, `close`, and `core / bank / stock`
     in plan order.
   - Have LS write the harness, `server/scenarios/harness/<id>.md`, in the shape of the stall's: who the
     tutor is, what the world holds, the learner's lines, the other person's lines, how an encounter runs.
     The close line is one of the heard-only lines. Have the critic read it.
3. **Check it:**

   ```bash
   npm run lint:a1 && npm run test:learnable
   npm run prompt:live -- <id>     # read the whole prompt as the tutor will
   ```

   Commit.

**Before the live scene is used, check these against the domain** — each is a limit of the app today:
- **The scene prompt's own text was written for a stall.** `scenePrompt` in `server/live/prompt.ts`
  says "learning to buy at a stall like yours", opens on «Dober dan.», and runs "a second, shorter
  purchase". A domain that is not a purchase needs that text generalised before its live scene is
  right. Name this to R; it is a code change, not part of this skill.
- **A scenario has one register.** A domain with several interlocutors in different registers (vi to
  adults, ti to children) holds them per line in the trees and the harness. Say so in the handoff.
- **A tap-tree scenario has one npc voice.** Interlocutors who need different voices (a child) mean either
  one voice for all, or one scenario per voice. R decides.
- **The same line in the same voice is one clip, across scenarios.** Reusing another scenario's npc voice
  means its existing clips can play in place of the new lines. The stall hit this with the bakery's
  voice.

## Stage 8 — The handoff

Write `.scratch/<yyyy-mm-dd>-handoff-<scenarioId>-tap-trees.md` for a fresh session. Its objective is to
author every level in the plan with **create-tap-tree**, on the "the plan exists" path. It carries:
- **Anchors**:
  - `.claude/skills/create-tap-tree/SKILL.md`
  - the domain map (gitignored: say it exists on this machine only)
  - the scenario manifest and its card
  - the stall's `authoring/dialogues/trznica/reconcile-input.json` as the nearest worked example
- **Decisions**, in full: interlocutors and registers, voices and who speaks the learner's lines, the
  facts (genders, the name slots), the tags R approved, the bank order.
- **State**: the branch and commit, and that the card and the scene are registered.
- **Open**: every Stage 7 limit that applies to this domain, and anything R left open.

Point the next session at the handoff, not at this conversation.

## Out of scope

Authoring the trees (create-tap-tree). Spoken lessons (create-dialogue). Changes to the live tutor's code.
Audio generation.
