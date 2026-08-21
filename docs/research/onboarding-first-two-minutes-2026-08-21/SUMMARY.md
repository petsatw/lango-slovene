# Stochastic consensus — the first two minutes (onboarding), 11-expert panel

**Date:** 2026-08-21
**Question:** Unconstrained by the current design, what should the **first 30 seconds** and **first 2
minutes** of a brand-new user's time be, for an absolute beginner (zero Slovenian, English-speaking
adult)? Optimize in priority order for (1) immediate felt progress toward A1 + confidence, (2) immersion
that is highly engaging and accessible, (3) pull into the live AI tutor so even a trivial conversation
feels like progress. Primary goal: immersion and **producing** the language.
**Deliverable per agent:** a second-by-second script of the first run · the single first Slovene utterance
the learner produces · what is deliberately **not** shown.
**Panel:** N=11, mix (6 opus / 5 sonnet). Synthesis: opus. Raw outputs: [RAW-AGENT-OUTPUTS.md](RAW-AGENT-OUTPUTS.md).

Personas: SLA acquisition researcher · psycholinguist of speech production · Slovene sociolinguist ·
conversation/voice-interface designer · adult expat absolute beginner · game first-run/activation designer ·
comparative method historian (Pimsleur/Michel Thomas/ALG) · self-efficacy & motivation psychologist ·
ASR/speech-tech engineer · cognitive scientist of memory/retrieval · behavioral/habit designer.

Five seats returned from the [scenario-engine panel](../scenario-engine-expert-panel-2026-06-20/SUMMARY.md);
four seats were new (game activation, method historian, self-efficacy, ASR engineering); two
(memory, habit design) were restored at the operator's request.

> ## ⚠️ Read the critique before building anything
>
> The panel's **structure** survived scrutiny. Its **setting and content did not.** All eleven agents were
> given the repo's own docs to ground in, and all eleven inherited the café + `Eno kavo, prosim` frame from
> those docs without one challenge. The post-panel audit — [DESIGN-CRITIQUE.md](DESIGN-CRITIQUE.md) —
> overturns the setting in favour of a **first-meeting frame** and answers the A1 question the panel dodged.
> **The unified script below is preserved as the panel produced it; the critique supersedes its content.**

---

## Consensus

Eleven of eleven converged on a strikingly specific shape — not framing agreement, the same design.

1. **No menu, no home shell, no account, no scenario list, no level tabs before the first spoken win.** All 11.
   A3 (expat) names the churn moment: "the three apps I quit all made me *choose* before I could *do*."
   A6 (game): "a decision before a win is churn."
2. **Cold open into a scene with native Slovene audio playing unprompted, before any English.** All 11.
3. **The learner speaks aloud between 0:10 and 0:32.** All 11, median 0:15. Nobody proposed a first run
   where the learner only taps.
4. **Zero visible scoring** — no score, streak, XP, percentage, progress bar, or the string "A1". All 11,
   unprompted.
5. **The reward is diegetic — the world answers, not a checkmark.** A1, A2, A3, A5, A6, A7, A8, A11.
   A6: "the coffee arriving *is* the progress bar the anti-gamification stance permits, and it's better
   than a bar, because it's diegetic."
6. **No correction, no red X, no failure state in run 1.** A1, A2, A4, A5, A6, A8, A9. Mishears get an
   in-character recast phrased as a question. A5: "correcting me at 0:19 kills the app."
7. **Frozen, case-baked chunks; zero grammar vocabulary.** All 11. A1 supplies the theory: formulae are
   safe to force, rule-generated morphology is not — nothing in a frozen chunk can fossilise.
8. **No spoken English ever; written English minimal and late.** A1, A2, A5, A6, A7, A10.
9. **The live tutor is never a labelled destination** — the first surface either *is* the tutor or cuts
   into it with no navigation. A2–A8, A10, A11. A6: "if the first surface *is* the tutor, the conversion
   problem is deleted rather than solved."
10. **Retrieval before display** — audio before Slovene text, Slovene text before English gloss.
    A1, A2, A7, A10, A11. A10: showing the gloss first converts a retrieval event into a recognition
    event that won't survive to tomorrow.
11. **The end beat is a replay of what the learner just said, not a summary.** A1, A5, A6, A11 — and A5
    and A6 independently specify replaying the learner's **own recorded voice**. A5: "a list of phrases
    is a promise, my recording is evidence."
12. **Small production volume: 2–5 utterances, ~3 novel items.** A1, A2, A7, A10, A11.
13. **A repair phrase belongs in the first two minutes.** A1, A2, A3, A9 reached for one independently.

First-utterance tally: **Dober dan** ×4 (A3, A5, A8, A9) · **Eno kavo/kruh prosim** ×4 (A2, A4, A6, A7) ·
**Živjo** ×2 (A10, A11) · **Ne razumem** ×1 (A1).

## Genuine disagreements

**(a) Which first utterance.** *Živjo* drops out: A3 rules it wrong-register for a stranger at a counter,
and A9 independently flags the ž/j onset as exactly where accented Slovene gets misheard — two orthogonal
experts converging against it. *Ne razumem* is right about transfer and wrong about affect; A1's own
counterargument concedes it ("may internalize a self-concept as a non-comprehender"). Between the remaining
two **the disagreement dissolves into an ordering problem, and both camps' counterarguments say so** — A2
admits *Eno kavo, prosim* has "near-zero transfer," A1's stated fallback is *Dober dan*. *Dober dan* wins
utterance one on ASR robustness (A9), register authenticity (A3), unfailability (A5, A8). *Eno kavo, prosim*
wins utterance two on A2's inventory-level phonetic audit (no č/š/ž, no palatals, no clitic, only cluster
/pr/ licit in English, word-initial stress means the English trochee is already correct) plus baked
accusative. **Sequence them; don't choose.**

> ⚠️ Surfaced by this split: A3 and A4 both freehanded **"Eno kruh, prosim"** — *eno* feminine, *kruh*
> masculine. Two of eleven experts shipped ungrammatical Slovene in a one-line deliverable. Direct evidence
> for the never-freehand rule: all Slovene goes through the authoring gate.

**(b) Scored vs scripted-advance.** A9 argues unscoreable-by-construction: scoring a beginner's cold ASR
output against canonical Slovene in the first 60 seconds is close to a coin flip on a low-resource language,
so recognizer failure *cannot* be allowed to become the learner's first experience of not being understood.
A8 and A11 want genuine contingency (Bandura needs a real mastery experience; A9's own counterargument
concedes the interaction may read as theater). **A9 wins turn one on falsifiable engineering ground;
resolution is sequential:** turns 1–2 scripted-advance (advance on *audio arrived*, never on transcript),
genuine contingency from ~1:12 in the live tutor. Two mechanics are non-negotiable: **never render the ASR
transcript**, and **close the mic on button release**, not silence endpointing.

**(c) Novel item count.** A10 is the only agent who argued a number from evidence (cap 3; above ~3–4 in one
window, traces "collapse into recognition-only" and fail cold retrieval next day). Nine of eleven landed at
2–4 without any memory literature. A9's six-phrase list is the panel's clearest overreach — a phrase drill
wearing a conversation's clothes. **Settle at 3 novel items + one respacing pass.**

**(d) Rehearsal tree in run 1.** Absent as a destination, 11–0. A6: "it's the better teaching surface but
it's *clicking*, not *speaking* — introducing it first teaches the player this is a reading app." A8 adds
that a tap-through is *vicarious* experience, the weakest efficacy input available. On choice-count, A4 and
A11 are right that a decision before the win is friction and after it is agency; A5 supplies the constraint
that keeps a choice from becoming a tap-through — **options sit beside the mic, tapping only previews audio,
only the mic advances the turn.**

**(e) English budget — the one judgment call left open.** Range: zero (A3, A10) → minimal and late (A1, A2,
A5, A6, A11) → a deliberate six-second English contract up front (A7: "if you forget it, that's my fault,
not yours," argued as the single highest-retention move in the prior art). The risk is flagged from **both**
directions — A3, A4 and A11 all warn that zero orientation leaves a user feeling *dropped into* a scene.
Resolved as three short on-screen lines, zero spoken English, with A7's no-blame contract compressed to one
line. This is a taste call, not an evidenced one.

## High-value outliers

- **A5 — "Nobody hears this but you," at the mic-permission moment.** Cheapest line in the design and the
  only one naming the actual barrier. A5 says this line is why they press the button.
- **A9 — never render the recognized transcript back.** A garbled string reads as "you failed" even on an
  accepted turn. One line of work; silently protects every other agent's no-failure-state requirement.
- **A4 — a cached "Mhm" backchannel firing instantly on mic release, regardless of ASR.** Masks model
  latency in the window where a beginner's confidence is most fragile. Nobody else addressed latency at all.
- **A1 — deliberately engineer the moment the repair phrase is needed.** The interlocutor goes too fast on
  purpose, the learner says *Ne razumem*, and is audibly slowed down. The only beat in any script where the
  learner perceives their own utterance changing the world.
- **A3 — never flinching to English on a halting attempt is the core trust signal.** Inverts the reflex an
  English speaker meets on every Ljubljana street; "worth more than any UI polish."
- **A11 — the end beat is an open loop that exits the app.** No next button, no streak: one spoken pointer
  to a real-world act, then back to the phone home screen. Zeigarnik retention that violates none of the
  anti-gamification maxims.
- **A7 — the cognate ambush.** Slovene hands English speakers *kava, pivo, hotel, telefon, problem* free;
  opening with what the learner already owns reframes the language as enterable before any work.
- **A6 — the "one more" hook must be a variation of the win just had, never a new mechanic.**
- **A8 — unearned-praise backfire.** Every affirmation gated on an event that demonstrably happened. The
  principled reason a close can say "you just did X" but never "great job!"

## The unified first-run script (as the panel resolved it)

> Preserved as produced. **The setting is superseded** — see [DESIGN-CRITIQUE.md](DESIGN-CRITIQUE.md).
> The beat structure below transfers unchanged to the first-meeting frame; only the setting, the
> character's motive, and the four utterances change.

**Setting:** café counter, portrait, one NPC (female, warm, vikanje). All NPC audio pre-cached — nothing in
the first 72 seconds waits on a model. No account, login, splash, logo, or permissions carousel.
**Budget:** 3 novel items · 4 productions + 1 respacing retrieval · 3 English lines, all on-screen, none
spoken · 0 scores.

| t | Beat |
|---|---|
| 0:00–0:03 | Black screen, three lines of white text: *"Ljubljana."* / *"Don't read anything — just listen."* / *"If you forget something, that's on us."* No skip affordance. |
| 0:03–0:08 | Café counter fills the screen; room tone in the same frame. Cached native audio: **"Dober dan, izvolite?"** No caption, no English. |
| 0:08–0:11 | Deliberate silent beat. Then a Slovene-only caption: **Dober dan.** Re-speaks once, chunked and slower, stressed syllable brightening in sync. |
| 0:11–0:14 | One UI element: a large hold-to-talk button. **"Hold and say it."** Beneath, small: **"Nobody hears this but you."** The OS mic prompt fires here with that rationale already on screen. |
| 0:14–0:20 | **First production ≈0:16: "Dober dan."** Advances on *audio arrived*, never on transcript. No transcript, no checkmark, no meter. Mic closes on **release**. |
| 0:20–0:24 | Cached **"Mhm"** fires instantly on release. 0.6 s of the learner's own recording plays back. Then she replies **in Slovene and does not switch to English**: **"Dober dan! Izvolite?"** *The 30-second win.* |
| 0:24–0:30 | Caption **Eno kavo, prosim**, gloss appearing *after* it. Plays twice: natural, then chunked. |
| 0:30–0:40 | **Second production ≈0:34.** She: **"Takoj."** A cup lands on the counter with foley. The image changed because of something they said. |
| 0:40–0:55 | **"Še kaj?"** — no gloss. Two options appear *beside* the mic; tapping previews, only the mic advances. **Third production ≈0:50.** |
| 0:55–1:12 | She goes too fast on purpose: **"To bo osemdeset centov, prosim."** No caption. One line appears quietly: **Ne razumem.** **Fourth production ≈1:02** → she audibly slows and holds up coins. *Peak beat: the learner changed another person's behaviour.* |
| 1:12–1:20 | **Hard cut into live, with no navigation and no label.** Same voice, same scene, same button. Genuinely contingent from this instant. |
| 1:20–1:40 | **"Še eno kavo?"** — no caption crutch. Cold retrieval ~50 s after encoding. Mangled → **one** in-character recast as a question. Silence >6 s → spoken binary. English in → absorbed, answered in Slovene. Never stranded. |
| 1:40–1:50 | Close: **"Hvala, nasvidenje."** Learner echoes — fifth production. Credit lands silently, server-side. |
| 1:50–1:57 | Scene dims. Four cards in **spoken order**, no English, each replaying **the learner's own recording**. Above: *"You just ordered a coffee in Slovene."* States an event; does not praise. |
| 1:57–2:00 | One spoken line: **"Naslednjič: naroči kavo — v resnici."** One small affordance. No modal. If they close the app here, the run ended correctly. |

**Withheld from the entire run:** the home shell · scenario list and level tabs · the branching tree as a
surface · A1 Readiness and the string "A1" · every score, streak, XP, percentage, progress bar · the ASR
transcript · any correction UI or accuracy readout · every grammar word · any conjugated verb or word
requiring a chosen ending · alphabet or pronunciation chart · account, settings, notification ask · any
curriculum screen · **any spoken English at all** · any written Slovene before its audio and any gloss
before its Slovene · the words *lesson, tutorial, exercise, practice, seed, level* · the label *AI Tutor*.

The full 171-beat decomposition of this script, out to five minutes:
[ATOMIC-EXPERIENCE-MAP.md](ATOMIC-EXPERIENCE-MAP.md).

## Confidence

**High on structure, low on content.** All 11 agents independently produced the same structure — cold open,
native audio first, speak by 0:15, diegetic reward, no scores, no menus, no correction, invisible cut into
the live tutor — arriving from SLA theory, phonetics, sociolinguistics, game activation, ASR engineering,
memory research and habit design without coordinating. Four of five disagreements resolved cleanly, usually
because the agents' own counterarguments named the resolution.

The content is a different story and the panel's unanimity there is **not** evidence: every agent read the
repo's docs first and inherited the café, the coffee phrase, and the transaction-as-unit frame from them.
Zero of eleven challenged it. See [DESIGN-CRITIQUE.md](DESIGN-CRITIQUE.md).
