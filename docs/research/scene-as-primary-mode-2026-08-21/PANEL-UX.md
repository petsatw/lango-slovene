# Panel response — UX designer

*Seat: senior UX designer, adult consumer products, voice/audio interfaces, onboarding. Verbatim.
Grounded in `public/app.js` (`scenePlayBeat`, `sceneArmStalls`, `wireSceneMic`),
`server/dialogues/slavko-intro-1.json`, `server/server.ts` `POST /api/scene`, and the 171-beat map.*

---

Before the five verdicts, three things I found in the code that change what the panel is arguing about.

**1. The stall ladder fires roughly thirteen seconds later than the design says.** The atomic map's stall handlers sit at absolute clock times 0:15.5 / 0:18.0 / 0:22.0, against a button that rises at 0:11.0 — i.e. **+4.5s / +7s / +11s after the button appears**. `slavko-intro-1.json` carries `afterMs: 15500 / 18000 / 22000`, and `sceneArmStalls` starts those timers at button-arm. The absolute timestamps were transcribed as relative offsets. A learner who freezes at `n1` gets **no help of any kind for 15.5 seconds**, and the bar does not lower until 22s — about 35 seconds into the run, staring at a breathing circle on a black screen. Much of what reads as "too long" is not the dialogue. It is dead air that was never designed.

**2. The on-ramp is 3.8s, not 3.0s, and the most important line in it is the least legible.** `scenePlayFrame` runs 3×700ms stagger + 1100ms hold + 620ms fade. Line three — *"If you forget something, that's on us."*, the app's entire no-blame contract, argued by A7 as the highest-retention move in the prior art — is rendered at `15px` in `var(--muted)` (`styles.css:609`) and is on screen readable for about 1.8 seconds. We styled the promise as a footnote.

**3. The cached "Mhm." is almost certainly being cut off.** On release, `sceneSay(scene.backchannel)` is fired unawaited, then `sceneStep` awaits one local fetch and calls `sceneSay(npc.sl)` — whose first statement is `stopDialogueAudio()`. The backchannel is ~500ms; the fetch is tens of milliseconds. Beat 55, the panel's single best latency idea, is being killed by beat 60 about 50ms in. Needs one listen to confirm, but the code path is unambiguous.

None of these are content problems. They are craft-layer problems in exactly the layer `DESIGN-CRITIQUE.md` §5 says nobody had a seat for. I am taking that seat.

---

## 1 · Q1 verdict — neither A nor B. Split `n2` into two beats.

The operator is right that something is wrong and wrong about what it is. The length is not the problem; `n2` is not too long at nine words. The problem is that **`n2` is one caption doing three jobs, and a caption is an indivisible visual object.** Whatever is on screen when the button appears reads as "the thing." Right now that is nine words, of which two are the target.

Option A (fewer beats) throws away the only modelling the frame ever gets. Option B (a stem card) is worse: it imports the register of a worksheet into the one screen whose entire claim is *this is a person*. The moment a learner sees `Sem ___.` in a box separated from the character's speech, the character becomes a delivery mechanism for exercises, and every subsequent beat is read as an exercise. That is not a cost, it is the end of the format.

The third option costs one authored beat and no new UI: **make the frame its own caption, and delete the hand-over words.**

- `n2a` — *"Me veseli!"* — gloss after. Caption clears.
- `n2b` — *"Sem Slavko."* — caption shows **two words**. Then silence. Then the button.

*(Slovene is a suggestion only — goes to the author agent and its critic.)*

What the learner sees at the instant their turn opens is `Sem Slavko.` — the target frame with the slot already filled by a name that is not theirs. The substitution is visible without one word of instructional language. `Zdaj pa še ti` disappears entirely, replaced by the thing it was trying to say: a pause and an offered turn. The load asymmetry goes from 9-heard/2-produced to 2-heard/2-produced. Beat 32 is honoured — the target stays on screen while producing it — and beat 65's gloss-after budget is untouched.

This also fixes a mismatch nobody has flagged: the catalog learnable is `sem_ime` = `Sem ___.`, and the scene currently models `Jaz sem Slavko.` The thing we teach and the thing we model are not the same string.

---

## 2 · Q2 verdict — it survives. Three things break, in this order.

The format holds as the primary mode, and it should be the primary mode, because it is the only surface in this app where the learner's mouth is the interface. Everything else is a reading app with audio.

**What breaks first is the ending, not the middle.** `sceneFinish()` calls `openHome()`. The run ends on *"Pridi spet kdaj!"* — a person inviting you back — and the next frame is a wordmark, a tagline, and four emoji tiles including **📊 A1 Readiness**. Sixty seconds of engineered wordlessness, then a dashboard. Beat 132's withheld list is violated in a single screen transition. This is the format's actual failure mode at scale: the scene is airtight and it exits into the app.

**Second: authoring cost per second of experience.** Session 1 is five nodes, four audio clips, one delivery variant, one slow variant, a stall ladder, and a gated author-plus-critic pass — for about 55 usable seconds. The tap-through trees get 16–52 nodes per level because taps are cheap. If spoken scenes are primary, the content pipeline has to sustain roughly 60–90 authored seconds per session, and the fifth session in my plan needs branching. That is a production-economics problem, not a design one, but it is the one that kills the format if unaddressed.

**Third, and only later: the format has no vocabulary for "again."** It is superb at first contact and has no built move for the fourth encounter with the same frame. Session 4 in my plan is where that has to be invented.

The crediting contradiction (§6a) is *not* on this list. It is a copywriting problem, resolved below.

---

## 3 · The five-session plan

### The resolution to §6a, first, because everything hangs off it

The betrayal risk is manufactured entirely by one line of English UI copy: **"Nobody hears this but you."** That is a *privacy* promise. It is unnecessary, unreviewed (invariant 6 doesn't cover English), and it forecloses the whole curriculum. What the panel actually wanted named — A5's insight — is not privacy. It is **unfailability**: an adult's fear that their mouth will fail in front of something that is evaluating it.

Promise the thing you can keep forever. Suggested replacement, sessions 1–5, never changing:

> **"However it comes out is fine."**

Now nothing has to be retracted. The audio can start uploading at session 3 and **the contract on screen is identical**, because invariant 3 already forbids showing the transcript and invariant 4 already forbids showing a score. Judged and failable are different properties. Make failure a server-side no-op with **zero on-screen representation** — a miss produces one in-character recast at most (beat 115), which is a thing a person does, not a thing a grader does. The learner never experiences a contract change because there is nothing to experience.

One honesty note the panel should hold: **the scene already credits.** `POST /api/scene` plants `c2`'s `sem_ime` as an attempt on button-release, from audio nobody inspected. Invariant 2 says exposure credits nothing. We are already banking unwitnessed attempts. I would keep that and stop calling the scene uncredited.

### Session 1 — **Meeting** · ~55s · new: 1 frame

- **Hears:** on-ramp (2 lines, see §5) → `Živjo! Kako ti je ime?` → their own name → *"Me veseli!"* → *"Sem Slavko."* → silence → their turn → close.
- **Sees:** Slavko, present and looking out, from frame one. Caption at `n1` Slovene-only after a 3.5s hold. At `n2b`, two words.
- **Says:** their name; then `Sem ___.`
- **App records:** `sem_ime` as an attempt. Nothing else. Recording is kept **on device** for the replay strip, never uploaded.
- **Scaffolds:** all present. Stall ladder re-timed to **+4.5 / +7 / +11s**.
- **Close:** four own-voice cards in spoken order, no English (beats 125–130). Then Slavko says one short Slovene line, unglossed, that the learner does not understand. That line is the hook.

### Session 2 — **Returning** · ~75s · new: 1 frame

The first fifteen seconds carry the whole session's weight.

- **0:00** No on-ramp. The three English lines are a first-run asset and never appear again.
- **0:01** Scene, room tone, Slavko already looking at you.
- **0:03** He says **your name**, then greets you. No caption for the greeting (beat 140). The world remembered you.
- **0:07** He says *"Sem Slavko."* again — unprompted, as part of the greeting, not as a test. **This is how "that's on us" is kept mechanically:** we never ask them to recall something we have not just re-supplied. Forgetting is pre-empted, not diagnosed.
- **0:12** New ask, same frame, new slot: *"Od kod si?"* → `Sem iz ___.` *(suggestion)*.
- **App records:** two attempts. Still no uploads.
- **The rule that makes forgetting cost nothing:** every withdrawn scaffold is **re-armed the instant a stall rung fires**. Withdrawal is a default, never a lock. That is the whole of "if you forget, that's on us," expressed as engine behaviour rather than copy.

### Session 3 — **The cut** · ~110s · new: 1 frame + `Ne razumem`

Audio begins uploading mid-session, at a beat the learner has already produced twice (the `Sem ___.` re-ask). No transition, no label, no navigation — beat 107's invisible cut. The engineered too-fast line lands here and `Ne razumem` appears unglossed above the button (beats 93–105). **Successes begin.** Screen state, button copy, and haptics are byte-identical to session 1.

### Session 4 — **Composition** · ~2:30 · new: 1 noun, 0 frames

The complication (beats 142–147): the owned line does not fit. Slavko supplies one noun into a frame they already hold, and they swap a slot nobody told them was a slot. This is the session that answers "what is the fourth encounter with the same frame" — it is not repetition, it is the frame **failing** and then bending. Branching enters here: `next[1..n]` as previewable alternates beside the mic (beats 83–89, tapping previews, speaking advances).

### Session 5 — **The street** · ~3:00

The scene ends by **pulling back** rather than cutting out. The camera leaves Slavko and finds a street of places, some lit (beats 161–171). Two doors are lit: the one behind you, and one more. The replay strip is now 8–10 own-voice cards, one marked *"you made this one up."* This is the only "progress" statement in five sessions and it names a capability, not a quantity.

### §6b — where the other surfaces go

- **Rehearsal dialogues:** not dead, not a phase. They become **the interior of a lit door** — you walk into the bakery on the street and Slavko shows you the transaction before you ever speak it. Tap-through is the right surface for *watching* and the wrong surface for *first contact*, which is exactly the panel's 11–0 finding. The framing already exists in `docs/rehearsal-dialogues.md`: the `client` lines are Slavko's, not yours.
- **Free chat:** **not a destination.** It is what the back half of every scene silently becomes from session 3. Delete the "💬 Live AI tutor" tile.
- **A1 Readiness:** dead as a screen, alive as data. `/api/a1`'s mastered counts decide **which doors are lit**. Nobody reads a coverage table; everybody reads a street.

### §6c — session shape

55s → 75s → 110s → 2:30 → 3:00. The growth axis is **the number of the learner's own turns** (2 → 3 → 4 → 5 → 6), not line length and not new items. Item budget stays at 1 novel frame per session through session 4, per A10's evidence-based cap.

### §6d — scaffold withdrawal schedule

| Scaffold | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| English on-ramp | 2 lines | — | — | — | — |
| Slovene caption, new material | always | always | always | always | always |
| Slovene caption, known material | n/a | **gone** | gone | gone | gone |
| Silent hold before caption | 3.5s | 2.5s | 1.5s | 1.5s | 1.2s |
| Chunked-slow re-speak | every npc beat | new material only | new material only | on stall only | on stall only |
| English gloss | after `n2a`, `n3` | 1 per session | 1 per session | 0 | 0 |
| Button copy | full | full | full | glyph + copy on stall | glyph only |
| Stall ladder | +4.5/7/11s | same | same | same | same |

The stall ladder is the one thing that **never** withdraws, in any session, ever. It is the mechanism that makes every other withdrawal safe.

### §6f — the return loop, with no numbers

Three hooks, none measurable:

1. **The unglossed closing line.** Each session ends with one Slovene line you do not understand. The next session opens with it comprehensible. Zeigarnik, zero measurement, and it makes session N+1 *about* session N without a recap screen.
2. **He remembers something specific.** Not "welcome back" — your name in session 2, where you're from in session 3. A person who was curious about you yesterday is a reason to open an app. This is why the first-meeting frame beat the café, and it is a renewable resource.
3. **The street is visibly finite and visibly closing.** Session 3 differs from session 2 because one more door has light in it, and there is a countable number of doors. That is A1 rendered as somewhere to go.

---

## 4 · My one strongest disagreement

**`sceneFinish()` calling `openHome()`** (`public/app.js:891`).

Not the missing street — the brief already lists that as unbuilt. I mean the *built decision* to route out of a wordless immersive scene into a tile grid containing a bar-chart emoji labelled "A1 Readiness." Sixty seconds of the most disciplined withholding I have seen in a consumer onboarding, ending in the app's least disciplined screen. Every principle the panel established — no menu, no measure, no label, diegetic reward, no screen boundary since second three — is undone in one `showScreen("home")`.

Until the street exists, `sceneFinish` should end on the **replay strip and nothing else**: four own-voice cards, one line naming what happened as an event, one small affordance. If the learner closes the app there, the run ended correctly (beat 136). A stub street of two doors is cheaper to build than most of what is already built, and it is load-bearing in a way the tile grid is actively harmful.

---

## 5 · What I would cut

1. **The four-tile home screen**, for scene users. Two doors on a street replaces all four tiles.
2. **"Nobody hears this but you."** Replaced by "However it comes out is fine." It is a promise we cannot keep past session 3 and never needed to make.
3. **"Zdaj pa še ti"** — three words asking the beginner to parse pragmatics they do not have. A silence does the same job and cannot be misread.
4. **On-ramp line 2, "Just listen — nothing to do yet."** It is contradicted twelve seconds later, and it spends 700ms of the 3.8s ramp telling a passive user to be passive. Cut it, promote line 3 to 19px, and the on-ramp lands at ~3.1s with the only line that matters actually legible.
5. **The "↺ Replays" tile.** Playing back what *the tutor* said inverts the design's best idea. What earns a replay is the learner's own voice, and that belongs in the session close, not a menu.
6. **`glossPolicy: "tap"` as the default.** There is no ▶, no tap target, and no affordance on `.scene-caption` — the branch in `scenePlayBeat` sets an `onclick` on a bare `<p>` that is never cleared between beats. Either build beat 66's ▶ or delete the policy.

---

*One craft item that is not a cut but should not be lost: `wireSceneMic` releases on `pointerleave` with no `setPointerCapture`. A thumb sliding off a button that scales to 1.12× while the user is speaking will end their turn mid-word and advance the scene. For a learner who is already frightened of their own mouth, that is the worst possible failure, and it is four lines to fix.*
