# Seat 4 — Behavioural habit designer (A1)

*Model: sonnet. Panel: first-four-sessions, 2026-08-22.*

---

# Return-loop layout: S1 → S4

Pacing profile mapping (withdrawal as profile swap, not re-authoring): **S1 = `onboarding`, S2 = `onboarding`, S3 = `guided`, S4 = `guided`→`brisk` at the closing beat only.** S1 keeps its full room because a second exposure to the *same* material still needs generous silence — the withdrawal starts when new grammar starts, not when the calendar turns.

| | S1 (shipping) | S2 | S3 | S4 |
|---|---|---|---|---|
| **Hears** | `n1` 5w / `n2` 9w / `n3` 7w = 21w | Opener callback with learner's name (~6w) + one recirculated frame (`Sem Slavko`, no new learnable) + one new 4–5w exchange | Opener callback (~5w) + one **single** new frame (origin or home, not both) ~6–8w | Opener callback + one new frame that bridges outward ("Zdaj pa greva na kavo" — now let's go get coffee) ~6–8w |
| **Sees** | Frame EN on-ramp, held gloss on `n1`, gloss-after on `n2`/`n3`, no meter | Frame EN on-ramp thinning (fewer lines, faster fade per `onboarding`), Slovene caption still paired | Slovene caption paired, no EN frame text — captions carry the on-ramp now | Slovene caption paired, first glimpse of the destination scenario (café doorway) as the handoff visual |
| **Says** | name / "Sem ___." / "Adijo" — 3 learner turns, 4w produced | name (0 new load) / one new 1–2w answer to the new frame — **4 learner turns** | name / recirculated "Sem ___." (heard-only confirm, not re-demanded) / one new 2–3w answer — **4 learner turns**, but the new answer is longer | same shape as S3 + the unglossed line from S3's close, now produced back — **5 learner turns** |
| **Records** | 3 clips (unfailable) | 4 clips | 4 clips | 5 clips, replay strip now spans 4 sessions |
| **Scaffolds lit** | EN frame, held gloss, pulse+respeak stalls | EN frame (thinner), gloss-after only, pulse+respeak | Caption-only, pulse+respeak, gloss re-arms only on stall | Caption-only, respeak-on-stall, gloss fully re-arm-only |
| **Scaffolds withdrawn** | — | held-gloss on new content | EN frame text entirely | nothing new withdrawn; consolidation session |
| **Pacing** | `onboarding` | `onboarding` | `guided` | `guided`, `brisk` on close |
| **Hands off** | closes into unglossed line, no choice yet (still onboarding proper) | closes into choice screen appearing for the first time: worked dialogue vs. free chat, framed low-stakes | closes into same choice, dialogue option now visibly "about the café" | closes by *walking into* the dialogue/free-chat choice — the handoff line is spoken in-scene, not a menu |
| **Heard:produced** | ~5:1 | ~5:1 (unchanged — no widening yet) | ~4:1 | ~3.5:1 |

---

## 1. The stepping stone

The single utterance S1 must leave the learner able to produce is **"Sem ___."** — not the name alone, not "Adijo." A bare name is an echo; "Adijo" is an echo too (Slavko says it, they say it back, zero construction). "Sem ___." is the one moment in S1 where the learner supplies a *frame* and fills a *slot* — the smallest unit that is actually Slovene grammar rather than noise. S2 is openable because S2 can be built entirely on the premise "you already know how to say who you are" — that's a real capability, not a memorized sound. If the stepping stone were the name or "Adijo," S2 would have nothing to build forward from except more echoing, and the sequence would stay flat instead of accruing.

## 2. The frontier

The sharpest conflict is in **S2**, at the exact point where it's tempting to add a reciprocal "How are you?" exchange. Engagement wants it — it feels like a real conversation, Slavko caring about the learner reads as warmth. Confidence wants it too, superficially — answering a question about yourself feels good. But simplicity loses hardest here, and I sacrifice the exchange entirely: a "how are you" answer is either arbitrary (fine/good/bad — nothing to get right) which makes the produced turn hollow, or it gets silently judged, which breaks the unfailable property that lets a tired adult speak at all. I cut it. The cost: S2 feels slightly less like "a conversation" and slightly more like "a lesson that remembers you." I accept that cost because a lesson that remembers you is the actual product — the reciprocal small talk was going to buy narrative texture at the price of the one property (nothing judges you) that makes reopening possible.

## 3. The drop-off

The exact beat is **S3's first new-content turn** — not S1 (which is well-scaffolded per the prior panel's fixes) and not S2 (which is deliberately flat, still riding S1's frame). S3 is where the ritual the learner has now opened twice starts changing shape: new vocabulary, a new grammatical slot, and the EN frame text gone. If that turn asks for two new things at once — origin *and* age, say — the heard:produced ratio at that single turn collapses below 3:1 and the learner is staring at unfamiliar sounds with no foothold, exactly the failure mode the prior panel already diagnosed at S1's key beat. What prevents it: S3 gets **exactly one novel frame**, full stop, even though S3 "should" feel like more progress than S2. Everything else in S3 is recirculated — heard, not re-demanded. The ritual's shape (open, hear name-callback, one new thing, close on a hook) stays identical across S2/S3/S4; only the content inside the "one new thing" slot changes. Predictability of shape is what survives a tired Tuesday; novelty of content is a bonus the shape can absorb only one unit at a time.

## 4. What I would cut

I cut the S2 "how are you" reciprocal exchange (above), and I cut any temptation to give S3 or S4 a **visible recap** of what's been learned — no "here's what you know so far" screen. The prior panel already ruled this out for S2's retrieval attempt; I extend it through S4: a recap consumed before speaking is confidence borrowed against the thing that's supposed to prove itself unprompted. What the removal buys, in both cases: it keeps the heard:produced ratio honest instead of decorative, and it keeps every learner turn a genuine retrieval attempt rather than a performance of remembering. Four sessions with fewer turns that are all real beats confidence better than five sessions padded with one hollow one.

## 5. How we would know

Given that four green gates caught none of four real defects, I would not trust anything that isn't a measurement of learner behavior at the boundary between sessions. Concretely: (a) **re-open rate within 48h of a session's close**, segmented by whether a stall rung fired during that session's final learner turn — if stalls correlate with non-return, the closing hook isn't recovering confidence, it's exposing failure; (b) **elapsed silence vs. authored `stallMs`/`closeHoldMs`** on the *first* turn of each new session — if learners are truncating the close-hold (skipping past it) that's a "get me out of here" signal the profile isn't generous enough at exactly the moment it should be most generous; (c) **heard:produced ratio actually realized per turn**, computed from the shipped node text, not estimated — S3's single-novel-frame rule is a design intent, and only counting words in the actual JSON proves it held. None of these require judging the *content* of a recording — they only require timing and re-open telemetry, which respects the unfailable property while still telling us whether the return loop is doing its job.

---

**Confidence:** medium — the S1 grounding is solid and the growth-axis/profile-mapping constraints are already decided, but S2–S4 content is my own construction pending `slovenian-author`/`scenario-critic`, and I have no real usage data yet, only the prior panel's diagnosed failure modes to reason from.

**Strongest counterargument to my own view:** cutting the reciprocal "how are you" exchange optimizes for ratio-purity at the cost of the one thing that makes a return loop *feel* like a relationship rather than a drill — a Slavko who never asks about you, only tests you, may read as colder and less habit-forming than a slightly less efficient lesson that lets the learner be asked about, even hollowly; efficiency and warmth are not the same axis, and I may be trading away the second for the first.
