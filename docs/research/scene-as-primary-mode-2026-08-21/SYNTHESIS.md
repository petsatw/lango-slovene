# The spoken scene as primary mode — panel synthesis

**Brief:** `.scratch/2026-08-21-panel-brief-onboarding-as-primary-mode.md`
**Panel:** UX designer · adult-L2 A1 instructor · game designer · systems skeptic (four independent reads,
no cross-talk) · **Date:** 2026-08-21 · **Branch:** `feat/onboarding-scene-surface`

Full responses: [PANEL-UX.md](PANEL-UX.md) · [PANEL-INSTRUCTOR.md](PANEL-INSTRUCTOR.md) ·
[PANEL-GAME-DESIGN.md](PANEL-GAME-DESIGN.md) · [PANEL-SYSTEMS.md](PANEL-SYSTEMS.md)

This synthesis names where the four agree, where they genuinely split, and — first — the defects they
found in the build that are true regardless of which design direction wins. Every claim in §1 was
re-verified against the code by the orchestrator; the file:line references are checked.

---

## 1 · Verified defects — true independent of any design decision

These are not recommendations. They are facts about the current build, confirmed in code.

### 1.1 The stall ladder fires ~11 seconds late (found by UX, verified)

`ATOMIC-EXPERIENCE-MAP.md` beats 43–45 list stall handlers at **0:15.5 / 0:18.0 / 0:22.0 as absolute
clock times**, in a run where the button appears at **0:11.5** (beat 33). The design intent is therefore
**+4.5s / +7s / +11s after the button appears**.

`slavko-intro-1.json` carries `afterMs: 15500 / 18000 / 22000`, and `sceneArmStalls`
([app.js:775](../../../public/app.js#L775)) starts those timers **at button-arm**. The absolute
timestamps were transcribed as relative offsets.

**Effect:** a learner who freezes at `n1` receives no help of any kind for 15.5 seconds, and the bar does
not lower until 22 seconds — roughly 35 seconds into the run, facing a breathing circle on a black
screen. A large part of what the operator perceives as "too long" is dead air that was never designed.

**This is the single highest-value fix on the page.** It is a data change in one JSON file.

### 1.2 Completing the scene permanently closes the scene *and* kills the seed (found by systems, verified)

`started` is derived as `Object.keys(learner.load().learnables).length > 0`
([server.ts:118](../../../server/server.ts#L118)). The scene's `c2` node plants `sem_ime` as an attempt
([dialogue-scripted.ts:79-80](../../../server/adapters/dialogue-scripted.ts#L79-L80),
[server.ts:152](../../../server/server.ts#L152)). So finishing session 1 flips `started` to true, and:

- [app.js:1149](../../../public/app.js#L1149) never auto-opens the scene again — it is reachable only via
  the `?scene=` query param.
- [app.js:638](../../../public/app.js#L638) routes past `enterSeed()` forever, deleting the 13-step
  cold-start seed (12 learnables, including the repair phrases) that `docs/free-conversation.md` §6 calls
  load-bearing.

### 1.3 Reuse of a mastered learnable *demotes* it (found by systems + orchestrator independently, verified)

[mastery.ts:49-54](../../../server/mastery.ts#L49-L54): an `attempt` on an already-mastered learnable is
treated as a flub and decrements `successes`. Scene beats always plant `attempt`. So once `sem_ime` is
mastered in free chat, any spoken scene touching it knocks the learner back to 4/5 — a surface that
judges nothing, quietly punishing the learner model. Invisible today (one scene, one-shot); fatal once
scenes are the primary mode and reuse is the point.

### 1.4 One planted attempt flips free chat out of bootstrap mode (found by systems, verified)

[mastery.ts:187](../../../server/mastery.ts#L187): `introduce = level >= 2 || familiar.length === 0`. One
planted attempt makes `familiar.length === 1`, so level-1 free chat stops introducing new items.
[mastery.ts:190](../../../server/mastery.ts#L190) draws `newItems` from `!model.learnables[l.id]`, so
**anything a scene touches is permanently excluded from ever being offered as a fresh item** — while
`/api/a1` reports it as `"attempted"` on the coverage map. Invariant 4 says progress is a finite map; a
map lit by exposure is a lying map.

### 1.5 The authoring engine cannot author scene #2 (found by systems, verified)

`create-dialogue/SKILL.md` has drifted out of sync with the runtime schema in exactly the fields the
spoken format depends on:

| field | SKILL.md says | runtime requires |
|---|---|---|
| `stallHandlers` | `[{afterMs, sl, en, deliverySL?}]`, "LS writes the lines" ([:57](../../../.claude/skills/create-dialogue/SKILL.md#L57)) | `[{afterMs, kind: "pulse"\|"respeak"\|"soften", label?}]`, **no Slovene at all** ([dialogues.ts:266](../../../server/dialogues.ts#L266)) |
| `deliverySlowSL` | not mentioned (0 occurrences) | exists because two authored "slow" lines came back at 1.00× and 0.92× natural |
| `frameEN` | not mentioned (0 occurrences) | the English on-ramp — "what earns the right to withhold English" |

A gated pipeline run today produces a dialogue the loader **rejects**. Sessions 2–5 cannot be authored
through the engine without hand-patching three fields — which is precisely the freehand failure mode the
engine exists to prevent. **Shortest fuse on the page: this blocks all content work regardless of which
design wins.**

### 1.6 Smaller, all verified

- **The backchannel is cut off ~50ms in.** On release, `sceneSay(scene.backchannel)` fires unawaited;
  `sceneStep` awaits one local fetch, then `scenePlayBeat` calls `sceneSay(npc.sl)` whose first statement
  is `stopDialogueAudio()`. Beat 55 — the panel's best latency idea — is killed by beat 60.
- **`pointerleave` releases with no `setPointerCapture`** ([app.js:939](../../../public/app.js#L939)). A
  thumb sliding off a button that scales to 1.045× mid-sentence ends the turn and advances the scene.
  For a learner frightened of their own mouth this is the worst available failure. ~4 lines to fix.
- **The on-ramp is 3.82s, not 3.0s** (3×700 + 1100 + 620), and its most important line — *"If you forget
  something, that's on us."* — is rendered smallest and dimmest at 15px `var(--muted)`
  ([styles.css:609](../../../public/styles.css#L609)). The no-blame contract is styled as a footnote.
- **We model a string we do not teach.** The catalog learnable is `sem_ime` = `Sem ___.`; `n2` models
  `Jaz sem Slavko.`
- **Register mismatch in the catalog.** The scene declares `register.form: "ti"` and says *Kako **ti** je
  ime?*, but the personal-identity questions are stored in vikanje: `kako_ime` = *Kako **vam** je ime?*,
  `od_kod_ste`, `kje_zivite`, `koliko_star`. Any session touching these hits it immediately. Needs an
  author/critic decision: separate mintings, or citation forms with register as a variant?
- **`glossPolicy: "tap"` is unreachable.** The branch sets `onclick` on a bare `<p>` with no affordance,
  no ▶, and never clears it between beats.

---

## 2 · Q1 — is this the right shape for the first ninety seconds?

**All four reject both A and B.** Nobody defended "simplify the dialogue"; nobody accepted the stem card.
The stated reason is identical across all four: `n2` is the only place the target frame is modelled
(killing A), and a separate "your target" panel converts the character into a delivery mechanism for
exercises, permanently, in the beat where the learner decides whether this app is school (killing B).

**The operator's instinct is judged half-right by all four, and mis-located.** The instructor counts ~22
words of Slovene — 8–9 seconds — inside a 27.7-second run: *more than half of session 1 is silence and
English*. The game designer: "a player will sit through a two-minute cinematic; they will not sit through
eleven seconds of a screen that has never once responded to them." **The duration is not the problem;
what the duration is spent on is.** Keep ~90 seconds, cut the dead air, raise the Slovene.

They then split three ways on the remedy:

| | proposal | mechanism | cost |
|---|---|---|---|
| **UX** | **Split `n2` into two beats.** `n2a` *"Me veseli!"* (gloss, caption clears) → `n2b` *"Sem Slavko."* — caption shows **two words** — silence — button. | The target frame with a slot filled by a name that is not yours. Substitution visible with zero instructional language. Load goes 9-heard/2-produced → **2-heard/2-produced**. | One authored beat, one extra clip. Deletes `Zdaj pa še ti` entirely. |
| **Game design** | **The caption contracts, it does not split.** At button-appear, the nine words dim to near-black in place; `Sem ___.` stays at full luminance, same line, same position. | Teaches one rule in one beat that then does free work forever: **the bright text is your turn.** Nothing added to screen, nothing labelled. | Pure rendering. No new audio, no new authoring. |
| **Instructor** | **Fix the echo *target*, not the echo.** Session 1's production target becomes `Živjo` — one word, already in the catalog, already heard twice, at utterance-head where recall is strongest. `Sem ___.` becomes session 2's entire subject. | Echoing is the correct hour-zero act; what adults fail at is *locating* the target in an unparseable stream. Shorten the utterance until the whole caption **is** the target. | `c2` leaves session 1. |

**These three are compatible, not competing.** The caption contraction (game design) is the cheapest and
is a rendering rule; the `n2` split (UX) is a content change that makes contraction almost unnecessary;
the target swap (instructor) is a curriculum change. Doing all three yields: session 1 targets `Živjo`,
`n2` splits, and the contraction rule renders whatever the target is.

**The instructor answered the brief's direct question head-on:** yes, echoing a modelled frame *is* the
right first production task for an adult at hour zero — the taxonomy already says A1 production is
unanalysed formulaic chunks. But **no**, the bare name at `c1` should not carry the whole first session,
for a reason the brief missed: `c1` has `learnables: []` — **a bare name is not Slovene.** A learner who
finishes session 1 having produced only their own name has had a first Slovene *listening* lesson.

---

## 3 · Q2 — does it survive as the primary mode?

**All four say yes — the format survives.** The game designer goes furthest ("the strongest surface in
this repo by a wide margin; the other three should be subordinated to it"). The UX seat gives the
sharpest reason: *it is the only surface in this app where the learner's mouth is the interface;
everything else is a reading app with audio.*

**What breaks first — four different answers, and they are all correct at different layers:**

1. **Systems (nearest-term, hardest evidence):** the plumbing. `LearnerModel` is `{learnables, updatedAt}`
   and nothing else. **There is no session cursor, no per-scene completion record, and no per-learnable
   timestamp.** Session 2 is not "unbuilt content" — it is *unrepresentable in the current model*. Plus
   §1.2–1.4 above.
2. **UX:** the *ending*, not the middle. `sceneFinish()` → `openHome()` — sixty seconds of the most
   disciplined withholding in the build, exiting into a tile grid containing a bar-chart emoji labelled
   "A1 Readiness." The scene is airtight and it exits into the app.
3. **Instructor:** arithmetic and retrieval. 245 × 5 = **1,225 credited productions** to finish A1; the
   scene credits zero. Worse, **an authored linear spine cannot do spaced retrieval** — it can re-run the
   same lines (recognition, which inflates confidence without moving memory) or introduce new ones (not
   retrieval at all). It has no access to the learner model.
4. **Game design:** unfailability curdles. Session 1's safety comes from *nobody is listening*. By
   session 3 an adult starts to suspect the app is not listening, and **they are correct** — at which
   point every warm beat retroactively reads as theatre. *"The threat to this design is not fear. It is
   the discovery that nothing you do matters."*

**Content economics is named by three of four** (game design, systems, UX) as the constraint that decides
whether the format is viable. The systems ledger, from repo numbers: audio is **not** the binding
constraint (~10–14 clips/session, ~500–700 for fifty sessions, roughly doubling the 518 mp3s on disk —
content-addressed and idempotent). **Images are worse** (161 today, scene ships `background: undefined`,
and a character who is *present* implies pose/expression states the asset model has no notion of —
`characters.json` "owns no pixels"). **Room tone is a class of asset the pipeline cannot produce at all**
— the store knows `"audio"` and `"image"`, and every audio path routes through TTS. Ambience is a new
adapter, not a new prompt. **The real bottleneck is authoring** (§1.5).

The game designer draws the design conclusion: **the authored part must stay ~5–7 beats forever and the
unscripted tail must grow.** "Any plan whose sessions get longer by adding authored beats is dead by
session 4."

---

## 4 · §6a — the crediting contradiction

**This is the panel's most important convergence, and it arrived from four different directions:
the brief's dilemma is false.** Nobody proposed a session at which the contract flips.

- **Instructor:** *the safe space is a place, not a phase.* Slavko never judges — ever, permanently. The
  promise was made by a specific character in a specific room and holds in that room forever. Judged
  production begins the first time you walk into a **different place** and speak to a **different
  person**. Nothing is revoked; somewhere new is entered.
- **Game design:** identical rule, stated as a world-fact — *"Slavko never listens. Everyone else does."*
  The learner discovers this when a second voice enters and responds to what they actually said.
- **UX:** the betrayal risk is manufactured by **one line of English UI copy**. *"Nobody hears this but
  you"* is a **privacy** promise. What the design actually needs to promise is **unfailability**. Judged
  and failable are different properties — invariant 3 already forbids showing the transcript, invariant 4
  already forbids showing a score. Make failure a server-side no-op with **zero on-screen
  representation**, and the learner never experiences a contract change because there is nothing to
  experience.
- **Systems:** the same conclusion, reached architecturally — and it goes furthest.

**The line is the problem.** `"Nobody hears this but you."` is static markup at
[index.html:83](../../../public/index.html#L83) — a **product-wide** guarantee rendered on every scene
turn, not a line scoped to a character. Three of four panelists independently want it changed. They
differ on the replacement: game design wants it in Slavko's voice (*"I'm not listening. Say it however."*)
to scope the promise correctly forever; UX wants it to promise unfailability instead (*"However it comes
out is fine."*) so nothing ever needs retracting. Both work. Note this line is authored design — atomic
map beat 33 — so changing it is a deliberate revision, not a bug fix. It is English UI copy, outside
invariant 6.

### The one real fight on this page

**Systems says: delete crediting from the scene entirely.** *"The scene must never credit anything. Not in
session 1, not in session 5, not ever."* An attempt with no success is a no-op on every axis that matters
**except** the three harms in §1.2–1.4 — so it is pure downside. And the correct seam already exists and
is unused: `selectForWitness(model, level, focusIds)`
([mastery.ts:213](../../../server/mastery.ts#L213)) already force-includes a focus set in `targets` even
for items the learner has never touched — the comment says so explicitly. **The scene should write a
record of learnables *encountered*, hand it to free chat as `focusIds`, and touch `model.learnables`
never.** `creditFromEvidence` stays the only place a success is minted.

**UX says: keep it, and stop lying about it.** *"The scene already credits. Invariant 2 says exposure
credits nothing. We are already banking unwitnessed attempts. I would keep that and stop calling the
scene uncredited."*

**Assessment:** UX is right about the honesty problem and did not have the systems evidence. The systems
seat has the stronger case — it names four concrete harms (§1.2, §1.3, §1.4, and the lying A1 map) and
zero benefits, and it identifies an existing, documented, unused seam that does the intended job
properly. **Recommend the systems resolution.** UX's point survives as a documentation fix: whatever is
decided, the code comment at [server.ts:128](../../../server/server.ts#L128) claiming the scene "credits
nothing" must match what it does.

**Minimum guard, whichever way it goes:** `applyCredit` must not decrement on a rehearsal-sourced
attempt. Losing mastery for turning up is indefensible.

---

## 5 · §6b–f — the five-session plan

### Where all four converge

- **Session length grows, and the growth axis is the number of the learner's own turns** — not longer
  lines, not more new items. (UX: 2→3→4→5→6. Instructor: 2→3→5→6→8. Game design: authored beats stay
  flat at 5–7, the live tail grows 0%→75%.) Nobody proposed growing sessions by adding authored content.
- **~1 novel frame per session** through session 4 (UX and instructor independently).
- **The English on-ramp dies after session 1 or 2.** All four.
- **The Slovene caption never fully withdraws.** Instructor's reason is the strongest: paired text *is*
  the Reading mode; delete the caption and you delete a skill mode from a three-mode product.
- **No recap screen in session 2.** All four, emphatically. A summary consumed before a retrieval attempt
  destroys the retrieval attempt.
- **Rehearsal dialogues survive as the interior of a place you have already been** — worked examples,
  never first contact. **Free chat is not a destination** — it is what the back half of a scene silently
  becomes. **A1 Readiness dies as a screen and lives as data** deciding which doors are lit. Three of
  four say this in nearly identical words; the instructor alone keeps A1 Readiness as "the street itself,"
  which is the same data with a different name.

### §6e — returning, where the panel is at its best

Three independent, mutually compatible mechanisms for "you forgot and it's on us":

1. **Instructor — token-identical repetition.** Slavko re-greets with the *exact same line*, same audio,
   same delivery. Designers vary the opener for freshness; that is a mistake here — identical repetition
   is what makes an episodic trace retrievable at 24 hours. The learner's turn then arrives **with no
   model**: the cold demand. Most produce `Živjo`, and *that success is the entire emotional payload of
   session 2.* The one who has forgotten hits a stall rung whose first rung is now **the model, not a
   pulse** — Slavko simply says the word again, to himself, unremarked. **Both learners reach the next
   beat at the same moment with no acknowledgement of which path they took.** That is the promise
   implemented rather than asserted.
2. **Game design / UX — pre-supply, never diagnose.** He re-introduces himself unprompted as part of the
   greeting: *"Sem Slavko."* We never ask them to recall something we have not just re-supplied.
   Forgetting is pre-empted, not detected.
3. **UX — withdrawal is a default, never a lock.** Every withdrawn scaffold is **re-armed the instant a
   stall rung fires.** This is the cleanest engine-level expression of the promise on the page.

### §6f — the return loop with no numbers (game design's section, with UX converging)

Both reject stakes and land on **consequence**: irreversible, non-punitive changes to a world that
persists. Game design's framing — *"a game with no fail state has no stakes; what replaces stakes is
consequence"* — and its four sources are all already latent in the repo:

1. **The world remembers you.** Slavko uses your name from session 2 forever. UX: *"a person who was
   curious about you yesterday is a reason to open an app — and it is a renewable resource."*
2. **The street is finite and visibly closing.** Three door states, no numbers: **dark** (never been),
   **lit** (been), **warm** (someone there knows you). Warm does the retention work because it is a claim
   about a relationship rather than about you. A door lights *in front of the learner as they leave*.
3. **The replay strip** — cards in the learner's own voice, in spoken order, no English, no count. The
   only thing that accumulates, and it accumulates as **evidence rather than quantity**. Requires §6.
4. **Slavko's rota** (game design) — he moves; where he is next session is the strongest curiosity hook
   available under invariant 4, and costs nothing but authoring placement.
5. **The unglossed closing line** (UX) — every session ends with one Slovene line you do not understand;
   the next session opens with it comprehensible. Zeigarnik, zero measurement, and it makes session N+1
   *about* session N without a recap screen.

**What makes session 3 differ from session 2** is not more content: *the room stops being a room.* A
voice that is not Slavko's, that you are not expected to understand — then a voice that answers what you
actually said. **S2 is intimacy; S3 is exposure.**

### The genuine disagreements — do not paper over these

| question | positions |
|---|---|
| **Silent hold before caption** | Instructor: **lengthens** 3.5→5s — retrieval-before-display is the learning event, and tolerance for silence grows with confidence. UX: **shortens** 3.5→1.2s — the hold is a comprehension scaffold and withdraws like the rest. Game design: **2.2s in S1, then grows** — it is a tension beat, not a scaffold, and session 1 has not yet earned the learner's trust in silence. |
| **Stall ladder timing** | Instructor: **first rung at 6s** — productive wait for adult L2 production is 6–8s; 15.5s is long enough for embarrassment to arrive and displace recall. Game design: **raise to 22s by S3** — by then a learner who pauses is thinking, not stuck, and the ladder punishes thought. UX: **+4.5/7/11s, and never withdraws in any session** — it is the mechanism that makes every other withdrawal safe. *(These are less far apart than they look: all three agree the current absolute timing is wrong; §1.1 shows it is a transcription bug, and UX's numbers are the design's original intent.)* |
| **The soften rung** | Systems would **cut it** — it is English arriving on a control at the exact second the learner decides whether they are the kind of person who does this, and it names a failure nothing else names. Everyone else keeps it. |
| **Session 3's content** | Instructor: **repair phrases before content vocabulary**, non-negotiable — a learner without `Ne razumem` has exactly one move when input outruns them, and it is to leave. Game design and UX both put the live-mic cut at session 3 instead. *These are compatible only if repair is owned before the first judged turn* — which is the instructor's own stated precondition. |
| **A1 Readiness** | Three say kill the screen. Instructor keeps it as the street. Same data, different framing. |

### The instructor's A1 sequencing (the only seat that produced one)

Grounded in the catalog; every id verified to exist.

| | introduced | learner produces | recorded |
|---|---|---|---|
| **1** First contact | `zivjo` | `Živjo` (echo) · own name | attempt |
| **2** The name frame | `sem_ime`, `me_veseli` | `Živjo` **cold** · `Sem ___.` (echo) | attempts |
| **3** Repair | `ne_razumem`, `se_enkrat`, `pocasi_prosim` | all three, echo→cold within session | attempts |
| **4** Where you're from | `sem_iz`, `zivim_v` | `Sem iz ___.` · `Živim v ___.` · s1–3 cold | attempts |
| **5** First place | `dober_dan`, `prosim`, `hvala`, `eno_femacc`, `kava` | the transaction, **judged** | **first successes** |

Sessions 1–2 sit in `personal_relations` + `personal_identity` — where a beginner can be a *person*
before a customer. Session 4 introduces the first morphosyntactic contrast (`iz` + gen vs `v` + loc) as
two unanalysed frames, no explanation, ever, at A1. Session 5 reuses the seed's existing `Eno kavo,
prosim.` so the audio and catalog entries already exist. By session 5: **four A1 can-do statements.**

Two preconditions the instructor sets for the first judged turn, both of which make it safe by
construction: every item judged has already been produced **unjudged at least twice**, and repair phrases
are owned **before** entering a judged place.

**Input-to-output ratio:** ~10:1 heard-to-produced at session 1 → ~4:1 by session 5. Below 3:1 starves
comprehension.

---

## 6 · §5 — what the missing art must do

The game designer's framing is the useful one: **this is not a polish gap, it is a missing systems
object**, and two mechanics are structurally unbuilt without it.

- **The portrait supplies the wait.** Beat 22: *"waiting is their posture, and the wait reads as
  attentive rather than empty."* The silent hold at 0:05–0:08.5 is currently a black screen with nothing
  in it, which reads as **a hang, not a person**. Cheapest sufficient version: 2–3 frames, a blink, a
  weight shift, eyeline staying on the player. **The face is the load-bearing element of the entire
  unfailable premise** — "nobody is grading you" is a claim the copy makes and only a patient face can
  prove.
- **The portrait carries the turn, redundantly.** Slavko speaking → animate, eyeline out. Finished →
  stillness plus a small open-handed gesture toward the player. **That gesture *is* `Zdaj pa še ti`, in a
  channel a beginner can parse on day one** — which is why three panelists are comfortable deleting the
  words.
- **Room tone makes the silence populated.** An empty silence is a bug report; an ambient silence is a
  person waiting. It must **duck ~6dB while the learner holds the button** (beat 50) — the world
  quieting to listen is the clearest non-verbal signal that speaking matters, and it costs one gain
  envelope. Note §3: the pipeline **cannot currently produce ambience at all**.
- **Register warning:** per the repo's style note, Slavko must not render old-town-traditional by
  default. He is a dragon and a companion; what has to land in three seconds is *warm, present,
  unhurried, not a museum.*

- **Own-voice playback (game design's strongest disagreement).** `wireSceneMic`'s release handler
  discards the buffer. **Not-uploaded and not-kept are different properties.** Discarding buys nothing
  that keeping it client-side does not also buy, and it costs the design its only non-numeric
  proof-of-progress artifact — beat 57, beat 129's replay cards, and all accrual in §5.3 above. Keep the
  blob on device, play 0.6s back at beat 57, never send it. Invariant 3 untouched (there is no
  transcript). Invariant 5 untouched (playback is not judgment).

---

## 7 · The five strongest disagreements, one per seat

- **UX — `sceneFinish()` calling `openHome()`** ([app.js:891](../../../public/app.js#L891)). Not the
  missing street; the *built decision* to route out of a wordless immersive scene into a tile grid with a
  bar-chart emoji. Every principle the prior panel established — no menu, no measure, no label, no screen
  boundary since second three — undone in one `showScreen("home")`. Until the street exists, end on the
  **replay strip and nothing else**.
- **Instructor — the on-ramp line *"Just listen — nothing to do yet."*** It tells an adult, in English,
  that the first Slovene they will ever hear is not their responsibility — thirteen seconds before they
  are asked to draw on exactly that material. *"It buys a moment of relaxation and spends a retrieval
  trace."* Adults do not need permission to disengage; they need to know **what to listen for**.
- **Game design — the release handler discards the recording** (see §6).
- **Systems — `c2` carrying `learnables: ["sem_ime"]`.** Every harm in §1.2–1.4 traces to that one array.
  *"It is a line of data written to make the scene feel like it counted. Invariant 2 says exposure
  credits nothing; this is exposure crediting something and calling it 'attempts' so the invariant reads
  as intact."*
- **Orchestrator — §1.1, the stall ladder transcription error.** Not a design decision at all, which is
  why it went unnoticed: the operator's "too long" complaint is partly a bug report against a timing
  nobody chose.

---

## 8 · The union of cuts

**Named by more than one seat:**

- **On-ramp line 2** (*"Just listen — nothing to do yet"*) — UX, instructor, game design. Contradicted
  twelve seconds later; installs passivity in the window where the design needs leaning-in.
- **`Zdaj pa še ti`** — UX, instructor(-adjacent), game design. Three words asking a beginner to parse
  pragmatics they do not have. A silence and an offered turn cannot be misread.
- **The four-tile home / A1 Readiness screen / the Replays tile** — UX, game design. *"A coverage bar
  wearing a jacket"* — the one place invariant 4 is technically honoured and spiritually broken. The
  Replays tile inverts the design's best idea: what earns a replay is **the learner's own voice**.
- **`glossPolicy: "tap"`** — UX, game design. Unreachable in practice (§1.6) and it makes English a thing
  you can go shopping for; beat 71's "no hint used, no penalty" only reads as generous if English is not
  fetchable.
- **`"Nobody hears this but you."`** — UX, game design (rescope vs replace; §4).

**Single-seat, worth keeping on the list:**

- `c2` out of session 1 (instructor) · `learnableProgress` from the audio path (systems) · `slowSL` on
  `n2` — re-modelling all nine words when two are the target makes the asymmetry *worse* and costs a
  billed clip (systems) · the `soften` rung (systems) · on-ramp lines 2 **and** 3, with line 3's promise
  demonstrated in S2 rather than asserted at second 2 (game design) · `pointerleave` as a release trigger
  (systems, UX).

---

## 9 · What needs the operator, not the panel

1. **§4's fight:** delete scene crediting (systems) or keep-and-relabel (UX). Recommendation above:
   systems. This is the one decision the rest of the plan hangs off.
2. **The register mismatch** (§1.6) — `ti` vs the catalog's stored vikanje forms. Needs the
   language-author and critic, not this panel, and it blocks the instructor's sessions 3–4.
3. **Art and ambience** — invariant 7 means nothing is generated without explicit instruction, and §3
   shows ambience needs a **new adapter**, not a new prompt. Scope decision, not a design one.
4. **Whether `LearnerModel` gains a session cursor and per-learnable timestamps.** Without them, session 2
   is unrepresentable (§3) and the instructor's spacing schedule (introduced in *N*, cold in *N*+1 and
   *N*+3) cannot be implemented.

**Ordering note.** §1.5 (the SKILL.md drift) gates all content work; §1.1 (stall timing) is a one-file
data fix that addresses a large share of the operator's actual complaint. Neither depends on the outcome
of any argument above.

---

*All Slovene proposed anywhere in this panel is a suggestion only and must go to the `slovenian-author`
agent and `scenario-critic` before it can ship. Panelists were instructed to prefer re-using lines
already authored in `server/dialogues/slavko-intro-1.json` and ids already present in
`server/catalog/learnables.json`; every catalog id cited was verified to exist.*
