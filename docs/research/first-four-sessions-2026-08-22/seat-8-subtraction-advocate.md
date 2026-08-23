# Seat 8 — Subtraction advocate (A1)

*Model: opus. Panel: first-four-sessions, 2026-08-22. Mandate: remove. This seat was forbidden from proposing a single addition.*

---

Everything below is a cut. Where a line reads like a design, it is the residue after cutting, not an addition.

---

## The four sessions

### S1 — one word out of your mouth

| | |
|---|---|
| **Hears** | `Živjo!` · `Me veseli! Jaz sem Slavko.` · `Lepo, da sva se spoznala. Adijo!` — ~12 Slovene words |
| **Sees** | Slavko. The button. One English on-ramp line: *"Practice Speaking, then press the button to continue."* Nothing else. |
| **Says** | `Živjo` · `Adijo` — 2 words, both echoes of a word heard <4s earlier |
| **Records** | Nothing in `model.learnables`. A local audio blob, never uploaded. An `encountered` list: `zivjo`, `adijo`. |
| **Lit** | Slavko's face, the pause, the `pulse` stall rung |
| **Withdrawn** | n/a — S1 is the ceiling |
| **Profile** | `onboarding` |
| **Hands off** | Nowhere. The scene ends on the learner's own voice played back once. No home, no choice, no tile. |
| **Budget** | 12 heard / 2 produced ≈ **6:1** · 2 learner turns · ~4s authored silence |

**Deleted:** `Kako ti je ime?` from `n1`; the whole `c1` name turn; `Zdaj pa še ti`; `c2` and `sem_ime` from S1; all three `objectives[]` descriptors; on-ramp lines 1–3 (`"Hi"`, `"Ready to learn Slovene?"`, `"Let's go!"`); every `slowSL`/`deliverySlowSL`; the pre-turn caption; `glossPolicy: "tap"`; `pointerleave` as a release trigger.
**Buys:** the load asymmetry collapses from 9-heard/2-produced-in-one-beat to 1-heard/1-produced at the beat that matters. The first button-press follows a word heard twice, not an unparsed question. The crediting harms disappear with the `learnables` array. ~3s of on-ramp and two billed clips per beat, gone.

### S2 — the same word, cold

| | |
|---|---|
| **Hears** | `Živjo!` — **the identical clip from S1**, same delivery · `Sem Slavko. Zdaj pa ti.` · `Adijo!` (identical clip) |
| **Sees** | Slavko. Button. Slovene caption **after** he finishes, never before a turn. No English on-ramp. |
| **Says** | `Živjo` (cold) · `Sem ___.` (echo) · `Adijo` (cold) — 3 Slovene words |
| **Records** | `encountered: [zivjo, adijo, sem_ime]`, handed to nothing yet |
| **Lit** | caption (post-hoc), `pulse`, stall rung 1 = Slavko re-says the word to himself, unremarked |
| **Withdrawn** | English on-ramp, English gloss, pre-turn caption |
| **Profile** | `onboarding` |
| **Hands off** | Ends on own-voice replay. Still no choice screen. |
| **Budget** | ~18 heard / 3 produced ≈ **6:1** · 3 turns |

**Deleted:** the recap screen; the varied opener; *every* new audio clip for the greeting and farewell; the diagnostic branch that asks whether the learner remembered.
**Buys:** an episodic trace that is retrievable at 24h because it is byte-identical, and a session that costs one new clip. Pre-supply replaces diagnosis, so forgetting has no representation.

### S3 — one repair move

| | |
|---|---|
| **Hears** | S1/S2 openers · one deliberately too-fast line the learner is *meant* to miss · `Ne razumem` modelled by Slavko about himself |
| **Sees** | caption; the fast line is captioned and still unparseable — that is the point |
| **Says** | `Živjo` · `Sem ___.` (cold) · `Ne razumem` · `Adijo` — 4 turns |
| **Records** | `encountered` + the same set as `focusIds` for later |
| **Lit** | `pulse`, model-rung |
| **Withdrawn** | caption on the two lines the learner has produced twice |
| **Profile** | `brisk` |
| **Hands off** | Ends on own-voice replay |
| **Budget** | ~24 heard / 4 produced ≈ **6:1** |

**Deleted:** `pocasi_prosim`, `ponovite_prosim`, `se_enkrat` — the other three repair phrases. **Buys:** the register mismatch evaporates, because all three deleted forms are stored in vikanje and Slavko speaks *ti*. A novice needs one move when input outruns them, not a menu of four. One novel frame, honoured.

### S4 — one new frame, then a stranger

| | |
|---|---|
| **Hears** | the openers · `Sem iz ___.` modelled · a **second voice** that is not Slavko, briefly, unglossed |
| **Sees** | caption on the new frame only |
| **Says** | `Živjo` · `Sem ___.` · `Sem iz ___.` · `Ne razumem` · `Adijo` — 5 turns |
| **Records** | first time anything is credited — and only after handoff, on the live mic |
| **Lit** | `pulse` |
| **Withdrawn** | caption on everything owned; gloss; on-ramp |
| **Profile** | `brisk` |
| **Hands off** | **The only choice screen in the sequence:** worked-example dialogue, or free chat with `focusIds` = everything encountered in S1–S4. |
| **Budget** | ~28 heard / 6 produced ≈ **4.5:1** |

**Deleted:** `zivim_v` and with it the `iz`+gen / `v`+loc contrast. **Buys:** the first morphosyntactic contrast leaves the beginner path entirely. Two frames that differ only in case is a grammar lesson in costume.

---

## 1. The stepping stone

**`Živjo.`** Said aloud, unprompted, to a face, at second forty of the learner's life with this language. Not "can say their name" — a name is not Slovene, produces zero transferable tokens, and is the one utterance the app is structurally incapable of remembering. S2 is openable because the learner owns exactly one word and knows the person they will say it to.

## 2. The frontier

The conflict is at **S3**, and it is engagement vs simplicity. S3 is where the format has to stop being intimate — a second voice, exposure, the deliberate incomprehension beat — or the adult starts to suspect nothing they do matters. Engagement wants that stranger at S2. **I sacrifice engagement**: the stranger waits until S4, and S3 spends its novelty budget on one repair phrase instead. The cost is real and I name it: S3 is the flattest session in the sequence, structurally a repeat of S2 with one word added, and some learners will find it boring. I take boring over overwhelmed, because a bored novice opens S4 and a flooded one does not. Confidence is not sacrificed anywhere — it is the only thing this sequence is buying.

## 3. The drop-off

**S1, the moment the button first arms after `n1`.** Not S2's cold demand. In the shipping file, `n1` is *"Živjo! Kako ti je ime?"* — nine syllables of unparsed audio, then a button, and the learner does not know they have been asked anything. That is the beat where an adult concludes this is not for them.

**Prevention by deletion: cut the question.** `n1` becomes `Živjo!` alone. The button then arms after a single word the learner has heard, and the only available action is to repeat it. There is nothing to fail at because there is nothing to work out. This also deletes the 15.5s dead-air exposure at the worst beat, because a learner who knows what to say does not reach rung one.

## 4. What I would cut — ranked

1. **Every `learnables` array on every `client` node, in every session, forever.** The scene writes an `encountered` record and hands it to free chat as `focusIds` (the seam at `mastery.ts:213` already exists). Kills the scene-closes-forever, reuse-demotes, and bootstrap-flip defects, and the lying A1 map. Four bugs, one deletion, zero replacements.
2. **`sem_ime` out of S1**, with `c2` and `Zdaj pa še ti`. Buys the load asymmetry.
3. **`Kako ti je ime?` and the `c1` name turn.** Buys the drop-off beat above.
4. **`slowSL` and `deliverySlowSL` everywhere.** Two billed clips per beat, and finding #4 says never answer a stuck learner with more of the target language — a slow re-speak *is* more of the target language. The `respeak` rung replays the normal clip or does nothing.
5. **The `guided` pacing profile.** Read the numbers: `guided` is the arithmetic midpoint of `onboarding` and `brisk` on captionReadMs (900/800/700), handoverMs (600/500/400), closeHoldMs (2200/1800/1400), frameLineMs, frameCharMs. It is interpolation pretending to be pedagogy. No learner perceives 100ms of caption dwell. Two profiles: S1–S2 `onboarding`, S3–S4 `brisk`.
6. **Five of eleven durations.** `captionLeadMs` is `0` in all three profiles — provably dead. `backchannelMs` is `700` in all three — a constant, not an axis. `frameLineMs`, `frameCharMs`, `frameFadeMs` collapse into `frameHoldMs` once the on-ramp is one line. Eleven → six; thirty-three numbers → twelve.
7. **The choice screen at S1–S3, and the home/A1-Readiness surface entirely.** A decision before a habit is churn.
8. **The `soften` rung and `glossPolicy: "tap"`.**

**The unpopular one: delete "the world remembers your name."** Three seats will want it — it is the return loop's warmest hook. It is unbuildable inside this format. Nothing judges the recording (finding #8) and the ASR transcript is never shown, so the app cannot know the name without either reading the transcript or putting a text field in front of the first win. Both break something decided. Better to delete the hook now than to let four sessions get designed on a foundation that requires an invariant to fall. What replaces it is deletion, not a mechanism: Slavko repeats the *identical greeting clip*. Recognition of a returning voice does the same emotional work and costs nothing.

**Second unpopular one:** the slow re-speak (#4). The repo has a commit specifically for making slow clips actually slow. That effort is sunk cost; the feature is still wrong.

## 5. How we would know

Four green gates missed four defects because they checked *presence*, not *duration*. So: no new gate that asserts a field exists. One number, from a real run, per session.

**The primary observation: the fraction of learner turns in which stall rung 1 fires.** It is measured, not asserted; it is a duration, not a presence; and it is the direct read of "was the step small enough to take." Target under 15% at S1. If S1 fires above that after the question is deleted, my sequence is wrong and the problem is the format, not the content.

**Two supporting reads.** (a) Compute heard-vs-produced word counts *from the dialogue JSON itself* — a linter that fails when produced exceeds heard/3, or when a session introduces more than one novel frame. That is arithmetic on shipped data, which is the only class of check that has ever caught anything here. (b) S2-open rate within 48 hours, as a raw count. Not a retention curve — a count.

**What would falsify me:** if S3 shows the highest abandonment despite being the simplest session, then boredom outranks overwhelm at this stage and the stranger belongs at S2.

---

**Confidence:** medium — the crediting deletions and the dead pacing fields are verified facts about the build and I am certain about them; the S1 content cut rests on a judgment about novice affect that only the stall-rung number can settle.

**Strongest counterargument to my own view:** Finding #1 says withholding requires scaffolding to pay for it, and I have deleted scaffolding — the slow re-speak, three of four repair phrases, the pre-turn caption, the second frame at S4 — while leaving withholding in place. If that is what I have done, I have made the exact error the finding names, worse. My defence is that I deleted the *withheld things* in the same stroke: there is no unparsed question to need a slow re-speak, no second frame to need a contrast explanation, no caption to hold before because the target is a word heard twice. Where I could not delete the withholding — S2's cold `Živjo` — I kept the scaffold and made rung one the model itself. But the honest version is that S3 and S4 are where this gets tested, and I am reasoning about sessions that do not exist yet from the least dense lesson the app will ever have (finding #7). If S4 at 4.5:1 with a repair phrase and a stranger turns out to need the caption I withdrew, the subtraction seat was wrong at exactly the point where it stopped being free.
