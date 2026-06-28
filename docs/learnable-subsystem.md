# The Learnable Subsystem — cross-session memory

**Status: built (the mastery loop), with steering still ahead.** The durable layer described here is
implemented — see the build spec [learnable-subsystem-spec.md](learnable-subsystem-spec.md) and the
free-conversation ethos [free-conversation.md](free-conversation.md). What's *not* yet built is the
**tutor-that-leads** steering/selection over this model (ROADMAP item 5) and the bounded
situation-first selection for live free conversation (its current live path is a naive first cut; the
**seed onboarding** is the built Phase 1). This is the subsystem that gives Govori memory *across*
sessions — [ROADMAP.md](ROADMAP.md) item 4, absorbing item 6 (variant latitude). It supersedes the
earlier "pattern subsystem" framing: a *pattern* is now one **kind** of learnable. Present-state
architecture: [ARCHITECTURE.md](ARCHITECTURE.md).

Captured intent — the interview decisions, the canonical user stories, and the mastery-loop flows — is in
[learnable-subsystem-stories.md](learnable-subsystem-stories.md). Read it alongside this doc; where the
two differ, the stories doc reflects the **latest user decisions** and wins.

This doc deliberately defines **structure** and **capabilities** — what the subsystem *is* and what it
must *do* — and stops short of the mechanisms (thresholds, scheduling math, attribution logic). Jumping
to mechanism here is what makes it brittle — counters standing in for judgment, fixed rules for taste —
so the mechanism follows once the capability and its success signal are clear.

## The one idea

Everything the learner masters is a **learnable**. There are three kinds — **vocabulary**, **chunk**,
**pattern** — and only learnables carry durable, cross-session mastery. A scenario's **objective** is
*not* a learnable: it is a delivery construct that drives the learner to produce one or more learnables
in a scene. **Assets** illustrate learnables, many-to-many. The subsystem is the catalog of learnables,
the per-learner memory of how well each is owned, and the means to bring the right one back.

## Structural decisions

These are the load-bearing *shape* choices (not mechanisms):

1. **The learnable is the unit of mastery.** Three kinds (below). Everything the learner gets durably
   better at is one of them.
2. **Objectives deliver; they own no assets.** An objective is authored per scenario, **references one
   or more learnables**, and structures how they're elicited and sequenced in the scene. Visuals come
   from its learnables, not from the objective.
3. **Assets illustrate learnables, many-to-many.** One `car` image serves both the vocabulary `avto`
   and a chunk like `Vstopi v avto`. Assets attach to learnables, never to objectives.
4. **Acceptance is the model's judgment.** Whether a learner communicated acceptably is decided by a
   capable model in context, not by matching against a rule or a canonical string.

## The three learnable kinds

Descriptive categories that guide how a learnable is taught — not a rigid switch (see the *fit-for-kind*
capability below):

| kind | is | example |
|---|---|---|
| **vocabulary** | a single atomic lexeme — a word of any part of speech (noun, verb, adjective, adverb …), in base form | `avto` (car, n) · `piti` (to drink, v) · `dober` (good, adj) · `hitro` (quickly, adv) |
| **chunk** | a fixed multiword phrase produced whole; morphology baked in | `Vstopi v avto`, `Koliko stane?`, `Ne razumem` |
| **pattern** | a frame with an open slot; productive, reused with many fillers | `eno/ena ___`, `Moram + INF`, `sem/bom + -l` |

A pattern's open slot is filled by vocabulary — `Moram + [piti]`, `eno + [kavo]` — which is why
vocabulary spans every part of speech, not just nouns: a pattern needs verbs, adverbs, and the rest as
fillers.

A pattern's slots take three shapes, all drawn from the core-patterns research:
- **fill in the blank** — one slot between fixed words: `Eno ___, prosim` ("one [coffee / beer], please").
- **fill in the blanks** — a set structure with two variables: the periphrastic tense `[sem/bom/…] + [-l participle]` — pick the auxiliary (tense/person) *and* the verb (`Sem jedel` = I ate · `Bom pil` = I will drink).
- **sentence stem** — begin or complete an open sentence: `Rad / Rada bi ___` ("I'd like …": *Rad bi kavo* / *Rad bi plačal*).

The earlier *chunk/stem/seed* typing collapses into these three kinds: a *chunk* is its own kind, and a
*stem* is just a **pattern**. There is no separate *seed* — that named *when* a high-leverage learnable
is first introduced and how persistently it returns, a curation and scheduling concern (capabilities
**D** and **G**), not a structure. `biti + l-participle` is simply a high-leverage **pattern**. All three
kinds live in **one learnable catalog** (the language catalog), parallel to the asset catalog.

## Entities & relationships

| entity | is |
|---|---|
| **learnable** | vocabulary · chunk · pattern — the unit of mastery (one learnable catalog) |
| **objective** | a scenario-delivery construct: references learnables, structures elicitation/sequence |
| **scenario** | a bounded transaction; ordered objectives + a scene |
| **asset catalog** | objects · characters · concepts/locations · voices (unchanged) |
| **learner model** | per-learner durable memory of how well each learnable is owned |

| edge | meaning | cardinality |
|---|---|---|
| objective **references** learnable | the learnables this objective exercises | 1..N |
| learnable **illustrated-by** asset | a visual/audio that depicts it | 0..N, many-to-many |
| scenario **practises** learnables (via its objectives) | derived | — |
| learner-model **remembers** learnables | durable, cross-session | — |

## Capabilities — what it must do, and how you'd know it works

Each capability is a need plus the signal that's **abundantly evident** when it's being met. The
mechanism is intentionally not specified here.

### A. Know how well each learnable is owned
**Need:** for each learner, tell apart "owns it" (produces it readily, unaided, across contexts) from
"shaky" from "not yet" — well enough to act on the difference.
**Evident when working:** the learner stops being prompted on what they already say cold and
unprompted; shaky learnables keep returning until they're easy; the learner produces it without hesitation or correction

### B. Credit what the learner actually demonstrated
**Need:** when one utterance exercises several learnables, know which ones the learner truly commanded
and which they fumbled or were carried through — not score the whole utterance as one lump.
**Evident when working:** credit lands where the skill was shown; someone who nails the **vocabulary**
but stumbles the **pattern** sees the pattern come back and the vocabulary settle; the record matches
what an attentive tutor would say the learner actually did.

### C. Teach and assess each learnable as it's actually used
**Need:** drill a **vocabulary** item as a single word, a **chunk** as a whole phrase, a **pattern**
across varied fillers — and stay sensible for items that sit between kinds.
**Evident when working:** practice feels right for the kind (no parsing a **chunk** into parts, no
memorizing a **pattern** as a fixed string); borderline items are still handled well; nothing is
mistaught because it was filed under the "wrong" kind.

### D. Make every scenario real practice of core learnables
**Need:** each scenario gives genuine, useful practice of high-leverage core learnables, so the system
always has real opportunities to bring back what's due.
**Evident when working:** due learnables get meaningful reps as the learner moves through scenarios; a
token mention doesn't satisfy it; a reviewer would agree the scenario actually exercises its core
learnables.

### E. Correct in the way that most helps, right now
**Need:** when more than one thing is worth correcting, choose what to fix, how much, and whether to fix
at all — in character, without overwhelming or discouraging.
**Evident when working:** corrections feel like conversation, not a grammar drill; the learner isn't
buried; the fix that most unblocks them is the one that surfaces; a good-enough turn is sometimes allowed
to ride to build momentum; over time the learnable that was holding them back improves.

### F. Remember across sessions, simply
**Need:** persist enough per-learner state to support the above, kept small and swappable; a returning
learner is met where they left off.
**Evident when working:** close the browser, come back days later, and the tutor still knows what's owned
and what's due; no returning session starts from zero; the stored state stays small and replaceable.

### G. Bring the right learnable back at the right time
**Need:** resurface a learnable when it helps it stick, and route the learner to scenarios that exercise
it — led by what the learner needs and cares about, not a fixed timetable.
**Evident when working:** shaky and aging learnables reappear in fresh contexts before they're lost;
what the learner is working toward shows up; resurfacing feels timely, not mechanical or nagging.

## How it wraps the rest of the app

- **Scenarios** are where learnables get practised — capability **D**; the authoring rubric + critic
  judge whether that practice is real (the linter can only check that it's present).
- **The asset catalog** relates to this subsystem only through the learnable **illustrated-by** asset
  edge; the relational ontology is unchanged.
- **The turn loop** ([orchestrator.ts](../server/orchestrator.ts) / [prompt.ts](../server/prompt.ts)) is
  the inner loop: it produces the in-context judgment of what the learner did and how to respond
  (capabilities **B**, **E**). The learner model + resurfacing (capabilities **A**, **F**, **G**) are the
  outer loop that decides what to practise across sessions and prepends due learnables at the start of a
  run. The single-session rules stay as the inner loop; this subsystem is the outer one around them.

## Open questions (genuine unknowns, not deferred mechanism)

- How the kind boundaries are drawn in authoring practice (vocabulary vs. chunk vs. pattern) — needs
  guidance, since the line is a judgment.
- How a non-visual learnable is cued for practice without an image (a carrier situation) — authoring
  format.
- Whether the "predictable error" hint belongs on the learnable, the objective, or both.
- What marks a learnable as "core" / high-leverage — capabilities **D** and **G** lean on this set; the research ranks it, but how the catalog designates and curates it is unspecified.
- The dual (`dve …`) — one chunk, or deferred.

## In one line

Learnables (vocabulary · chunks · patterns) are what you master; objectives deliver them in scenes and
own no assets; assets illustrate learnables many-to-many; the model judges in context; the learner model
remembers across sessions.
