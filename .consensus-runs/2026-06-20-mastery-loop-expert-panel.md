# Stochastic consensus — learning loop, acceptance criteria, sufficiency (8-expert panel)

**Date:** 2026-06-20
**Question:** Given the app's tools, how would experts construct the learning loop; what are the acceptance criteria for an "excellent" scenario and for each objective; and — assuming in-person practice is unavailable/unstructured — does the feature set have what the learner most needs, or what would make it EXCEED in-person chit-chat? Emphasis on immediately actionable, most-effective, systematically reproducible methods.
**Panel:** N=8, mix (4 opus, 4 sonnet). Synthesis: opus.
Personas: SLA acquisition researcher, working speaking-tutor/polyglot, adult Slovenian expat learner, cognitive scientist of memory/retrieval, psycholinguist of speech production, Slovene sociolinguist/pragmatics, conversation/voice-interface designer, behavioral/habit designer.

---

## SYNTHESIS

## Consensus
1. **Recast-then-forced-reproduction is the core mechanic** — ● only when the learner reproduces the corrected form on a LATER turn (A1,A2,A4,A5).
2. **Tutor stays in character; correction is UI-only, never spoken**, framed as orientation not judgment (A1,A2,A3,A6,A7,A8).
3. **Every tutor turn ends in an elicitation / leaves a gap**; max ~7-8 words (A1,A2,A5,A7).
4. **Story preview = comprehensible-input priming, Slovenian-only, no grammar**, one frame/objective; mandatory first run, skippable repeat (A1,A2,A3,A8).
5. **hintEN names the ONE specific predictable English-speaker error** — repeatedly called the most valuable thing the tool does that chit-chat doesn't (A1-A4,A6,A8).
6. **targetSL is a whole formulaic chunk a native actually says (2-6 words / ≤7-8 syllables)**, not a lemma (A1,A2,A3,A5,A6).
7. **Accepted-variant sets, not a single brittle canonical string** — near-unanimous; most-cited weak link (A1,A2,A4,A5,A6,A7).
8. **Difficulty ratchets DOWN under failure** via circling/narrowing ladder; one-recast cap to avoid loops (A2,A5,A7).
9. **Cross-session spaced review is the #1 gap and the thing that makes the app EXCEED in-person** (A1,A3,A4,A8).
10. **Session = 4-6 objectives, greeting→core→closing, 14-turn cap as clean-exit guard; always end on takeaway** (A1,A2,A3,A6,A7,A8).
11. **Replay of cached native audio + own captured runs is the clearest already-built differentiator** (A2,A3,A7,A8).

## Genuine disagreements (resolved by sequencing/gating, not picking sides)
- **(a) Production-first vs. more input/less correction early.** Resolution: production-first is the app's job, but front-load input within each turn (hear before produce), guarantee an early win, keep correction low-shame + capped at one recast.
- **(b) Single canonical phrase vs. broadened acceptance.** Resolution: broaden — ship authored variant-SET now (deterministic, low-risk); defer semantic/fuzzy match.
- **(c) Speed/fluency-pressure timing.** Resolution: gate it — only after ≥2 accurate unaided successes, only as an optional second-lap re-run, never first contact.
- **(d) How much cross-session machinery now.** Resolution: minimal hook now (persist last-success date + due flag, prepend 1-2 due objectives reusing id+audio); defer full 4-box Leitner.

## High-value outliers
- **userVerbatim failure-typing** (A5): diff raw ASR vs targetSL → classify omission/L1-sub/phonological/morphological → name the error type. Prompt-buildable diagnostic.
- **verbatim-vs-said channel-health + cached "Mhm" backchannel** (A7): detect mishearing vs off-topic; mask latency.
- **Auto-play the learner's OWN success recording at session end** (A8): hearing yourself succeed > reading a list.
- **Register declaration FIRST in every tutor prompt** (A6): ti/vi? knjižni/pogovorni? shortest native turn? — also sets reply length.
- **Story preview ends on the tutor's literal opening line** (A8): desensitization.
- **The Slovenian dual** (A6): ≥1 objective per multi-person scenario; uniquely Slovenian, low effort.
- **Retrieval-before-display** (A4): a Story-shown phrase can't count toward its retrieval quota until produced cold.
- **Anti-gaslighting cap** (A7): one recast before advancing + occasional explicit low-shame "Še enkrat?".

## The unified learning loop
PRE-SESSION: (1) auto-play story, SL only, one frame/objective, no quiz; (2) final frame = tutor's opening line; (3) optional practice reps for ≥4-syllable chunks (chunked native model, shadowing, natural speed).
SESSION START: (4) prepend 1-2 "due" objectives from prior scenarios (shared id+audio).
PER-TURN CASCADE (ordered so mechanics don't collide): (5) prompt sets REGISTER first (fixes persona + ≤7-word length); (6) elicit focus objective WITHOUT quoting targetSL (retrieval-before-display); (7) learner holds-to-talk, produces; (8) channel-health check userVerbatim vs userSaid → CLEAN advance / MISHEARD implicit-confirmation recast ("Kavo, ja?") / SILENCE narrowing closed choice; (9) accept against variant SET; on miss classify error from userVerbatim → specific correction note (UI-only); (10) ratchet difficulty DOWN one rung (open→either/or→binary; freeze→first-chunk carrier), one-recast cap; (11) state machine pending→recast(◐)→completed(●), ● only on unaided post-recast success; back with retrievalCount/lastSuccessTurn/strength; interleave (no consecutive), graduated-recall check ~2 turns later; (12) latency masking (short reply + cached backchannel, button lock, one-tap re-send).
SESSION END: (13) at turn 10 prompt shifts to "finishing — no new ground"; (14) takeaway in PRODUCTION order, "phrases you own", replayable + offline; (15) auto-play one own-success recording + "You're ready for [next]"; (16) any ◐ at cap → "say it once more", becomes objective #1 on re-run + marked due.
ACROSS RUNS: (17) persist last-success date + due flag, promote/reset on cold review; (18) scenarios GROW across runs, same objective can recur in harder register; (19) run-1-vs-run-N comparison + "N days ago" Zeigarnik, NO streaks, opt-in goal reminder only.

## Rubric — an excellent SCENARIO
- Real bounded transaction the learner faces within ~2 weeks; one sitting (<10 min, ≤14 turns).
- Paper-testable: a zero-Slovenian adult could complete it by the prompt's circling logic alone.
- 4-6 objectives (≤4 novel in flight), none orphaned.
- Open→complication/choice→close arc; first objective = lowest-stakes early win; final = slight stretch + one-breath closing.
- Ordered to mirror the REAL interaction / what breaks down first, not grammar logic.
- Every objective elicitable by a natural in-character line WITHOUT quoting targetSL; tutor never lectures to elicit.
- ≥1 objective forces negotiation (clarification/quantity/substitution/repair).
- ≥1 interleaved review objective shared (id+audio) with another scenario.
- Register specified + consistent; ≥1 surprising greeting/closing norm; the dual where two people are addressed.
- No dead ends; difficulty ratchets DOWN on failure; clean exit guaranteed.
- Learner holds >50% talk time (tutor ≤7 words); no spoken English; completion never requires reading.
- ASR-robust (not hinging on one fragile phoneme); closed-choice fallbacks on stall.
- Story maps 1:1 to objectives, ends on the tutor's opening line.
- End = a communicative success picturable tomorrow; no textbook-but-never-said phrasing.

## Rubric — an excellent OBJECTIVE
- targetSL = one whole formulaic chunk a native actually says (2-6 words, ≤7-8 syllables, single contour), doing a communicative job — not a lemma/pattern/"understand X". Test: ask a Ljubljana resident, not a teacher.
- Completable in isolation (no prior objective's output as input); approximable on first attempt.
- High transfer value; shares recurring frames + ideally shared id+audio.
- Introduces at most ONE new hard articulatory feature (cluster, č/š/ž, palatalization, case ending).
- hintEN names ONE specific predictable English-speaker error (calibrated difficulty, not generic).
- Has an accepted-variant SET (register-tagged); tolerates trivial phonetic / ±1 word-order variation.
- Clean native acoustic model heard (normal + chunked) BEFORE production.
- Elicitable by a single natural line without quoting target; has a binary fallback embedding the target word; clean recast path voiced as a question.
- Register explicit in the record (ti/vi, pogovorni/knjižni).
- Completion (●) = unaided correct form, answer hidden, on a turn AFTER the recast. Mastery = ≥2-3 spaced successes, ≥1 cold; optional latency gate only after accuracy stable.
- Yields measurable state + a decay signal (post-success failure decrements + re-queues).
- Completing it moves a visible dot ("a phrase you own"); failure recoverable in ≤1-2 recasts without threatening the cap.

## Sufficiency verdict vs. in-person
**YES — the feature set already delivers the learner's most critical needs when in-person is unavailable, with ONE decisive exception (cross-session spacing) that is also the cheapest high-value thing left to build.**
Already EXCEEDS chit-chat on: infinite patient replayable native audio + own-run replay; zero social cost to silence/freezing; a correction naming the exact predictable error every time; guaranteed structure + forced retrieval + measurement + clean exit.
Ranked gaps: (1) cross-session spaced retrieval (net-new, highest — beats week-2 attrition); (2) broadened acceptance (variant-set now / fuzzy later); (3) pronunciation feedback on 1-2 hard phonemes (net-new); (4) gated fluency/automatization pressure (net-new); (5) productive recombination / off-script robustness (mitigate via elicitation-phrasing rotation + scenario variety).

## Prioritized implementation backlog
DO NOW (prompt / state-machine / authoring — buildable):
1. Forced-uptake completion rule (state machine) — core mechanic.
2. Accepted-variant sets per objective (record + acceptance) — kills the top false-reject.
3. Turn-policy prompt rewrite: register-first → ≤7-word reply always ending in elicitation → never quote targetSL → in-character recast → UI-only orientation-framed correction.
4. Retrieval-before-display (hide canonical + answer key until after attempt).
5. Circling ladder + one-recast cap + freeze carrier as IF/THEN rules.
6. Channel-health (verbatim-vs-said) implicit-confirmation repair + userVerbatim error-typing.
7. Story preview ends on the tutor's opening line; mandatory-first/skippable-repeat.
8. Session-end own-success replay + production-order "phrases you own" takeaway.
9. Authoring audit: chunk-not-word, native-not-textbook, one-named-error hintEN, register + dual, ≤6 objectives, shared ids.
10. Practice mode: chunked native model + shadowing, natural speed.
NET-NEW (ranked):
11. Minimal cross-session spacing (last-success date + due flag, prepend 1-2 due) — highest net-new priority.
12. Run-1-vs-run-N comparison + "N days ago" surfacing, no streaks.
13. Within-session strength/decay field (cold=1.0/echoed=0.5; interleave no-consecutive).
14. Latency-gated fluency second-lap (gated behind stable accuracy).
15. Pronunciation feedback on 1-2 hard phonemes (defer; high build cost).
16. Semantic/fuzzy acceptance (defer until variant-sets prove insufficient).
17. Full Leitner scheduler +1/+3/+7/+21d (later upgrade from #11).

## Confidence
High. Strong convergence on the core loop, both rubrics, the sufficiency verdict, and the top backlog. Disagreements are bounded and resolved by sequencing/gating. Real builder calls: acceptance MECHANISM (variant-set vs fuzzy) and HOW MUCH cross-session machinery to ship first — both de-risked by starting with the buildable-now version.

---

(Raw 8 agent outputs are preserved in the conversation transcript / agent jsonl files for this run.)
