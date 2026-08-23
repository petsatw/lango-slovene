# Seat 9 — Format contrarian (A1)

*Model: sonnet. Panel: first-four-sessions, 2026-08-22. Mandate: argue the spoken lesson is the wrong primary mode.*

---

## (a) The case against the spoken lesson as primary mode

The prior synthesis's central defense — "it is the only surface where the learner's mouth is the interface; everything else is a reading app with audio" (§3, UX) — is an assertion of *identity*, not of *outcome*. It says what the format uniquely *is*, not what it uniquely *achieves* for an absolute novice in the first ninety seconds. I attack it on its own evidence, most of which the synthesis itself surfaced and then declined to follow to its conclusion.

**The synthesis's own game designer conceded the fatal flaw and then kept the format anyway.** §3.4: *"unfailability curdles… by session 3 an adult starts to suspect the app is not listening, and they are correct… the threat to this design is not fear. It is the discovery that nothing you do matters."* That is not a tuning problem to fix with better copy. It is a structural property of a linear spoken spine: it can never credit anything (§4, systems: *"the scene must never credit anything… not in session 1, not in session 5, not ever"*), and invariant says mastery is earned only on the live mic. A mode that structurally cannot credit is being proposed as the *primary* mode of a product whose entire promise is that mastery is earned. That is backwards. The primary mode should be wherever the credited destination lives — which today is free chat, not the scene.

**The load-asymmetry finding is not a bug in this instance, it is what the schema produces by design.** `slavko-intro-l1` demands blind spoken production (`advance: "audio"`) before the learner has any orthographic or lexical foothold: `n1` alone is 5 Slovene words heard, `c1` demands one spoken word back, with `glossPolicy: "held"` — nothing on screen distinguishes the two. Compare `bakery-l1`, which already ships, is already gated through the working `create-dialogue` pipeline, and gets a learner through **6 learnables across 6 NPC turns** with full paired Slovene/English on every line and zero forced speech, because the client's turn is a *click between two written options*, not a microphone demand. The rehearsal-dialogue schema is not a lesser cousin of the spoken scene — on every axis the hard-won findings measure (heard:produced ratio, visible signal separating target from noise, content density per authored beat) it already outperforms it, and it is buildable today. **There is, notably, no `create-scene` skill in this repo's skill set at all** — only `create-scenario` and `create-dialogue`. The spoken scene format is not just under-scaffolded; its own S2 cannot be authored through any gated pipeline that currently exists. Rehearsal dialogues can.

**"A bare name is not Slovene."** The instructor's own finding, buried under "all four say yes." A learner who finishes S1 having spoken only their own name has had a listening lesson wearing a speaking lesson's clothes. That is the honest description of what ships today, and no amount of stall-ladder-timing or backchannel fix changes it — those are bug fixes to a format whose first production act was mis-specified.

**Content economics kills it at scale, and the synthesis's own game designer says so:** *"any plan whose sessions get longer by adding authored beats is dead by session 4."* Onboarding is the least dense lesson this app will ever run — 1 learnable, 5 beats, ~90s — and it is *already* the ceiling of what the spoken spine can carry per authored minute, because every beat needs a slow clip, a delivery clip, stall handlers, and a schema the pipeline cannot currently reproduce. The branching format delivers 6× the learnable density in a comparable authoring footprint, using the pipeline that already works.

None of this says the spoken mode is worthless. It says: **it is the wrong thing to open on, and the wrong thing to scale as the spine.**

## (b) My sequence

**S1 — First contact, click-through only, zero forced speech.**
*Hears:* Slavko's greeting audio, `Živjo! Kako ti je ime?` — full line, replayable on tap, no timer.
*Sees:* the line in Slovene with English gloss beneath it, always on (paired-text mode, per the synthesis's own convergence that the caption never withdraws); two written+glossed reply options in the bakery-1 branch style, Slavko's portrait present and reactive.
*Says/clicks:* taps one written option. At the very end, one *invited, never demanded* echo of `Živjo` — mic optional, skippable with zero visible cost.
*Records:* an "encountered" list (the unused `selectForWitness`/`focusIds` seam the systems seat identified) — never `attempt`, never `success`.
*Scaffolds:* everything lit — full text, full gloss, unlimited time, replay. Nothing withdrawn; S1 is maximum scaffold by design.
*Pacing:* self-paced by click; no stall ladder exists because nothing is timed.
*Hands off:* into a door lighting on the map — not a tile grid.
*Budget:* ~20 words heard, 0–3 words spoken (only if the optional echo is taken), 3–4 click-selections of full Slovene sentences.

**S2 — First spoken echo, cold re-greeting.**
Slavko re-greets with the *token-identical* line from S1 (instructor's mechanism). The learner's turn now arrives with no model — cold `Živjo`, invited not demanded, first candidate for real crediting. `me_veseli`/`sem_ime` are introduced via click-through exactly as S1's mechanic, with an *invited* echo attached to each. First door into free chat opens for a single-word try.
*Budget:* ~15 heard, 1–2 produced (both pre-seen), ratio ~8:1.

**S3 — Second place, second voice.** Bakery-l1 as-is: full branching transaction, repair phrases (`ne_razumem`, `se_enkrat`, `pocasi_prosim`) owned *before* this session per the instructor's non-negotiable precondition. A stall ladder now makes sense because a judged turn exists for the first time. Free chat sits beside it, same transaction, unscripted, a second character who actually listens.
*Budget:* ~30–40 heard across the tree, 3–5 spoken (echoes + one free-chat attempt), ratio ~7:1.

**S4 — Free chat becomes primary.** A single spoken bridge — one token-identical cold re-greeting, ≤10 seconds — then straight into free chat, where mastery actually accrues. **This is the first session where the spoken format is the right primary mode of the opening beat**, because by now the learner has a comprehension foothold, two prior unjudged echoes, and owns repair. Before this it never is.

## (c) The five answers

1. **The stepping stone.** S1 must leave the learner able to say, unforced, on invitation: *"Živjo."* One catalog-real word, already modelled twice, echoed once with nothing at stake. That is the utterance S2's cold re-greeting stands on.

2. **The frontier.** S1 is where confidence+simplicity beat engagement: an all-click S1 is less dramatically alive than the current airtight scene — the learner who wanted to *talk to Slavko* on first open gets a flatter session. I sacrifice that felt immediacy in S1 and buy it back in S2's invited echo, once confidence is banked rather than demanded up front. At S3, simplicity loses to safety: repair phrases add a beat that a minimal novel-frame count would cut; I keep them non-negotiable because a judged turn without an exit is the single most dangerous beat in the whole sequence.

3. **The drop-off.** Not S1 — I've removed the forced-speech risk that makes S1 dangerous today. The riskiest beat is the **S2→S3 transition**: the first voice that is not Slavko's and that responds to what was actually said. This is exactly where the game designer's "nothing you do matters" realization could flip into its mirror image — "it does matter, and I might be bad at it." Prevented by pre-supply, never diagnose: the second voice never names a failure, only confirms or offers an already-owned repair phrase, and nothing on screen ever turns into a score.

4. **What I'd cut.** Forced blind spoken production in S1, entirely. The linear-scene-as-permanently-primary status. The four-tile home/readiness screen. This buys: elimination of the load-asymmetry failure mode in S1 (0 forced-spoken beats vs. 9-heard/2-produced with no visual cue), removal of three of the four systems-verified defects (all trace to planting `attempt` on unwitnessed spoken production — S1 in my sequence never does this), and use of an authoring pipeline that is schema-stable today.

5. **How we'd know.** Not another gate — four gates already caught none of four real defects. Run cohort A (shipping spoken S1) against cohort B (click-through S1) and watch two behavioral signals: (i) does the mic get touched *at all* during S1 — my design predicts near-zero in S1 and a rise at S2's invited echo; if cohort B shows no rise even with the mic freely optional, the "mouth-interface" claim was right and my deferral was wrong. (ii) S1→S2 return rate within 48h. If cohort A matches or beats cohort B despite its dead-air and asymmetry bugs being fixed, my architectural argument fails — the format only needed the bug fixes the synthesis already found, not the restructuring I'm proposing.

## (d) My own argument's weakest link

My S1 redesign is, structurally, a click-through "reading app with audio" — which is precisely what the prior panel's option B (a separate target panel) was rejected for at the single-beat level, on the grounds that it turns the character into a delivery mechanism for exercises at the exact moment the learner decides whether this app is school. I am reviving that rejection at the level of the whole session rather than one beat, and I have not fully answered why doing it session-wide is safer than doing it beat-wide when the panel already found the beat-wide version disqualifying.

---

**Confidence:** medium — the load-asymmetry and crediting-contradiction evidence is strong and already in the codebase; the behavioral claim that click-through beats spoken-first for return rate is unverified and is exactly the experiment in (c)5.

**Strongest counterargument to my own view:** an adult who opens a language app wants to speak to someone, not tap through a branching menu on day one — if S1 reads as Duolingo-with-a-face, the very engagement that gets someone to S2 may be what I've traded away, and no amount of correct pedagogy compensates for a first session that feels like homework.
