# Design critique — what the panel got right, what it inherited, and what replaces it

Post-panel audit of the [11-expert consensus](SUMMARY.md). Three questions were put to the design:
*is it optimal or is it anchored on the existing app?* · *how does the learner know they are progressing
toward A1?* · *why a café?*

**Verdict: the structure is earned, the content is inherited.** The setting is overturned below.

---

## 1 · The anchoring audit

### Earned — derived independently, transfers to any setting

Eleven agents reached these from seven unrelated theoretical bases. They would survive any change of
scene, character, or content:

- **Speak aloud inside ~20 seconds** (SLA, phonetics, activation design, motivation psychology — all
  independently)
- **No failure state on turn one** — a falsifiable engineering claim about low-resource ASR
- **Frozen chunks, zero grammar** — the formulaic/rule-governed distinction is real and load-bearing
- **Retrieval before display** — memory research, not app opinion
- **Own-voice replay as evidence** rather than a phrase list
- **The invisible cut into live** — no threshold to cross into the scary part
- **No menu before the win**
- **Diegetic reward instead of a measured one**
- **English absorbed, never punished, never breaking the world**

### Inherited — present in the repo's docs before the panel ran

Every agent was given the repo's own documentation to ground in. Each of the following was already sitting
in those docs and was reproduced without challenge:

- **The café.** The canonical example scenario in the repo.
- **`Eno kavo, prosim`.** Ranked #13 in the [core pattern library](../core-pattern-library-2026-06-26/RANKED-PATTERNS.md),
  with the café framing already attached to it.
- **The transaction as the unit of interaction.** The repo's whole scenario model is service encounters.
- **Push-to-talk into a simulated scene.** Never questioned by any agent.
- **NPC line → learner reply → branch.** The existing rehearsal shape, reproduced.

**The tell:** not one of eleven agents questioned whether the first interaction should be a *transaction*
at all. Eleven independent experts, zero challenges to the frame. That is not consensus — that is a shared
prior, introduced by the grounding docs. **Unanimity on content is not evidence here.**

### Method note for future panels

Grounding a panel in repo docs buys accuracy about the product and costs originality about the product's
premises. When the question is *"is our frame right?"*, withhold the docs. When the question is
*"how do we execute inside our frame?"*, supply them. This panel was given docs while being asked an
unconstrained question, and the contradiction shows up exactly where predicted.

---

## 2 · The A1 question — the panel dodged the brief

The stated first priority was **felt progress toward A1**. All eleven agents responded by deleting every
A1 signal from the surface and substituting a diegetic reward. That is a good answer to **confidence**.
It is not an answer to **progress**.

The panel conflated two things that should never have been merged:

| | Verdict |
|---|---|
| **The measure** — percentages, scores, coverage bars, levels | **Correctly hidden.** Adults do not need to be graded, and the product charter already banned it. |
| **The map** — the sense that this is going somewhere specific and *finite* | **Wrongly hidden.** There was never a reason to hide it; it was hidden by reflex, along with the measure. |

**CEFR A1 is not a score. It is a list of can-do statements in concrete situations** — *I can introduce
myself · I can say where I live · I can ask and answer simple questions about immediate needs · I can order
food and drink.* Progress toward A1 therefore **already is** a list of situations you can handle.

That means the answer was in the panel's own output and was mis-filed as navigation: the **street** at
[beat 161–171](ATOMIC-EXPERIENCE-MAP.md#segment-l--400500--their-first-real-choice). A street with a
countable set of doors, some of them lit, **is** an A1 coverage map that never uses the word "level" and
never shows a number. The learner reads *"I can handle four of these places"* — which is literally what A1
certification means.

**The resolution: show the map, keep hiding the measure.** The street must be visibly finite and visibly
closing. This is the only progress affordance the design needs, and it does not violate a single
anti-gamification maxim.

---

## 3 · The café audit

**What holds up:** a bounded transaction with a closed set of outcomes · short · genuinely repeatable this
week · near-zero social stakes · *kava* is a free cognate.

**What does not — none of it raised by any agent:**

1. **A Ljubljana café is the highest-English-probability interaction in the country.** Centre-town baristas
   speak good English and will switch. The design's proudest trust signal — *they never flinch to English*
   — is being demonstrated in the one venue where reality contradicts it fastest.
2. **It exhausts in four phrases.** Ordering is a 40-second interaction with maybe six usable utterances.
   Then what?
3. **Zero emotional content.** You do not build a relationship with a barista, so there is nothing to come
   back *to* — only a mechanic to repeat. This is precisely the retention gap the design could not
   otherwise close.
4. **It is the phrasebook's territory.** Page one of every phrasebook ever printed is a café. If the
   product's differentiator is that it is not a phrasebook, opening on a phrasebook page is a positioning
   error.
5. **The cognate makes the first win partly counterfeit.** *Kava* costs nothing, so "I said a Slovene word"
   is only half true.

---

## 4 · What replaces it — the first-meeting frame

**Not a transaction. A first meeting.** Someone is curious about *you* and asks your name. The first
Slovene the learner produces is **their own name**, at ~0:14, in answer to a question about it.

Why this beats the café on every axis the brief named:

- **Unfailable in a way a greeting is not.** You cannot mispronounce your own name. ASR risk on turn one
  drops to literally zero, and the win is unambiguously *yours* rather than a cognate handed to you.
- **It is CEFR A1 descriptor number one.** Personal information — name, origin, residence, occupation — is
  the *definition* of A1's core. A café order is one line item; this is the spine. The answer to *"how do
  they know they are progressing toward A1"* becomes structural rather than cosmetic: the first two minutes
  **are** A1 competency #1.
- **It never exhausts.** You can talk about yourself indefinitely — origin, residence, what you are doing
  here, that you are learning. Each is a frame with a swappable slot; each is A1 core; each stays true
  forever. The café runs dry in one sitting.
- **It generates a relationship, which is the return-pull the panel could not manufacture.** A character
  who was interested in you yesterday is a reason to open the app. A cup of coffee is not. This is the one
  thing a tapping app structurally cannot do.
- **The anti-English-switch signal lands harder.** Someone curious about you who stays in Slovene is
  *warmth*. A barista who stays in Slovene is merely *service*.
- **It contains the highest-lived-ROI phrase naturally.** *Se učim* ("I'm learning") — the
  [pattern library's](../core-pattern-library-2026-06-26/SYNTHESIS.md) standout outlier — has nowhere
  natural to go in a café script and is the obvious third beat here.

**What it costs:** the diegetic reward. Nothing lands on a counter. The reward must be **social** — the
character reacts to your name, repeats it back, is visibly pleased. For an adult this is arguably a
stronger reward than a prop appearing, but it is harder to build, easier to get wrong, and it is the one
real risk of the swap.

**What transfers unchanged:** every structural beat in the
[atomic map](ATOMIC-EXPERIENCE-MAP.md) — cold open, audio before text, mic at 0:11, no transcript, cached
backchannel, scripted-advance then contingent, invisible cut to live, own-voice replay, open loop at the
end, the three stall handlers, the four branch handlers. Only the setting, the character's motive, and the
utterances change.

### The character — Slavko

The first friend is **Slavko**, the dragon — already a main character in the app (from the operator's
*"Zmaj Slavko"* source material) and the natural companion figure for a first meeting.

**This is a continuation of his existing role, not a change of one.** The rehearsal dialogues are **worked
examples** — Slavko goes through a scenario and the learner *previews* it ("see how he did this?"), and the
dialogue doubles as the **context frame** for the live tutor. The `client` lines were never the learner's
own voice, so nothing is taken from the learner by making Slavko the companion. The three surfaces become
one story about one character:

1. **Onboarding** — you *meet* Slavko.
2. **Rehearsal** — Slavko *shows* you, and you preview it.
3. **Live tutor** — *you* do it, with Slavko in the scene.

One voice profile and one look across all three; see the handoff for the two content inconsistencies this
exposes.

A dragon also resolves a problem the café frame could not: a mythic companion can be curious about you,
remember you, and stay in Slovene without any of it straining plausibility — where a Ljubljana barista
doing the same is contradicted by the street.

---

## 5 · The open craft gap

The panel had no seat for **feel**. The 200 ms layer — the press, the audio duck, the haptics, the cached
backchannel, the weight of the button — is unspecified, and it is the axis on which mass-market apps
actually win. The structure above is necessary and not sufficient. A second panel scoped to *how the two
minutes feel* rather than *what they contain* is the outstanding piece of research.
