# Stochastic consensus — ideal mastery loop & objective design

**Date:** 2026-06-20
**Question:** What does the ideal mastery loop look like, and how should we conceptualize/scope/organize objectives and short scenarios to best help a beginner acquire and practice Slovenian (adult expats)?
**Panel:** N=8, mix models (3 opus, 4 sonnet, 1 haiku). Synthesis: opus.
Personas: SLA domain expert, Skeptic, Pragmatist, First-principles, Systems thinker, End-user advocate, Historical researcher, Contrarian.

---

## SYNTHESIS

## Consensus
- **One objective = one self-contained, learner-producible utterance in a single turn is correct, not a constraint to fight.** (SLA expert, Pragmatist, First-principles, End-user, Historical). First-principles dissolves the known tension: the other character's reply is "just the next trigger, not part of the objective." A barista counter-question = a second objective.
- **Shared objectives (greetings/farewells/openers) reused by reference across scenarios, not copied.** (SLA, Pragmatist, Systems, End-user) — global pool referenced by ID.
- **"Completed" must mean re-elicited recall, not a single hit.** (SLA, Systems, Historical; implicitly Contrarian). The pending→recast→completed states are an SRS skeleton; one success closing an objective = recognition, not mastery.
- **3-6 objectives per scenario** — tight quantitative cluster (3-6 / 4-6 / 3-4 / 3-5).
- **Comprehensible input (the story preview) scaffolds meaning before production.** (SLA, Historical, Contrarian).
- **Shared risk — the parrot trap.** 7 of 8 independently warn rigid single-phrase scripts produce learners who freeze when the real barista deviates. Most-cited concern.

## Genuine disagreements
1. **Production-first vs. comprehension-first** (the core split). Production-first: SLA, Pragmatist, First-principles, End-user, Historical + the design. Comprehension-dominant: Contrarian, partially Skeptic. Resolution: production-first wins for a low-stakes app targeting expats who avoid speaking, BUT the critique survives as a constraint — production must be preceded by comprehensible input and must not punish valid variants. Resolvable by sequencing input→output, not irreconcilable.
2. **Objective = canonical PHRASE or function SLOT with an acceptance set?** Canonical phrase: Skeptic, Pragmatist, End-user, current design. Function slot/acceptance set: First-principles (+ SLA, Contrarian). Cleanest reconciliation (First-principles): the atom changes shape across the arc — canonical phrase at hour zero, widening to an acceptance set as the learner becomes generative. Near-zero rebuild: only the objective record changes (single string → accept-list). Adopt the acceptance-set data shape now, seed with one form.
3. **Cross-scenario mastery GRAPH now, or curated FLAT list?** Graph: Systems thinker (prevents "completes café & pharmacy but never consolidates the greeting" local optimum). Flat list: Pragmatist + Systems' own counter. Resolution: flat list now — a global pool by ID captures ~80% of the graph's value; defer the graph (aligns with "revive the stalled group, don't build features").

## High-value outliers
- **Learner-initiated REPAIR chunk as a recurring objective** (SLA): "Še enkrat, prosim" / "Kako se reče...?" — most transferable A1 survival function; converts breakdowns into negotiated-meaning input; directly defuses the parrot-freeze risk. Highest-leverage single addition.
- **End-of-session TAKEAWAY CARD with copyable real text** (End-user): turns the app from homework into a next-day tool. (Note: a takeaway card already exists in the app — extend it to be copyable.)
- **TPRS "circling"** (Historical): tutor asks the same target many ways (yes/no, either/or, question-word) so the learner produces it 5+ times feeling like conversation, not drill.
- **Retrieval-before-display** (First-principles): learner must attempt from meaning, not by reading the target; if the preview shows the answer right before the prompt, you test mimicry.
- **Spiral via warm-up re-elicitation** (SLA): each new scenario opens by re-eliciting 1-2 prior chunks — spaced cross-scenario retrieval with zero learner-model infra.

## Recommendation
**What an objective fundamentally is:** a single communicative *intention* — (situational trigger + meaning to convey) — realized out loud in one turn, from meaning rather than by reading the answer. Store as `{trigger, function/label, acceptance_set[], internal_hint}`. Seed `acceptance_set` with one canonical phrase today; use the list shape so valid variants aren't marked wrong later. The other character's reply is never part of the objective — it's the trigger for the next. A transaction with a counter-question is simply 2-3 objectives, each one turn.

**Authoring checklist:**
1. Can the learner say this in ONE turn without waiting for the tutor? (No → split.)
2. Is there a clear meaning/trigger so they retrieve from intention, not a displayed string? (No → fix.)
3. Does failure have an obvious in-character recast? (No → cut.)
4. Is the canonical form a real prefab chunk usable unaltered in the actual café? (No → rewrite.)

**Per scenario:** 4-5 objectives; one shared opener + one shared closer from the global pool.

**Sequence/reuse/spiral:** global pool of shared objectives referenced by ID (greet, farewell, repair); each new scenario warms up by re-eliciting 1-2 prior chunks; hand-order scenarios so shared chunks recur at expanding intervals (session 1, 3, 7). Defer the prerequisite graph.

**Highest-leverage additions, priority order:**
1. Add the learner-initiated REPAIR objective to the global pool, surface in every scenario.
2. Make "completed" require one re-elicitation later in the session (not a single hit).
3. Enforce retrieval-before-display (preview builds comprehension; production prompt must not show the target string).
4. Tutor uses TPRS circling for 5+ productions without drill-feel.
5. End every session with a copyable takeaway card.

**Full loop:** comprehensible audio-visual preview (input, no answer key) → primed spoken production from meaning → in-character recast on error → TPRS-circled repetition → re-elicitation before close (true completion) → next scenario warm-up re-elicits prior chunks → takeaway card.

## Confidence
High on the core; medium on the two live judgment calls (production vs. comprehension weighting; how soon to widen canonical phrase to a full acceptance set) — both are tunable sequencing decisions, not architecture.

---

## RAW AGENT OUTPUTS

### Agent 1 — SLA / applied-linguistics domain expert (opus)
Recommendation: every objective = ONE learner-producible formulaic chunk tied to a communicative function; scenario = CEFR-style transactional script completable by speaking. Loop: comprehensible audio-visual input → primed production → in-character recast → spaced re-elicitation before close → cross-scenario spiraling. Adults acquire via formulaic chunks. Preview = comprehensible input (i+1), lexically identical to targets. Recast + guaranteed resurfacing = corrective recast + one spaced retrieval. Granularity: CEFR A1 functions, 3-6/scenario, 1-7 word chunks. Reuse openers/closers as SAME ID. Interleave scenarios sharing chunks with varied slots. Each new scenario re-elicits 1-2 prior chunks. MISSING: a learner-initiated REPAIR chunk ("Še enkrat, prosim"). Counter: tight scripts risk rigid parrots.

### Agent 2 — Skeptic (sonnet)
"Canonical phrase to produce" is a behaviorist proxy measuring mimicry. Phrase-on-cue = stimulus-response, not vary/repair/transfer. Recast has weak evidence; "resurfaces before session ends" is vague/too distant. Preview may prime exact surface-form repetition (answers before the test). Café/bakery = tourist phrasebook; real expat load is bureaucratic/social/relational, multi-turn. Confidence medium. Counter: beginners need scaffolding; canonical phrase may be right entry point IF unpredictability increases and objectives shift to function-level over time.

### Agent 3 — Pragmatist (sonnet)
One objective = one utterance produced unprompted; 4-6/scenario; shared objectives in a reusable GLOBAL POOL by ID. State machine only works if each objective = one production moment; two-part utterances fork it. Checklist gates: (1) say in one turn without waiting? (2) one canonical form? (3) obvious recast? Fail → split/cut. Confidence high. Counter: real transactions don't decompose cleanly (counter-question); a "one primary + one optional recovery utterance" model trains the real skill. Global pool punts on progression (formal vs informal greeting).

### Agent 4 — First-principles thinker (opus)
Atom is NOT the phrase — it's a communicative INTENTION under real-time pressure: (meaning + trigger), canonical phrase = one realization. Objective = FUNCTION SLOT carrying (trigger, meaning, ACCEPTANCE SET). Mastery fires on ANY accepted form, unprompted by display. Dissolves the tension: other character's answer = next trigger; question+closing = two intentions. Loop must guarantee RETRIEVAL BEFORE DISPLAY and TRANSFER (resurface under varied trigger). Near-zero rebuild. Counter: at hour zero the canonical phrase is the only realizable atom; acceptance-set premature — atom should change shape across the arc.

### Agent 5 — Systems thinker (sonnet)
Build a SHARED OBJECTIVE CATALOG with prerequisite links + cross-scenario mastery tracking; scenarios secondary. Deterministic completion = local-optimum trap (completes café & pharmacy, never consolidates greeting). Distinguish SCENARIO COMPLETION from OBJECTIVE MASTERY. Prerequisite links let engine fast-track demonstrated objectives. Turn cap × recast: late-session turns collapse into remediation. Interleaving requires cross-scenario memory; else massed practice = forgetting. Confidence high. Counter: a graph may never get built; curated flat list approximates spaced interleaving. Simple shipping beats stalled architecture.

### Agent 6 — End-user advocate (haiku)
Loop = one 6-8-turn session, 3-4 self-contained production moments, each celebrated SEPARATELY, each reused from prior sessions. Reuse the greeting for cumulative confidence; one utterance per objective; END with a TAKEAWAY CARD they can screenshot/use tomorrow. Beginners abroad fear embarrassment; need a small REAL win this session. Four small wins > one murky goal. Recast in character = permission to come back. Takeaway = next-day currency. Confidence high. Counter: isolated phrases in short bursts may never build spontaneous fluency; predictable barista = reactive learner who chokes on deviation.

### Agent 7 — Historical researcher / pedagogy precedent (opus)
Model on Pimsleur + Lexical Approach with TPRS wrapper. One objective = one lexical chunk SPOKEN from a meaning/picture cue, re-produced at EXPANDING INTERVALS within and across sessions. Story = CI scaffold + recall trigger. Pimsleur: retrieval (not exposure) builds production; make "completed" require RE-ELICITED recall. Lexical Approach settles granularity: the prefab chunk, speakable in one breath — so "one utterance" is correct. TPRS "circling" drives massive repetition without boredom (5+ productions feeling like conversation). CEFR: scenario = 3-5 chunks; final scene = performance check. Confidence high. Counter: Pimsleur/audiolingual lineage produced drill performers who froze; Krashen would say story/meaning should dominate, objective-hitting stay invisible.

### Agent 8 — Contrarian (sonnet)
Scrap production-first; flip to COMPREHENSION-DOMINANT input, production emerging naturally — current design is an anxiety engine. Forcing production before form-meaning mappings trains rote strings = parrot. Fixed canonical targets punish recombination: valid variant marked wrong (demoralizing) or complete (inaccurate); acquisition is generative. Transactional café/pharmacy = lowest-transfer content; what matters is relational/open-ended (landlord, parent-teacher, group talk). Deterministic completion gamifies the wrong signal; spaced retrieval ACROSS sessions drives retention. Confidence high. Counter: input-only adults never speak; production-first forces the activation they avoid for years — the bridge from comprehension to real-world use.
