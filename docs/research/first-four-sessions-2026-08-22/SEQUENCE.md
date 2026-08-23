> ## ⚠️ SUPERSEDED — historical record, do not build from this
>
> This was a working draft from the session of 2026-08-22/23. It sits with the panel outputs it was
> derived from because it is part of that record, **not because it is a spec.** Substantial parts of it
> were argued out and reversed in the same session:
>
> - **Microphone capture in the lesson is cancelled.** No capture, no voice-activity detection, no
>   own-voice review. The mic belongs to the live tutor only; the friction of a permission ask in session
>   one to pay off three sessions later was a bad trade. §2.1–2.2 are dead.
> - **"Empty slot" as the withdrawal axis is wrong** and contradicts a settled principle — the Slovene
>   never withdraws. The slot always shows the line; the **English gloss** is what withdraws.
> - **S2 was substantially re-authored** after this draft — the opener became a re-introduction (Slavko
>   cannot know the learner's name), and the lesson gained the repetition engines. It now ships as
>   `server/dialogues/slavko-intro-2.json`.
> - **S3 and S4 here predate the repetition engines** and are thin by the standard S2 now sets.
>
> What survived, and where it now lives: the eight teaching principles and the lesson-shape guidance in
> **AGENTS.md › How the lessons teach**; the authoring rules — heard-first ladder, no-derivation, slot
> states, gloss withdrawal, character truth — in **.claude/skills/create-dialogue/SKILL.md** (stage 0 and
> stage 2); the band model in **docs/dialogue-difficulty-model.md §3**.

# S2 · S3 · S4 — the sequence after onboarding

**Objective, in priority order:** the learner gains immediate confidence and a concrete feeling of learning
**at the edge of their ability** — without overwhelm. Overwhelm is the *constraint*. Felt learning is the
*objective*. The panel inverted this, which is why it produced a sequence nobody would quit and nobody
would finish.

**This document is not constrained by what is currently built.** Where the best learning experience
requires the product to change, §2 says so and says why. Existing artifacts, schemas and invariants are
argued on the merits or discarded, not inherited.

Inputs: [SYNTHESIS.md](SYNTHESIS.md) and the nine seat responses.

---

## 1 · What the panel got wrong

The nine seats rationed **novel frames to one per session** and treated that as the ceiling on progress.
Seven named it as the governing rule; six sacrificed engagement outright; the synthesis recorded that
*"nobody sacrificed simplicity anywhere"* and that *"confidence is the only thing the sequence is buying."*

That is a safety-maximising sequence and it starves the objective. Two conflations underneath it:

**(a) New items ≠ new capability.** Load grows with items. Capability grows with **items × contexts ×
acts**. A frame used unprompted is not the frame used when cued; a frame that changes the other person's
behaviour is not the frame that answers a question; a frame turned into a question is not the frame as a
statement. Hold items flat and capability still compounds. So:

> **One novel FRAME per session — and one novel ACT per session. The act is the spine; the frame is the
> garnish.**

Difficulty moves onto the composition axis, which is free, and off the item axis, which is expensive.

**(b) Items-per-session is the wrong unit entirely.** The unit that predicts whether anything is learned is
**retrievals per item, spaced across sessions**. An item met once is not learned; an item retrieved five or
six times across days is. Under the panel's rule with four sessions, the item introduced at S4 gets exactly
one retrieval and is not learned at all — a flaw in every one of the nine layouts. **The governing
authoring constraint is therefore the recycling schedule, not the introduction rate.** §5 counts them.

### The act ladder

| session | act | definition | new vocabulary required |
|---|---|---|---|
| **S1** | **echo** | say what you just heard | — (given) |
| **S2** | **initiate** | say it *before* you are asked | **none** |
| **S3** | **repair** | change what the other person does | **none** |
| **S4** | **reciprocate** | ask, don't only answer | **two words** |

Each act is strictly harder than the last. None is made of new material. Each is the edge of ability built
entirely from what the learner already owns.

**The sequencing rule that keeps load flat:** *a novel frame is always introduced at the PREVIOUS
session's act-level.* New items arrive on the easy act — modelled by Slavko about himself, echoed by the
learner. The hard act is always performed on **owned** items. Nothing is ever new twice at once.

---

## 2 · Three changes to the product

Each of these is a case where the current build forecloses the better learning experience. None is
cosmetic; the sequence in §4 depends on all three.

### 2.1 Capture the learner's audio. Never judge it. Give it back.

Today the scene deliberately does not open the microphone — the code comments that the audio *"was always
discarded unheard, so holding it only ever bought an OS dialog and the suspicion of being recorded."* That
reasoning is correct **given that nothing used the audio.** It stops being correct the moment something
does. The panel inherited the deletion and then five of nine seats wrote `records: 3 clips` and own-voice
replay strips into their designs anyway — the strongest tell on the page that the whole panel wanted this
back and assumed it existed.

**Capture the audio. Do not transcribe it, do not score it, do not send it anywhere. Play it back to the
learner as the only artifact the sessions produce.**

This is the single largest unlock available, for three reasons:

1. **It is the most concrete possible evidence of learning, and it requires zero judgment from the app.**
   The learner hears themselves speaking Slovene. Nobody has to tell them anything. The invariant that
   matters — *nothing judges the recording* — is untouched: the app still judges nothing. The learner
   judges, which is a different act and is the pedagogically valuable one (self-monitoring is how speaking
   improves).
2. **It resolves "progress is a finite map, never a measure" better than any map of places could.** The map
   *is* the phrasebook, spoken in the learner's own voice, growing by one utterance a session. It is a
   finite list of things you can say. It is not a score, a streak, a percentage or a level. It is the one
   progress object a learner would voluntarily show another person.
3. **Every playback is a spaced retrieval event** — the artifact does double duty as the recycling
   schedule (§5).

**The obvious risk, and the mitigation.** Adults dislike hearing their own recorded voice, and a novice
confronted with their own accent in isolation could lose the confidence the whole sequence is buying.
So: **never a specimen, always a delta.** The first playback comes at the end of **S2**, not S1 — so there
are two data points and it reads as a comparison. The montage always runs oldest → newest and therefore
always ends on the longest, most fluent utterance the learner has ever produced. Nothing is ever replayed
mid-lesson, only at the close, after the win.

### 2.2 Use the open mic for voice activity — not for words.

With the microphone open, the app can tell the difference between **silent and frozen** and **mid-utterance
and thinking**. It cannot do that today, which is why the stall ladder is a timer, why the 15.5-second
dead-air defect was possible, and why seat 5 spent its entire response tuning milliseconds.

**Replace the `stallMs` timer ladder with voice-activity detection.** No ASR, no transcript, no words —
just: is there sound? Help arrives when the learner is actually stuck, and never interrupts them
mid-sentence. This deletes the pacing-profile tuning problem rather than solving it, and it deletes the
class of defect that produced the frozen beginner.

The pacing profiles survive for what they are genuinely good at — reading time, caption dwell, close hold —
and lose the one axis that should never have been a timer.

### 2.3 Put one three-second touch in the gap between sessions.

Nobody on the panel designed the 24–72 hours where the learning actually decays and the decision to return
actually gets made. The highest-leverage intervention in the sequence may not be in a session at all.

**The morning after each session, one audio notification: Slavko's voice, the unglossed closing line from
last night, three seconds, no text, no streak, no count, no guilt.** It is a spaced exposure at zero
session cost, and it means S(N+1) is already partly openable before it opens — the learner arrives having
heard the line once more than the design assumes.

No streaks and no numbers is a principle worth keeping on the merits, not merely because it was decided:
for an adult who is embarrassed about not learning a language, a counter is a debt. This is the opposite —
a fragment of a voice they liked.

**Kept on the merits, after re-examination:** *nothing judges the recording* (ASR on beginner Slovene is
unreliable enough that false negatives would be common and would destroy the willingness to speak, which is
the entire asset); *the linear spoken spine* (seat 9's attack rested on a mechanism it inverted — see
SYNTHESIS §2.6); *progress is never a measure* (§2.1 gives it a better object than the invariant's authors
had available).

---

## 3 · Where felt learning comes from when the app credits nothing

Five sources, all self-evident to the learner, none requiring the app to judge anything:

1. **Your own voice, growing.** §2.1. The artifact. Fires at the close of S2, S3, S4.
2. **Retro-comprehension.** Last session's unglossed closing line, understood today. Unfakeable — you
   either got it or you didn't, and only you know. Fires at the open of S3 and S4.
3. **The visible slot.** The learner produces `Sem [ime].`; Slavko answers `Sem Slavko.` — the same frame,
   someone else's filler. A grammar insight with zero instruction, zero gloss, zero new words. Fires once,
   in S2, and it is the cheapest teaching moment in the product.
4. **Causation.** Slavko does something different *because of* the learner's Slovene. S3's peak — the
   strongest signal available, and the panel spent it on safety it had already bought twice.
5. **Reciprocity.** The learner does what the teacher does — asks. S4's peak.

---

## 4 · The overwhelm guard

Four rails. The objective is the edge; these keep it from becoming a cliff.

1. **The 2:1 pre-production cap** (seat 2 — the best thing the panel produced). No turn immediately
   preceding a learner production exceeds two heard words per produced word. Long lines are allowed *after*
   a production or at the close, never before one. Lintable from shipped JSON.
2. **One novel frame per session**, introduced at the previous act-level (§1); every prior item recycled
   every session (§5).
3. **The edge is the DECISION, never the RETRIEVAL.** Every novel act is pre-supplied on screen the first
   time it is demanded. This is the sharp departure from seat 2, which proposed gutting S3's difficulty to
   protect the learner. Wrong instrument: choice is cheap in working memory and rich in agency; recall
   under load is expensive in both. Keep the demand; delete the recall cost.
4. **Every novel act is structurally unfailable — high ceiling, zero floor.** If the learner does nothing,
   the session proceeds and the payoff still happens, only smaller. Using the tool is better than not using
   it; not using it is never punished, never diagnosed, never mentioned.

Rail 4 is the actual engineering behind "edge of ability without overwhelm."

---

## 5 · The sessions

**Given:** after S1 the learner owns `Živjo` · their own name · `Sem ___.` · `Adijo`, and has produced
`Sem [ime].` at least once. All Slovene below is a **suggestion only** — it goes to `slovenian-author` and
`scenario-critic` before it can ship.

---

### S2 — "He doesn't ask."

**Novel frame:** `govorim_slovensko` — *"Govorim slovensko."* Catalog-verified core, fixed chunk, **zero
morphology, no mint.** No seat proposed it; it is the best S2 item in the catalog. The meaning is the
payoff: the learner asserts the identity the product is selling, and saying it makes it true.
**Novel act: INITIATE.**

**The design is one deletion.** Slavko's opener is the byte-identical S1 clip — `Živjo!` — and then he
*stops*. The question is gone. That removal is the entire lesson: production shifts from cued recall to
free recall at zero vocabulary cost.

| beat | | |
|---|---|---|
| 1 | **hears** `Živjo!` (byte-identical S1 clip), then authored silence | 1 heard |
| 2 | **says** `Sem [ime].` — **unprompted. This is the edge.** | 2 produced · pre-production **1:2** |
| 3 | **hears** `Me veseli! Sem Slavko.` — *the visible slot* (§3.3) | 4 heard |
| 4 | **hears** `Govorim slovensko.` modelled; **says** it back — new item on the echo act | 2 heard / 2 produced |
| 5 | **hears** the unglossed closing line, seeded for S3 | ~6 heard |
| 6 | **the artifact, first time:** two clips, S1's `Živjo` then tonight's `Govorim slovensko.` No commentary. | |

**Sees:** no English on-ramp. Slovene caption on the novel line only. **The first help rung pre-supplies
`Sem ___.` in English** — *"he's waiting for you"* — never diagnoses, never mentions S1, and fires on
silence (§2.2), not on a timer.
**Withdrawn:** the English on-ramp; the caption on returning lines; **the question.**
**Profile:** the generous one. S2 must not tighten — the act is already new, and tempo must never compound
with it. (Five seats agreed; two disagreed and one of those flagged itself.)
**Hands off:** S3, single path, no choice yet.
**Budget:** ~13 heard / 4 produced · 2 learner turns · worst pre-production turn **2:2** · novel frames **1**.

---

### S3 — "You can stop him."

**Novel frame:** `ne_razumem` — *"Ne razumem."* Catalog-verified core, rank 8, fixed chunk, zero
morphology, no mint. **Novel act: REPAIR — the learner changes the world.**

**This is where I break hardest with the panel.** Seats 1, 4, 5, 6 and 8 all sacrificed engagement at S3;
seat 2 kept the beat and deliberately gutted its difficulty. Against the stated objective that is the wrong
trade: S3 is the one session where felt learning is available *for free*.

| beat | | |
|---|---|---|
| 1 | **says** `Živjo. Sem [ime]. Govorim slovensko.` unprompted — three owned utterances **chained**, which is itself a new act performed on nothing new | 1 heard / 5 produced |
| 2 | **retro-comprehension:** S2's unglossed closing line returns, and it lands | ~6 heard |
| 3 | **hears** Slavko say `Ne razumem.` *about himself*; **says** it back — new item on the echo act | 2 heard / 2 produced |
| 4 | **THE PEAK.** Slavko says something genuinely too fast — a real sentence at real speed, authored to be unparseable. `Ne razumem.` sits lit on screen, one glance away. | ~9 heard, **after** a production |
| 5a | learner says it → Slavko *stops immediately*, warms, re-says it slowly. **The world changed because of your Slovene.** | |
| 5b | learner says nothing → the moment they fall silent, Slavko slows down **anyway**; the tool stays lit. Nothing lost; the learner sees what they could have done. | |
| 6 | `Adijo` · unglossed close · **the artifact:** three clips, S1 → tonight | |

Beat 4 is the design. The demand is real and *feels* real; the retrieval cost is zero because the phrase is
on screen; the floor is zero because 5b is a complete, warm session. High ceiling, no cliff.

**Withdrawn:** caption on everything produced twice; the automatic slow re-speak — which is what makes 5a's
slowdown readable *as a response* rather than as routine. **Hands off:** S4, plus the **first choice
screen** — worked dialogue or free chat.
**Budget:** ~18 heard / 8 produced · 4 learner turns · worst pre-production turn **2:2** · novel frames **1**.

---

### S4 — "You ask him."

**Novel frame:** `in_ti` — *"In ti?"* **⚠ requires minting.** Two words, `ti` register, zero morphology,
no predictable error. **Novel act: RECIPROCATE.**

Two words that convert **every frame the learner owns** into an exchange. Highest leverage per token in the
sequence, and the item that makes free chat survivable — a learner who can only answer is at the mercy of
what they are asked.

| beat | | |
|---|---|---|
| 1 | **says** `Živjo. Sem [ime].` unprompted — three sessions deep, automatic | 1 heard / 3 produced |
| 2 | **retro-comprehension:** S3's unglossed close lands | ~6 heard |
| 3 | **hears** `In ti?` modelled; **says** it back — new item on the echo act | 2 heard / 2 produced |
| 4 | **THE PEAK.** **Says** `Govorim slovensko. In ti?` — to a Slovene. Slavko laughs: `Ja! Tudi jaz.` | 4 produced |
| 5 | `Ne razumem.` stays lit and **offered, never demanded**, for the rest of the session | |
| 6 | `Adijo` · unglossed close · **the artifact:** four clips, four days, one voice | |

Beat 4 is a joke, made in Slovene, in session four, out of two new words. Nothing credits it. It doesn't
need to — the learner knows exactly what happened, which is the whole of §3.

**Hands off:** free chat, focused on `govorim_slovensko` · `ne_razumem` · `in_ti`.
**Budget:** ~20 heard / 9 produced · 4 learner turns · worst pre-production turn **2:2** · novel frames **1**.

---

### The recycling schedule — the number that actually predicts learning

Learner **productions** per item, S1→S4, plus artifact replays:

| item | S1 | S2 | S3 | S4 | artifact | total | verdict |
|---|---|---|---|---|---|---|---|
| `zivjo` | ● | ● | ● | ● | ×3 | **7** | learned |
| `sem_ime` | ● | ● | ● | ● | ×3 | **7** | learned |
| `adijo` | ● | ● | ● | ● | — | **4** | learned |
| `govorim_slovensko` | | ● | ● | ●● | ×3 | **7** | learned |
| `ne_razumem` | | | ●● | ○ | ×2 | **4–5** | learned |
| `in_ti` | | | | ●● | ×1 | **3** | **not yet — and deliberately so** |

`in_ti` is the handoff item. It is introduced *because* free chat will drill it in use, not because four
sessions can. That is the honest reading of the last row, and it is why the S4 handoff is focused on it.

---

## 6 · What the learner owns at the handoff

Greet · self-identify · claim the language · **stop a native speaker who is going too fast** · **ask a
question back** — plus a recording of themselves doing all five.

That is not a vocabulary. It is a **conversational floor**: the smallest set that makes an unscripted
thirty seconds survivable, because the last two moves recover *any* exchange that goes wrong. Free chat is
where mastery is earned; this is the smallest kit that lets someone walk in and not drown.

---

## 7 · What I am trading away — stated plainly

1. **Vocabulary breadth.** Four sessions, four items. Seat 3's counterargument stands: the learner still
   cannot order a coffee. **Accepted.** Ordering coffee is worth nothing to someone who left after S3.
   Transactional competence is S5+, and it arrives on a learner who owns the two repair moves that make
   every later scenario navigable.
2. **`sem_iz` deferred to S5.** Four seats put it at S2. Its catalog-verified `predictableError` is
   *"genitive after 'iz' ('iz Amerike', not 'iz Amerika')"* — the slot demands a case ending on a word the
   app cannot supply and the learner does not have. It ships at S5 with the place-name supplied, not at S2
   with a novice improvising morphology on their own home town.
3. **One mint required: `in_ti`.** Everything else is catalog-verified core. Note this is a *different*
   mint from the one SYNTHESIS §5 flagged (`Kako ti je ime?` in `ti`) — `In ti?` is a quarter the length
   and composes with every owned frame, where the other is one specific question. If only one mint is
   affordable, mint this one.
4. **The microphone permission prompt returns**, and with it the suspicion of being recorded that the
   current build deleted on purpose. Paid knowingly: §2.1 buys the strongest confidence object in the
   product and the fix to the stall ladder. The mitigation is that the recording is visibly *the
   learner's* — it is played back to them and nothing else is ever done with it.
5. **S3 is louder than eight of nine seats wanted.** Deliberate. The floor is zero (rail 4).
6. **Two turns at S2.** Fewer than any panel layout. S2's payload is an *act*, not a quantity, and padding
   it would have required a second novel item.

---

## 8 · How this is falsified

The panel measured stall-rung fire rate as a failure signal. **At S3 beat 4 that reading is wrong** — a
learner who fires the repair tool is the success case. Four observations:

1. **Repair-tool use before the help rung, at S3 beat 4.** The direct read on whether causation landed.
   Should be non-trivial at S3 and **rising** into S4, where the tool is offered but never demanded.
   Near-zero means beat 4 is decoration.
2. **Unprompted-initiation latency at the S2/S3/S4 opener.** Must **fall** across the three. Flat means the
   act ladder is not consolidating and §1's thesis is wrong — revert to the panel's item-rationed sequence.
3. **Artifact playback: does the learner sit through it, or leave during it?** The confidence object either
   works or it is the cruellest screen in the app, and this distinguishes them in one number. Watch it at
   S2 specifically — that is the first exposure and the one designed as a delta.
4. **The 2:1 pre-production gate**, as a linter on shipped JSON. The safety rail, not the goal. It would
   have caught the 9-versus-2 defect statically.

One further static check: **assert the act ladder** — a session's hardest act may exceed the previous
session's by at most one rung, and any node introducing a novel frame must sit at or below the previous
session's act-level. That is §1's sequencing rule, mechanised.

---

## 9 · What has to change to build it

Beyond SYNTHESIS §5(a) — S2–S4 are unreachable today, there is no authoring surface for spoken scenes, and
the scene credits when it should not:

- **Audio capture, local, never uploaded, never transcribed** (§2.1), and a store keyed by learnable so the
  montage can be assembled oldest-first.
- **The artifact close** — the growing own-voice phrasebook, which also replaces the progress display.
- **Voice-activity detection driving the help ladder** (§2.2), replacing the `stallMs` timer arrays.
- **A persistent on-screen affordance for an offered-but-not-demanded phrase** (S3 beat 4, S4 beat 5), lit
  from the moment the phrase is first modelled — before any help rung fires. Nothing in the current schema
  expresses this; the closest concept is on the wrong axis.
- **A node-level flag for "authored to be unparseable"** so the 2:1 cap and the A1 lint do not treat S3
  beat 4 as a defect. It is the one beat in the sequence that is *supposed* to defeat comprehension.
- **One scheduled audio touch between sessions** (§2.3).
