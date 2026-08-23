# Seat 7 — Game designer, onboarding & retention (A1)

*Model: sonnet. Panel: first-four-sessions, 2026-08-22.*

---

# S1 → S4: The Slavko Spine

| | **S1 — shipping** | **S2 — Recognition** | **S3 — Exposure** | **S4 — Threshold** |
|---|---|---|---|---|
| **Hears** | `Živjo! Kako ti je ime?` → `Me veseli! Jaz sem Slavko. Zdaj pa še ti.` → `Lepo, da sva se spoznala. Adijo!` (20 words) | Opener uses the learner's own name back at them: `Živjo, [ime]! Me veseli, da si tu.` then `Kako si?` (~10 words) | Slavko introduces the learner to someone else, in front of them: `To je [ime]. [ime] govori slovensko!` (~7 words) | Same three-beat shape as S1, verbatim — but the closing line drops its English gloss for the first time |
| **Sees** | Full on-ramp frame, Slovene + English caption, glossed after each line | Same paired captions; the on-ramp frame is gone (learner knows the format) | Paired captions; a second silent "listener" beat — no new NPC art, just the sentence naming a third party | Paired Slovene caption stays (Reading mode never fully withdraws); English gloss under the *closing* line is withheld |
| **Says** | Own name (unglossed) → `Sem ___.` → `Adijo` (4 words) | `V redu` (new) → `Sem ___.` reused → `Adijo` reused | `Sem ___.` reused, then `Adijo` said **twice in a row**, once to each party — first back-to-back turn | Full S1 shape reused verbatim, at a tighter cadence |
| **Records** | Two clips: name, `Sem ___` | Three clips: `V redu`, `Sem ___`, `Adijo` | Four clips incl. the double-farewell | Three clips at `guided`/`brisk` timing — first clips with *no* generous stall floor |
| **Scaffolds lit** | Frame on-ramp, gloss-after on every line, `pulse`+`respeak` at 4.5s | Gloss-after retained; frame on-ramp withdrawn; opener is a callback, not new prose | `pulse`+`respeak` retained but thresholds loosen (guided stallMs) | Closing-line gloss withdrawn; stall floor moves toward brisk |
| **Scaffolds withdrawn** | none — maximum room | on-ramp frame | — | English gloss on final line; some stall slack |
| **Pacing profile** | `onboarding` | `onboarding` (content load must not compound with tempo change) | `guided` | `guided`, with an experimental `captionLeadMs` bump on the close (see §5 fight) |
| **Hands off to** | choice screen: worked dialogue only | choice screen: worked dialogue only | choice screen: worked dialogue, *offered* free chat (dimmed/preview) | choice screen: free chat now live and first-listed |
| **Heard:produced ratio** | ~5:1 | ~4:1 | ~3.6:1 (four turns absorb the same heard load) | ~5:1 heard, but half the heard content is *literally repeated from S1* — effective novel-word ratio ≈ 10:1 |
| **What changed, no new content** | n/a — this is zero | Slavko remembers you: the opener is a callback, not new prose | Someone else is listening; you produce two turns back-to-back for the first time | The room goes quiet a half-beat longer before the last line lands, and no one tells you what it meant |

---

## 1. The stepping stone

**`Sem [name].`** That is the whole deliverable of S1. Not the bare name — a bare name is a listening lesson, per the finding this panel already banked — the *frame*. The moment a learner has produced "Sem ___" once, under pressure, and the app did not judge it, they possess the one thing S2 needs to exist: a sentence Slavko can *quote back to them*. S2 opens with `Živjo, [ime]!` — that's not new content, it's S1's output replayed by the world. If S1 ends anywhere short of that frame — if the learner only manages the bare name — S2 has nothing to hand back to them and has to re-teach identity from zero, which is exactly the flat restart this whole sequence exists to avoid.

## 2. The frontier

The real conflict is S3, and it is not vocabulary — it's **witness**. Confidence says: keep every session as private and forgiving as S1, one listener, infinite patience. Engagement says: a second consecutive private one-on-one with Slavko is *the same session again* — no consequence has changed, so nothing distinguishes S3 from S1 except runtime. The only way to make S3 feel like a different place without adding a word is to change who's in the room. That costs confidence directly: the moment Slavko says "This is [name]" to a third party, the learner's successful private recital becomes a public claim, and a stall in front of a witness reads as more exposed than a stall alone, even though the app still doesn't grade it. I sacrifice a slice of confidence-safety here on purpose — "consequence, not stakes" means the *feeling* of being seen has to increase even while the actual risk (nothing judges the recording) does not. The mitigation is that the witness costs zero new audio or vocabulary: Slavko still speaks, the "third party" is implied by the sentence, not a new voice asset. Simplicity wins on the *mechanism*; engagement wins on the *frame*.

## 3. The drop-off

The beat most likely to lose the novice is **S3's second farewell** — the back-to-back turn. It's the first time in the sequence the learner has to speak twice without a full NPC line in between to reset their nerve, and it's also the first beat with zero net-new content, meaning a learner correctly senses "I already did this" and the boredom failure mode this panel cares about as much as the difficulty one becomes live. What prevents it: the second `Adijo` must be *demonstrably easier* than the first — same word, shorter stall floor before help, faster handover — so the double-turn reads as a flourish the learner is already equipped for, not a second exam. If it takes as long to clear as the first, cut it; a stepping stone repeated at equal cost isn't consequence, it's padding, and padding is exactly what a bored novice quits on.

## 4. What I would cut

I would cut the **third character** I was tempted to write into S3. The panel's instinct (mine included) is to make "exposure" literal — a new NPC, a new voice, a new background — and that is new content dressed as a structural beat. I remove it and keep the "someone else is listening" entirely inside Slavko's line (`To je [ime].`) with no second voice asset, no new art. What that buys: S3 stays audio-cheap (one voice, reused clips), authoring-cheap (one new sentence, zero new learnables need minting — `me_veseli`, `v_redu`, `adijo`, `sem_ime` all already exist in the catalog), and it protects the load budget — a novice at S3 still has almost nothing on screen they haven't seen. The frontier this buys room for is S4 and beyond, where a second NPC will eventually be worth its cost because there'll be enough banked confidence to spend it on.

## 5. How we'd know

I take the "silent hold before the caption" fight and settle it as a **tension beat that grows**, and I'd measure it directly, not infer it: log `captionLeadMs` per session against the fraction of learners who release the speak button *before* the caption resolves versus after — a rising pre-caption release rate across S1→S4 is the sequence working (the learner is starting to retrieve, not just wait). A flat or falling rate, or a spike in `respeak`/`pulse` triggers specifically on S3's second turn or S4's unglossed close, is the sequence failing at exactly the beats I flagged as risk in §3. Given that four green gates caught none of four real defects, the only trustworthy signal is runtime telemetry on stall-handler firings and pre-release timing per node, not schema validation — I would not trust this sequence until I'd watched actual stall-handler logs for S3-c2/c3 and the S4 closing node specifically.

---

**Confidence:** medium — the S1 stepping stone and the no-new-audio constraint on S3 are load-bearing and I'm confident in them; the growing-`captionLeadMs` resolution to the open fight is my own reading and unverified against real learners.

**Strongest counterargument to my own view:** an absolute novice may not register "someone else is listening" as exposure at all without a genuinely new voice or face — a sentence naming a third party, with no auditory or visual change, risks reading as more prose from the same character rather than a change of circumstance, in which case S3 buys none of the novelty I'm claiming and the sequence quietly collapses back into three sessions of S1.
