# Seat 2 — Cognitive scientist, memory & retrieval (A1)

*Model: opus. Panel: first-four-sessions, 2026-08-22.*

---

# The four-session spine

**Counting rule.** *Heard* = Slovene word-tokens actually delivered, including automatic re-speaks. *Produced* = word-tokens the learner utters. The learner's own name counts as a turn but **zero Slovene words**. The number that matters is not the session ratio — it is the **pre-production ratio**: heard-words in the turn immediately before a production. That is where the novice's load actually lands.

**My one hard constraint: the pre-production turn is capped at 2 heard : 1 produced.** Long lines are permitted *after* a production or at the close, never immediately before one. This is the direct fix for the 9-heard/2-produced defect, and it is an authoring rule, not a renderer change.

| | S1 | S2 | S3 | S4 |
|---|---|---|---|---|
| **Hears** | `Živjo.` → `Kako ti je ime?` → `Me veseli!` → `Sem Slavko.` → `Adijo!` | S1 opener **token-identical**, then `Sem iz Ljubljane.` | opener, then `Živim v Ljubljani.`; one deliberately fast line | opener, then `Delam kot vodnik.`; Slavko waits to be asked |
| **Sees** | Slovene caption paired with audio on novel lines; no gloss on `n1a`, `n3` | same; caption **withheld on the first S1-line attempt** | caption withheld on all returning lines | caption withheld on returning + the fast line |
| **Says** | `Živjo` · name · `Sem ___.` · `Adijo` | `Živjo` · `Sem ___.` · `Sem iz ___.` · `Adijo` | + `Živim v ___.` · **`Ne razumem.`** | + `Delam kot ___.` · `Še enkrat, prosim.` · **`Kako ti je ime?`** |
| **Turns** | 4 | 4 | 6 | 7 |
| **Heard / produced** | ~30 / 5 (6:1) | ~34 / 7 (4.9:1) | ~40 / 9 (4.4:1) | ~44 / 12 (3.7:1) |
| **Worst pre-production turn** | 2:1 (`Sem Slavko.` → `Sem ___.`) | 2:1 | 2:1 | 2:1 |
| **Novel frames** | 1 (`sem_ime`) | 1 (`sem_iz`) | 1 (`ne_razumem`) + slot-variant `zivim_v` | 1 (`se_enkrat`) + slot-variant `delam_kot` + inverted `kako ti je ime` |
| **Records** | attempts on `zivjo`, `sem_ime`, `adijo` — **exposure, not mastery** | + `sem_iz`; per-learnable **last-seen timestamp** | + `zivim_v`, `ne_razumem` | + `delam_kot`, `se_enkrat` |
| **Lit scaffolds** | English on-ramp, paired caption, gloss-after, slow re-speak, 3 stall rungs | on-ramp **dead**; caption, gloss-after, stall rungs | caption on novel only; stall rungs | caption on novel only; stall rungs |
| **Withdrawn** | — | English on-ramp; caption on returning lines | automatic slow re-speak (demoted to stall rung 2) | gloss-after on any line older than one session |
| **Profile** | `onboarding` | `onboarding` | `guided` | `guided` |
| **Hands off to** | the door choice: worked-example dialogue or free chat | same | same | same, and free chat can now be *entered in Slovene* |

Ids verified against `server/catalog/learnables.json`: `zivjo`, `sem_ime`, `adijo`, `sem_iz`, `zivim_v`, `ne_razumem`, `se_enkrat`, `delam_kot`, `me_veseli`, `nasvidenje`. **`kako_ime` exists but is stored as vikanje (`Kako vam je ime?`) — S4's payoff beat needs a `ti` minting.** That is a real blocker, flagged not fudged.

**S1 changes from the shipping file:** split `n1` into `Živjo.` / `Kako ti je ime?`; split `n2` into `Me veseli!` / `Sem Slavko.`; delete `Zdaj pa še ti`. Add `c0` — the learner echoes `Živjo` at second ~8, one word, before any question has been aimed at them. Everything else stands.

**I do not move to `guided` at S2.** S2 is the weakest session in the whole sequence — 24–72h of decay *plus* a format that is still novel. Withdrawing timing there is withdrawing the wrong scaffold at the worst moment. Timing withdraws when the format is automatic, which is S3.

**The silent hold — settling it.** The fight is unwinnable because the question conflates two different beats. Before a **novel** line there is nothing in memory; a silent hold there is not desirable difficulty, it is dead air with a retrieval costume on. `captionLeadMs: 0` on novel lines, permanently, at every profile. Before a **returning** line the hold *is* the retrieval attempt, and it should be long and it should grow. So: add `recallLeadMs`, applied only to lines the learner has heard in a prior session — `onboarding: 1200`, `guided: 1800`, `brisk: 2600`. One new field, novelty-keyed, growth arrives as a profile swap exactly as decided. Both camps were right about different beats.

---

## 1 · The stepping stone

**`Živjo.`** One word, utterance-initial, heard twice before it is asked for, produced within twelve seconds of the app opening.

Not `Sem ___.` — that is S1's *frame*, and frames are what the session teaches. The stepping stone is what makes S2 *openable*, and openability is not a knowledge state, it is a memory of having succeeded. `Živjo` is the only utterance in S1 that a learner can retrieve cold at hour 24 with no cue and no caption, which means it is the only thing that can open S2 without the app having to teach before it tests. Everything else in S1 is encoding. This one item is the handle.

## 2 · The frontier

The conflict is at **S3, and it is engagement versus simplicity, and I sacrifice engagement.**

S3 is where the deliberately-fast line lives — the learner says `Ne razumem.` and Slavko audibly slows down. That is the single most engaging beat available in the whole sequence: the moment the learner changes another person's behaviour. It is also the most complex, because it requires the learner to (a) fail to parse, (b) recognise that failing to parse is a legitimate state, and (c) retrieve a two-word Slovene phrase *while already overloaded*. That is three simultaneous demands at the exact moment cognitive resources are lowest.

**I keep the beat and I gut its difficulty.** `Ne razumem.` is modelled by Slavko in the immediately preceding turn (2 heard : 2 produced), so the retrieval is warm, not cold. It is not "the learner discovers a repair phrase"; it is "the learner echoes a phrase and then discovers what it *does*." The cost: the beat is materially less impressive, and a competent adult will feel led. I accept that. The alternative — cold-retrieving repair under overload — has an available failure mode that is worse than boredom: it teaches the learner that their comprehension is broken, in the exact session where the app first speaks faster than they can follow.

Confidence loses nowhere in S2–S4, because confidence is the thing the entire sequence is buying.

## 3 · The drop-off

**Not S1. The single most likely quit is beat 2 of S2: the first caption-withheld attempt at `Sem ___.`**

This is the first moment in the product where the app asks for something the learner has to actually *remember*, across a 24–72h gap, with nothing on screen. If the design is even slightly wrong there, the learner's first experience of the returning session is the discovery that they retained nothing — which is a far more powerful predictor of abandonment than anything in S1, because S1 has novelty carrying it and S2 has nothing carrying it.

Three things prevent it, in order:

1. **Ordering.** The first S2 production is `Živjo`, not `Sem ___.` — one word, heard three seconds earlier, unfailable. The cold retrieval is the *second* production, attempted from a body that has already succeeded once today.
2. **Pre-supply, never diagnose.** Stall rung 1 restores the caption at full luminance. No "let's review", no acknowledgement that a gap occurred. The learner must never learn that the app noticed them forgetting.
3. **Token-identical opener.** The S2 audio bytes for `Živjo. / Kako ti je ime?` are the *same file*. Recognition of a literal acoustic token is the cheapest retrieval cue that exists, and it is free.

## 4 · What I would cut

**The automatic slow re-speak, from S2 onward.** `slowSL` / `deliverySlowSL` stop firing as a scheduled beat and become stall rung 2 only.

An immediate automatic re-speak is the most expensive thing in the current design and I do not think anyone has priced it. It doubles heard-words per line for zero production. Worse: it converts every retrieval attempt into a recognition event. The learner who was three seconds from producing the line from memory is handed it instead, feels fluent, and retains less — the classic recognition-inflates-confidence-without-moving-memory trap. It is a scaffold that feels like teaching and functions like erasure.

Removing it buys roughly 8–10 seconds and ~14 heard-words per session — the entire budget for S3's and S4's extra learner turns, with **no increase in session length**. Sessions grow by the learner's own turns; this is where the seconds come from.

Second cut: **the gloss on S1's closing line.** `n3` currently has `glossPolicy: "after"`. The closing line should be unglossed and stay unglossed — it is the item that becomes comprehensible next session, and glossing it spends that for nothing.

## 5 · How we would know

Four green gates caught none of four defects because all four gates asked *is this well-formed* and none asked *what happened to a person*. So instrument the beat, not the file. Three observations, in priority order:

1. **Rung-1 fire rate at the S2 cold-retrieval beat.** This is the sequence's vital sign. Under ~25%: the withdrawal is calibrated. Over ~40%: it is not retrieval, it is a wall, and the caption should not have withdrawn at S2. This is one counter and it falsifies my central curriculum claim directly.
2. **Time-from-button-arm to first press, per beat, per session.** Retrieval has a signature: latency should *rise* at withdrawal beats and then *fall* across sessions for the same item. If latency at `Sem ___.` is flat from S2 to S4, nothing is consolidating and the spine is a listening course with a button. If it rises and never falls, I withdrew too fast.
3. **S(N+1) open rate within 72h, conditioned on which stall rung fired in S(N).** The engagement claim of this whole layout is that a session ending in an unstalled final turn produces a returner. If open-rate is uncorrelated with stall history, my model of what makes session N+1 openable is wrong and should be replaced.

Plus one gate the linter *can* hold, cheaply, because it is arithmetic: **fail any dialogue whose pre-production turn exceeds 2:1 heard:produced.** That single rule would have caught the 9-versus-2 defect statically.

---

**Confidence:** medium-high — the ordering and load rules follow directly from well-established retrieval findings and from four defects already observed in this build; the specific `recallLeadMs` values and the S3 profile switch are calibration guesses that only the telemetry in §5 can settle.

**Strongest counterargument to my own view:** I have optimised the sequence for *retention across the gap*, but the thing that actually kills language apps is that nobody opens session 2 at all, and retention plays almost no part in that decision. If the real driver is narrative pull — wanting to know what Slavko says next — then my cuts (the automatic re-speak, the S1 closing gloss) strip warmth to buy memory that an un-returning learner never gets to use, and my deliberate softening of S3's repair beat sands down the one genuinely thrilling moment in four sessions. A seat optimising for pull would keep S3 hard, accept the retrieval cost, and be right if engagement, not memory, is the binding constraint at hour zero.
