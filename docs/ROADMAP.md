# Roadmap — where this is going

**The goal:** immersive, genuinely effective language learning that scales to any situation, any
learner, and any language — and that anyone can run and extend.

This doc is the map. Present state is in [ARCHITECTURE.md](ARCHITECTURE.md); here is the future state
and, from first principles, the pieces required to get there.

## The future state, plainly

- A learner says what they need to handle in Slovene — or the tutor suggests it — and gets an
  immersive scene to practice, on demand.
- The tutor **remembers them**: what they've mastered, what's still shaky, and brings it back at the
  right moment across sessions.
- The tutor **leads**: it notices what the learner cares about and takes them deeper or wider, instead
  of running a fixed script.
- It isn't only Slovene, and it isn't only ours: the engine is language-agnostic, and any builder can
  take it and run.

## First principles — what effective learning at scale requires

Effective acquisition needs: real, comprehensible practice in situations the learner actually faces;
the learner doing most of the talking and being corrected naturally; coverage of whatever they need;
memory over time so things harden; a tutor that adapts and leads; and the whole thing cheap enough to
run and open enough to spread. Each requirement maps to one piece below.

## The pieces

**Built**

1. **Real-situation practice that understands broken speech.** Hold-to-talk, mixed English/Slovene
   in, native Slovene out, corrections by recast. *(the turn loop)*
2. **The app owns the teaching.** Deterministic mastery rules in the server, prompt rebuilt from
   state each turn. *(single-session)*
3. **On-demand, quality-gated scenario generation.** Author → deterministic lint → independent
   critic → ship. A `--self-directed` mode discovers the best *next* scenario itself, from the existing
   repertoire + the research principles. *(runs today as an agent skill)*

Also built — a lighter third conversation surface: **rehearsal decision-tree dialogues.** Pre-authored
branching exchanges paired with a scenario at ascending competency levels, with pregenerated per-speaker
audio and optional delivery-note voice direction. Comprehensible-input *introduction* (no mic, no credit
from the tree), now tied to catalog learnables and wired to hand the learner into a biased free chat that
reinforces them — the introduce-then-reinforce loop; [rehearsal-dialogues.md](rehearsal-dialogues.md).
Item 12 (a+b) is built; what remains is auto-selecting which dialogue comes next (item 5).

**To build — in dependency order**

4. **Memory across sessions — ✅ BUILT (the mastery loop)** *(unlocks 5).* Implemented as the durable
   **learnable** layer: a per-learner on-disk model counts per-learnable productions, mastered at a
   threshold (5), flub-decrement, credited per-learnable from the E2 verdict, accrued across sittings;
   plus free conversation and the audio-only onboarding **seed**. Mechanism + build:
   [learnable-subsystem-spec.md](learnable-subsystem-spec.md); ethos: [free-conversation.md](free-conversation.md).
   *Remaining within this area:* bounded **situation-first selection** for live free conversation (the
   live path is a naive first cut today; the seed is the built piece) — folds into item 5. Original
   framing below, retained for context:
   A persistent learner model with an
   `attempted → completed → mastered` lifecycle: an objective reaches *mastered* only on repeated
   correct production, as the *same* objective recurs in different scenarios over time. Requires a
   **shared objective catalog** — common objectives (greet, ask-to-repeat, …) defined once and
   referenced by id across scenarios, so a correct production anywhere counts. Mastery is
   **count-based** (interview-settled): a learnable is mastered after a threshold of successful
   productions (currently 5, tunable), credited on any understandable-and-correct production —
   prompted, echoed, or cold — accrued across sittings and contexts, with a flub resetting it. The loop
   already encourages **uptake** in several forms: a recast never counts (the learner must re-produce the
   form themselves to advance), productions count across contexts and sittings toward the threshold, and
   the single-retry ratchet ranges from an unaided open prompt to a handed-over leading choice. No
   separate gate is needed — the panel's internal "forced/enforced-uptake" label is dropped as
   confusing. Mastery is deliberately out of the single-session MVP and only works once the same
   learnable resurfaces across days and contexts.
   **Full subsystem design:** [learnable-subsystem.md](learnable-subsystem.md) (structure/capabilities)
   + [learnable-subsystem-stories.md](learnable-subsystem-stories.md) (decisions · user stories ·
   mastery-loop flows) — patterns + vocabulary as durable masterable units, the
   learner-model store, and how it wraps the turn loop. It absorbs item 6 (variant sets attach to
   patterns/objectives). The core pattern library itself:
   [research/core-pattern-library-2026-06-26/](research/core-pattern-library-2026-06-26/RANKED-PATTERNS.md).
5. **A tutor that leads, not just reacts.** An orchestration layer over the learner model that chooses
   what scenario/objective comes next from the learner's goals and history, schedules when things
   resurface, and lets the tutor go deeper or broader. This is the "tutor-as-agent" step — and its
   learner-facing surface: a selector of what to practice next and a "completed" review view, fed by
   the learner model. The **edge-finding** free-conversation level lives here: a learner-pickable mode
   that leans on already-familiar learnables as stepping stones to probe where the learner's limits are
   and where they want to go broader or deeper — distinct from the mastery loop (4).
6. **Accepted-variant sets** *(independent — buildable now; no dependency on 4–5, so it can be pulled
   ahead of the memory keystone, exactly as the asset work was).* Each objective carries an authored,
   register-tagged **set** of accepted Slovenian variants instead of one brittle canonical string, and
   acceptance matches against the set (deterministic; defer semantic/fuzzy match to later). This is the
   research panel's most-cited weak link and a flagged "do-now" item. Scope: a `variants` field on the
   objective schema + the acceptance check, plus a variant-set criterion in the authoring rubric and
   critic. *(Promoted out of the [scenario-authoring.md](scenario-authoring.md) PLANNED list — it was
   mis-bundled there with the persistence-gated deferrals.)*
7. **Consistency at scale — rescoped to an audio + fine-tuning pass** *(foundation shipped).* The
   relational-ontology **foundation is built**: a shared **catalog** referenced by id — objects,
   **actors** (cross-media characters that point at a figure object), composed **concepts** including
   reusable **location sets**, and voices; per-asset canonical renders composed on demand into per-image
   labelled montages; scenes composed on build-once location sets, so cost is *sets + scenes*, not
   *sets × scenes*; identity metadata; and a render-vs-rekey toolkit with **decision-gated** propagation
   (see [asset-pipeline.md](asset-pipeline.md)). **Image** consistency is established. *Remaining,
   rescoped to where the gaps now are:* **audio** consistency and quality (voice-profile coherence,
   native-acoustic polish), image fine-tuning, and the optional dependency-aware "what would
   re-rendering this invalidate" view.
8. **An engine anyone can run — any agent, any language.** The authoring procedure (rubric + gates +
   scripts) made tool-neutral, so it runs with Claude, Gemini, Codex, or a careful human — not only
   the Claude skill — plus a language/voice config seam so Slovene is the first target, not a
   hard-coded assumption.
9. **Sustainability.** Generated assets cost money to make. Serve them free now (a downloadable
   bundle), optionally as a paid bundle later, so generation cost can be recouped. *(started:
   `npm run fetch:assets`)*
10. **Motivation & retention.** Incentives, streaks, the game of coming back. Duolingo shows this can
    carry a product even when the underlying acquisition is weak. It comes after the acquisition
    mechanics (memory, leading, real practice). Until this item, the learner model tracks mastery
    internally and surfaces no scores, streaks, or progress framing.
11. **Pronunciation review on record-and-compare.** Add a pronunciation-feedback feature to the existing
    record-and-compare practice. Record-and-compare is local and unassessed today, so it does not feed
    the mastery loop; this would give it its own pronunciation review.
12. **Introduce-then-reinforce loop — rehearsal dialogue → free chat** *(builds on 4; folds into 5).*
    Make the **rehearsal decision-tree dialogue the primary way to introduce new catalog items**: the
    learner first *meets* new vocabulary/patterns by clicking through a branching exchange that uses
    them (comprehensible input, hear-and-read, no pressure), then is **handed off into free chat to
    reinforce** those same items toward mastery. The division of labour that the iterations surfaced —
    **click-through introduces, free chat reinforces.** Sub-parts:
    - **(a) tie each dialogue level to catalog learnables — ✅ BUILT.** An `introduces: string[]` on the
      dialogue references catalog **learnables**, so "what was just introduced" is a concrete set. The
      learnables are *derived from the dialogue's own approved lines* through a gated authoring step
      (author emits a catalog delta → critic → `npm run lint:dialogue` reconciles, dedup by canonical
      `sl`) — a repeatable process, not a one-off. Mechanics: [rehearsal-dialogues.md](rehearsal-dialogues.md).
    - **(b) hand off into a biased free chat — ✅ BUILT.** A "try it for real" button drops the learner
      from the tree into a free-chat session whose in-play target set is biased toward the introduced
      learnables (`selectForWitness` focus set), where the *existing* witness crediting earns mastery.
      The credit firewall is unchanged — biasing what's in play never widens what counts.
    - **(c) select *which* dialogue/level next — deferred to item 5** (the "tutor that leads"). Today the
      learner/operator picks the level.
    Rehearsal itself still credits nothing; mastery is only earned on the live mic.

## The critical path

Memory (4) is the keystone — it turns single sessions into real acquisition and is the precondition
for a tutor that leads (5). **Accepted-variant sets (6)** are independent of both and are the cheapest
high-leverage win left, so they can land first. The asset-consistency **foundation is already shipped**;
what remains (7) is an audio + fine-tuning pass. Tool-neutrality (8) is what turns "my project" into
"your engine." Everything composes around the memory keystone (4) and tool-neutrality (8) — the asset
foundation the rest scales on is already in place.
