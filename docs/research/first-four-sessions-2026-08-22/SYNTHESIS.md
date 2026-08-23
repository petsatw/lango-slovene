# The first four sessions — panel synthesis

**Brief:** `.scratch/2026-08-22-handoff-first-four-sessions-consensus.md`
**Panel:** nine independent seats, no cross-talk · **Date:** 2026-08-22 · **Branch:** `feat/onboarding-scene-surface`

Full responses: [seat-1](seat-1-speaking-tutor.md) · [seat-2](seat-2-memory-scientist.md) ·
[seat-3](seat-3-absolute-novice.md) · [seat-4](seat-4-habit-designer.md) · [seat-5](seat-5-voice-interface.md) ·
[seat-6](seat-6-systems-skeptic.md) · [seat-7](seat-7-game-designer.md) · [seat-8](seat-8-subtraction-advocate.md) ·
[seat-9](seat-9-format-contrarian.md)

---

## 0 · What the panel was and what it produced

Nine seats answered one question — lay out S1→S4 as spoken lessons for someone who has never heard a word
of Slovene, optimising engagement × confidence × simplicity, simplicity winning where they conflict. Each
returned a four-session layout (hears / sees / says / records / lit / withdrawn / pacing / handoff /
heard-produced budget) and five answers: the stepping stone, the frontier, the drop-off, what they would
cut, how we would know. The seats: **1** adult-L2 speaking tutor (sonnet) · **2** cognitive scientist,
memory & retrieval (opus) · **3** adult absolute novice (haiku) · **4** behavioural habit designer (sonnet)
· **5** voice-interface designer (sonnet) · **6** systems skeptic (opus) · **7** game designer, onboarding
& retention (sonnet) · **8** subtraction advocate, mandate to remove (opus) · **9** format contrarian,
mandate to attack the format (sonnet).

What it produced is unusual in shape. The design convergence is genuine but narrow — one novel frame per
session, and almost nothing else about *content*. The real yield is on the second axis: three seats
operating under three incompatible mandates (memory, subtraction, format-attack) independently arrived at
the same fix to the same beat, and the systems seat's headline — that S2–S4 cannot be reached by a learner
today — checks out. A significant fraction of the panel's *stated* mechanism, meanwhile, does not exist in
the build. §4 has the ledger.

---

## 1 · Consensus

### 1.1 One novel frame per session — the only near-unanimous design rule

Seats **1, 2, 4, 5, 6, 8** state it as a hard budget; seat **3** states it in the novice's own words ("I
can only absorb one new thing at a time"). Seat **5** applied it against its own draft, cutting S2's second
item for violating it. Seat **1** applied it against its own draft, cutting `ne_razumem` out of S3. Seat
**4** makes it the drop-off prevention. This is the single most robust output of the panel: **exactly one
novel frame per session, and every seat that tested its own layout against it found a violation and
removed it.**

### 1.2 Sacrifice engagement, and sacrifice it at S3

Seats **1, 2, 6, 8** name S3 as the frontier and all four sacrifice engagement there, in those words. Seat
**5** names S3 and sacrifices engagement's demand for instant comprehension. Seat **4** names S2 and
sacrifices the reciprocal exchange. Seat **7** is the lone dissent — it sacrifices a slice of
*confidence* at S3 to buy witness. Nobody sacrificed simplicity anywhere. Seats **2** and **8** independently
write near-identical sentences: confidence is never sacrificed because confidence is the only thing the
sequence is buying.

### 1.3 The S2 opener is token-identical, and pre-supply never diagnoses

Seats **1, 2, 5, 6, 8** all specify byte-identical reuse of S1's opener audio at S2. Seat **8** reaches it
from asset economics (one new clip per session), seat **2** from episodic-trace retrieval, seat **5** from
"recognition, not novelty, is the first thing S2 gives them." Seats **2, 6, 8, 9** independently restate
pre-supply-never-diagnose as the mechanism that carries the cold beat. This was already decided; the panel
did not merely accept it, four seats re-derived it from separate premises.

### 1.4 Pacing: S2 does not tighten

**S1 = `onboarding`** is unanimous among all seats that used profiles. **S2 = `onboarding`** is held by
seats **2, 4, 6, 7, 8** (five); seats **1** and **5** move to `guided` at S2. **S3 = `guided`** is held by
seats **1, 2, 4, 5, 6, 7** (six); seat **8** jumps to `brisk`. **S4** splits: `guided` (seats **2, 4, 6, 7**)
vs `brisk` (seats **1, 5, 8**). The modal mapping is therefore **onboarding · onboarding · guided ·
guided→brisk**. The reasoning for holding S2 generous is stated most sharply by seat **2** ("S2 is the
weakest session in the whole sequence — 24–72h of decay *plus* a format that is still novel") and seat
**7** ("content load must not compound with tempo change"). Seat **4** adds the general rule: withdrawal
starts when new grammar starts, not when the calendar turns.

### 1.5 The English on-ramp dies early; the Slovene caption never fully withdraws

Seats **1, 2, 4, 5, 6, 7, 8** all kill `frameEN` by S2 or S3. Nobody withdraws the Slovene caption
permanently — seats **2, 6, 8** withdraw it only on *returning* lines and keep it on novel ones; seat **7**
keeps it always ("Reading mode never fully withdraws"). Withdrawal is keyed to **novelty**, not to session
number, in seats **2, 6, 8** independently.

### 1.6 Sessions grow by learner turns, not by content

Every layout grows the learner's turn count monotonically (S1→S4: seat **2** 4→4→6→7; seat **6** 3→3→4→4;
seat **8** 2→3→4→5; seat **4** 3→4→4→5; seat **1** 3→4→4→5). Nobody grows a session by lengthening NPC
lines. The heard-word budget is roughly flat across all nine layouts while produced words double or triple.

### 1.7 The instrumentation demand is unanimous and specific

All nine seats reject a new static gate as sufficient. Seven of nine (**1, 2, 4, 5, 6, 7, 8**) name
**stall-rung fire rate at a specific beat** as the primary vital sign, and five (**1, 2, 4, 5, 6**) name
**time-to-first-advance per beat** as the second. Seats **2, 4, 8** all name **S(N+1) open rate within
48–72h** as the engagement read. Seats **2, 6, 8** independently propose the same *static* addition: a
linter that computes heard-vs-produced words from the shipped JSON. That is three opus seats converging on
one cheap check that would have caught the 9-versus-2 defect.

### 1.8 The numeric convergences — and the one that failed

| quantity | convergence |
|---|---|
| novel frames per session | **1** — seats 1, 2, 3, 4, 5, 6, 8 |
| S1 learner turns | **2–4** — seat 8 says 2, seats 1/3/6 say 3, seats 2/4/7 say 4 |
| S4 learner turns | **5–7** — seats 4/8 say 5, seat 6 says 4, seat 2 says 7 |
| S1 heard-words (as shipped) | **20** — seats 1 and 6 agree exactly and are correct (§4) |
| session heard:produced | **no convergence** — 5:1 (seat 1) · 6:1 (seat 2) · 5:1 (seat 4) · 7.3:1 (seat 5) · 13:1 (seat 6) · 5:1 (seat 7) · 6:1 (seat 8) |

The last row is the finding. The spread from 5:1 to 13:1 is **entirely a counting-rule disagreement**, not
a design one: seat **6** counts the automatic slow re-speak as heard word-exposures (doubling the heard
side) and seat **2** counts the learner's own name as zero Slovene words. Both are defensible; neither is
written down anywhere. **The session-level heard:produced ratio currently carries no information, because
nine seats computed it seven different ways from the same file.** Seat **2**'s reframe is the way out: the
session ratio is the wrong unit, and the **pre-production turn ratio** — heard-words in the turn
immediately before a production, capped at 2:1 — is the number that describes where the novice's load
actually lands. That is the direct fix for the 9-heard/2-produced defect and it is arithmetic on shipped
data.

---

## 2 · Genuine disagreements

### 2.1 The stepping stone — three-way, and it decides what S1 is for

| position | seats | claim |
|---|---|---|
| **`Živjo.`** | 2, 8, 9 | one word, heard twice before it is asked for, produced inside ~40s |
| **`Sem ___.`** | 4, 5, 6, 7 | the smallest utterance that is actually Slovene grammar — frame plus slot |
| **the bare name** | 1, 3 | proof the ear worked without support |

**The bare-name camp loses, and it loses to a finding the panel had already banked.** Finding #3 —
"a bare name is not Slovene" — is invoked against it explicitly by seats **4, 5, 6, 7, 8, 9**. Seat **6**
verified the mechanical version: `c1` carries an empty `learnables` array and credits nothing
(`slavko-intro-1.json:60-67` — verified, §4). Seat **1**'s version is subtler than the label suggests — its
claim is about *evidence of comprehension*, not about vocabulary — but it still ends the session with the
learner having produced zero Slovene. Seat **3** is the novice reporting honestly what S1 feels like, which
is data about the current build, not a design proposal.

**The remaining split is not a disagreement — it is two seats answering two different questions, and seat
2 is the one that noticed.** Seat **2**: "the stepping stone is what makes S2 *openable*, and openability
is not a knowledge state, it is a memory of having succeeded." Seat **4**, **5**, **6**, **7** are naming
S1's *payload* — what makes it a language lesson rather than a listening lesson. Both are needed and they
are not in competition.

**Call: `Živjo` is the stepping stone; `Sem ___.` is S1's payload.** Ordering is the whole content of the
decision, and seats **2** and **8** independently derived the same ordering from opposite mandates: the
learner's *first* production in S1 and the *first* production in S2 must both be `Živjo` — one word, heard
twice, unfailable — with `Sem ___.` as the second production in each. Seat **2** derives it from retrieval
(succeed once today before attempting anything cold); seat **8** derives it from the drop-off (nothing to
work out means nothing to fail at). Seat **9**, attacking the format, lands on the same utterance for a
third reason. Three mandates, three arguments, one answer: that is the strongest signal on this page.

Note the authoring consequence: **neither camp describes what ships.** The learner never says `Živjo`
today, and `c1` is the bare name. Both camps require an authoring change to S1.

### 2.2 The drop-off — a four-way split that reduces to two

| beat | seats |
|---|---|
| S1, the moment the button first arms after `n1` | 8 |
| S1, `n2`→`c2`, on the *second* exposure | 1 |
| S2, the first cold retrieval of `Sem ___.` | 2, 6 |
| S3, the first new-content turn | 4, 5, 7 |
| free chat, unscaffolded | 3 |
| the S2→S3 transition (second voice) | 9 |

Four seats (**1, 2, 6, 8**) put it in the first two sessions; three (**4, 5, 7**) put it at S3; two (**3,
9**) put it outside the spoken spine entirely.

**The early camp has the better support, and it is not close.** Its two arguments are complementary and
both are verified. Seat **8**: `n1` is *"Živjo! Kako ti je ime?"* — the learner is asked a question they
cannot parse, then handed a button, and does not know they have been asked anything. Verified: `n1` is 5
Slovene words with `glossPolicy: "held"`, and `held` is an *absent renderer branch* — nothing is shown
(§4). Seat **8**'s claim that the learner has no signal is not rhetorical; it is literally what the code
does. Seat **6**: at S2 beat 2, `frameEN` is gone and the last exposure is 24h old, and the rung that would
help — `soften`, English on the button — is authored on no node in the repo (verified, §4). So at 11s a
stalled S2 novice gets a second caption pulse and nothing else.

**The S3 camp is arguing about a session that does not exist and cannot be authored.** Seats **4, 5, 7**
reason from load curves that are sound in the abstract, but the beat they name is downstream of two
sessions whose failure modes are verified and unfixed. Seat **6**'s own framing settles the priority: "the
novice who quits does not quit from boredom at session three; they quit from incomprehension at session
one."

**Call: the drop-off is S1's first button-arm, with S2's first cold retrieval second.** Fix them in that
order. Seats **4, 5, 7** are not wrong that S3 has a load cliff; they are wrong that it is reachable.

Seat **3**'s answer — free chat, unscaffolded — is not a competing position and should not be scored
against the others. It is the one seat that noticed the handoff destination has no stall design at all, and
it is correct.

### 2.3 The pacing mapping, and whether `guided` should exist

Seat **8** moves to delete `guided`: "the arithmetic midpoint of `onboarding` and `brisk`… interpolation
pretending to be pedagogy."

**Partly verified, and the part that fails matters.** `guided` *is* the exact midpoint on five fields —
`frameLineMs` (650/550/450), `frameCharMs` (28/24/20), `captionReadMs` (900/800/700), `handoverMs`
(600/500/400), `closeHoldMs` (2200/1800/1400). It is **not** the midpoint on `frameHoldMs` (1200, midpoint
1250), `frameFadeMs` (500, midpoint 535), `glossDelayMs` (300, midpoint 325), or `stallMs`
([5000,8000,12000] vs midpoints [5250,8500,13000]). Seat **8** named five fields and all five check out; it
did not check the four that don't.

**Call: keep `guided`.** Not because seat **8** is wrong about interpolation but because deleting it forces
`onboarding`→`brisk` at exactly S3 — the beat three other seats independently named as the load cliff — and
`brisk`'s `stallMs[0]` is 6000 against `onboarding`'s 4500. That is 1.5s *more* dead air before the first
help at the hardest beat in the sequence, which is the precise failure mode finding #5 was written about.
Seat **8**'s real finding here is different and should be acted on separately: **`captionLeadMs` is 0 in
all three profiles and `backchannelMs` is 700 in all three — both verified (§4).** Those are constants
wearing a profile's clothes and should leave the profile.

Adopt the modal mapping: **S1 `onboarding` · S2 `onboarding` · S3 `guided` · S4 `guided`**, with `brisk`
held in reserve for S5+. Seats **1** and **5**, who tighten at S2, are outvoted 5–2 and their strongest
opponent is seat **5**'s own admission: it had to pin `stallMs[0]` *longer* than the profile default at
both its withdrawal seams, which is re-adding scaffolding under another name. Seat **5** flagged this
against itself; that is the tell that the seam is in the wrong place.

### 2.4 The slow re-speak

| position | seats |
|---|---|
| keep as an authored beat | 1, 5 |
| demote to stall rung 2 only | 2 |
| delete entirely, including the rung | 8 |

Seat **2** prices it and nobody else does: the automatic re-speak doubles heard-words per line for zero
production, and converts every retrieval attempt into a recognition event — "a scaffold that feels like
teaching and functions like erasure." It costs ~8–10s and ~14 heard-words per session, which is the entire
budget for S3's and S4's extra learner turns.

Seat **8** goes further on a banked finding: #4 says never answer a stuck learner with more of the target
language, and a slow re-speak *is* more of the target language. That is internally consistent and it puts
seats **1** and **5** — who keep `respeak` as the last safety net — in tension with a finding already
decided. But deleting the rung leaves only `pulse` (no copy at all) and `soften` (English), and `soften` is
authored nowhere.

**Call: seat 2's demotion.** Stop the automatic slow pass; keep `slowSL` on the node so the `respeak` rung
can still model the line at rung 2. This is the cheapest ~10s in the sequence and it does not remove the
only modelling instrument before its replacement is authored. Note the mechanics: `respeak` already
replays `slowSL` (`public/app.js:788-796`) and the schema *requires* `slowSL` for a `respeak` rung
(`server/dialogues.ts:300`), so the demotion is one renderer branch, not a re-authoring pass.

Seat **8**'s parenthetical — that the repo has a commit specifically for making the slow clips actually
slow, and that this is sunk cost — is correct and should not be allowed to weigh.

### 2.5 The silent hold before the caption — settled, and not the way any seat argued

This was the fight the last panel could not close. Seat **2** splits it by novelty (`captionLeadMs: 0` on
novel lines permanently, plus a new `recallLeadMs` on returning lines at 1200/1800/2600). Seat **7** grows
it as a tension beat. Seat **8** deletes the field.

**Verification changes the question. `captionLeadMs` is not a hold before the caption.** The renderer sets
the caption *first*, then awaits the lead, then plays the audio:

```
sceneCaption(npc.sl);
if (npc.captionLeadMs) await sleep(npc.captionLeadMs);
await sceneSay(npc.sl);
```

(`public/app.js:876-878` — verified.) The field is a **caption-before-audio lead**: reading time before
hearing. It is 0 in all three profiles and `captionDelayMs` is set on **no node in `server/dialogues/`** —
grep returns nothing (verified, seat **6** got this right).

So all three positions are arguing about a field that does not do what any of them describe, has never
fired, and cannot fire without an authoring change nobody has made. Seat **7**'s "tension beat" and seat
**2**'s "retrieval hold" both need a silence *before* the caption; this field produces silence *after* it.

**Call: delete `captionLeadMs` and `captionDelayMs`.** They are dead code, and a dead field is worse than a
missing one because it makes a design discussion possible about a behaviour nobody built. Seat **2**'s
`recallLeadMs` is the right *design* and should be built as a genuinely new pre-caption silence — but not
before S2 exists, because it is defined only on lines "the learner has heard in a prior session" and there
is no prior session. Seat **7**'s growing hold is the same mechanism with a different value curve and is
subsumed by the profile axis once the field exists.

### 2.6 Whether the spoken lesson is the right primary mode — did seat 9's attack land?

Partly, and on a different target than it aimed at.

**What landed, verified:**
- **There is no `create-scene` skill.** The repo has `create-scenario` and `create-dialogue` and nothing
  else (verified, §4). Seat **9**: "its own S2 cannot be authored through any gated pipeline that currently
  exists." This is the same defect the August panel found (§1.5) and it is still open. It is the strongest
  point on the page against scaling the format.
- **`bakery-1.json` outperforms `slavko-intro-1.json` on density.** 6 learnables introduced, click-through
  (`advance` absent → defaults to `"tap"`), full paired text, zero forced speech. Verified.
- **S1's forced production is unsignalled.** `n1` is 5 Slovene words at `glossPolicy: "held"`, and `held`
  has no renderer branch. Verified. Seat **9**'s "nothing on screen distinguishes the two" is literally
  true of the code, not a characterisation.

**What did not land:**
- Seat **9**'s load-bearing argument is that the scene "structurally cannot credit," making it the wrong
  primary mode for a product whose promise is earned mastery. **This is false as a description of the
  build.** `/api/scene` calls `applyCredit` on every beat's `learnableProgress`
  (`server/server.ts:182` — verified). The scene credits today. That it *shouldn't* is the previous panel's
  defects §1.2–1.4, not a structural property. Seat **9** built its central architectural claim on a
  mechanism it inverted.
- The claim that the primary mode "should be wherever the credited destination lives" collides with the
  decided cadence (brief §4), which is explicitly not re-litigable.
- Minor: bakery-1 has **7** NPC turns and 9 client turns, not 6 (verified).

**Call: the format survives, with two concessions won by seat 9.** (a) **A `create-scene` authoring
surface must exist before S2 is authored** — this is now a hard blocker, not a nice-to-have, and it is the
one thing seat **9** proved rather than argued. (b) **S1's first production must not be a blind answer to
an unparsed question.** Seat **9** reached this from the format attack; seat **8** reached the identical
conclusion from the subtraction mandate; seat **2** reached it from retrieval ordering. Note that the
panel's own most honest paragraph is seat **9**'s (d): its click-through S1 is structurally the option-B
panel design that was already rejected at the beat level, revived at the session level, and it has not
answered why session-wide is safer than beat-wide.

### 2.7 Forced vs invited speech in S1

Seat **9** makes S1's echo "invited, never demanded — mic optional, skippable with zero visible cost."
Everything shipping is forced-by-flow: releasing the button is the only way forward.

**A verification note reframes this too.** The scene **does not open the microphone at all**
(`public/app.js:967-994`, with an explicit comment: "the app never opens the microphone: there is no
permission prompt, no capture"). So "forced production" is already only *social* pressure — a button that
advances, next to an instruction to speak. There is no capture to make optional. Seat **9**'s "mic
optional" is a change to nothing.

**Call: keep it forced-by-flow, and fix what is asked instead.** A skippable echo lets a learner complete
S1 having produced nothing, which collapses the entire confidence premise the sequence is built on — and
seat **9** offers no answer to that. But seat **9**'s underlying complaint is correct and is answered by
seat **8**'s cut: make the first ask an echo of `Živjo`, heard twice within the preceding four seconds. An
unfailable ask needs no exit. The synthesis of **8** and **9** is available without conceding the skip.

---

## 3 · High-value outliers

- **Seat 2 — the pre-production turn ratio, capped at 2:1, as an authoring rule and a lintable gate.** The
  only proposal on the page that replaces a number nine seats computed seven ways with one that describes
  the actual failure. It would have caught the 9-versus-2 defect statically and it is arithmetic on shipped
  JSON. Adopt as written.
- **Seat 6 — the three missing instruments.** A scene run log (`/api/scene` takes a `runId`, appends one
  row per beat); a static silence budget in `lint-dialogue`; a produced-word ledger asserted monotone
  across S1→S4. Verified: `/api/scene` writes no session record while `/api/turn` and `/api/converse` both
  do (§4). Seat **6** is right that "how long is this lesson?" is answerable today only by sitting through
  it.
- **Seat 8 — deleting every `learnables` array from every `client` node.** One deletion that kills the
  previous panel's §1.2, §1.3 and §1.4 defects and the lying A1 map, replaced by an `encountered` list
  handed to free chat as `focusIds`. Verified: the crediting call is `server/server.ts:182`, and the
  `focusIds` seam is real end-to-end (`selectForWitness`, `server/mastery.ts:213-241`). Highest
  cuts-to-bugs ratio on the page.
- **Seat 7 — witness without a new voice.** Change who is in the room using one sentence
  (`To je [ime].`) and zero new audio, art, or learnables. The only proposal that makes a session feel like
  a different place while honouring the content-economics constraint the whole panel accepted. Seat **7**
  also states its own weakest link correctly: a novice may not register implied witness as exposure at all.
- **Seat 3 — the rejection of the worked-example dialogue.** The only seat to say the post-lesson dialogue
  reads as homework ("I'm checking my work like a kid") and would be skipped for free chat by S2 or S3.
  This is a direct challenge to the decided cadence from the one seat whose job is to react rather than
  analyse, and it deserves a live test rather than a ruling.
- **Seat 8 — cutting "the world remembers your name" as unbuildable.** The app cannot know the name without
  reading the ASR transcript (invariant: never shown) or putting a text field in front of the first win.
  Correct on the invariants, and doubly correct on the mechanism: the scene captures no audio at all, so
  there is nothing to transcribe. Seats **4** and **7** both built S2 openers on this hook. It has to go,
  and seat **8**'s replacement — recognition of the byte-identical returning clip — does the emotional work
  for free.

---

## 4 · Claims verified against code

| claim | seat | verdict | evidence |
|---|---|---|---|
| `/api/scene` selects the *first* `advance:"audio"` dialogue per scenario; two audio levels in one scenario are unreachable | 6 | **verified** | `server/server.ts:135` — `getDialoguesForScenario(scenarioId).find((d) => (d.advance ?? "tap") === "audio")` |
| `sceneFinish()` returns to home; there is no next-scene route | 6 | **verified** | `public/app.js:944-950` — `openHome(); // the scene hands off to the app proper` |
| The scene opens only from `!learnerStarted` or `?scene=` | 6 | **verified** | `public/app.js:1202-1204` |
| **⇒ S2–S4 are unreachable by a learner today** | 6 | **verified** | composite of the three above |
| `glossPolicy: "held"` has no renderer branch — it is "do nothing" | 6 | **verified** | `public/app.js:890-896` handles `"after"` and `"tap"` only; `"held"` is in the type union (`server/dialogues.ts:39`) and validated (`:281`) but never rendered |
| `/api/scene` writes no session record — no `runId`, no `sessions.append` | 6 | **verified** | `server/server.ts:131-192` takes only `{scenarioId, from}`; `sessions.appendTurns` appears only at `:267` (`/api/turn`) and `:337` (`/api/converse`) |
| **`/api/scene` records *nothing*** | 6, 8 | **false** | `server/server.ts:182` — `if (step.learnableProgress.length) learner.save(applyCredit(learner.load(), step.learnableProgress))`. The scene writes attempts to the durable learner model on every credited beat. It logs no *session*; it does mutate progress |
| The scene button does not record the learner | 6 | **verified** | `public/app.js:963-994` — "the app never opens the microphone: there is no permission prompt, no capture" |
| **The app records the learner's audio: "3 clips" / "audio only" / "a local audio blob" / own-voice replay strip** | 1, 3, 4, 7, 8 | **false** | same as above. Five seats specified a `records` row that does not happen. Seat **4**'s "replay strip now spans 4 sessions", seat **7**'s "four clips incl. the double-farewell" and seat **8**'s "ends on the learner's own voice played back once" are all unbuildable on this surface today |
| `captionLeadMs` is `0` in all three profiles | 8 | **verified** | `server/catalog/pacing.json:13,29,45` |
| `backchannelMs` is `700` in all three profiles | 8 | **verified** | `server/catalog/pacing.json:18,34,50` |
| `guided` is the arithmetic midpoint of `onboarding` and `brisk` | 8 | **partly verified** | true for `frameLineMs`, `frameCharMs`, `captionReadMs`, `handoverMs`, `closeHoldMs` (the five it named). **False** for `frameHoldMs` (1200 vs 1250), `frameFadeMs` (500 vs 535), `glossDelayMs` (300 vs 325), `stallMs` ([5000,8000,12000] vs [5250,8500,13000]) |
| `captionLeadMs` is awaited *before the audio*, with the caption already up | 6 | **verified** | `public/app.js:876-878` — `sceneCaption(); await sleep(captionLeadMs); await sceneSay()`. It is a caption→audio lead, not a hold before the caption |
| No dialogue in `server/dialogues/` sets `captionDelayMs` | 6 | **verified** | `grep -rn captionDelayMs server/dialogues/` returns nothing |
| The `soften` rung exists in schema and renderer but is authored nowhere | 6 | **verified** | `server/dialogues.ts:61,298-299`; `public/app.js:795-797`; `grep -rn soften server/dialogues/` returns nothing |
| S1 `c1` (the name turn) credits nothing — empty `learnables` | 6 | **verified** | `slavko-intro-1.json` node `c1`, `"learnables": []` |
| S1 heard-words = 20 (n1:5, n2:9, n3:6) | 1, 6 | **verified** | `slavko-intro-1.json` — `Živjo! Kako ti je ime?` (5) · `Me veseli! Jaz sem Slavko. Zdaj pa še ti.` (9) · `Lepo, da sva se spoznala. Adijo!` (6) |
| S1 heard-words = 22 (n2 = 11) | 5 | **false** | `n2` is 9 words, not 11 |
| S1 `n1` is "~3 words" | 3 | **false** | 5 words |
| All three nodes carry `slowSL`, so heard exposures ≈ 40 | 6 | **verified** | `slavko-intro-1.json` all three npc nodes; `public/app.js:880-886` plays `slowSL` unconditionally when present |
| `focusLearnables` → `selectForWitness` force-include is real end-to-end, capped at 8 | 6 | **verified** | `public/app.js:226,608-622`; `server/server.ts:293,308-309`; `server/orchestrator.ts:189`; `server/mastery.ts:213-241`, `WITNESS_TARGET_CAP = 8` at `:203` |
| That handoff control is bound to the tapped-tree surface only; the scene has none | 6 | **verified** | `public/app.js:1174` — `$("dialogue-handoff").addEventListener("click", reinforceFromDialogue)`; no scene equivalent |
| `/api/scene` does not return `introduces` | 6 | **verified** | `server/server.ts:178-191` response payload |
| There is no `create-scene` skill | 9 | **verified** | `.claude/skills/` contains `create-dialogue`, `create-scenario`, `prep-release` and generic skills; `find -iname "*create-scene*"` returns nothing |
| `bakery-1.json` carries 6 learnables | 9 | **verified** | `introduces: [kruh, en_masacc, zemlja, dve_dualacc, rogljicek, placam_s_kartico]` |
| `bakery-1.json` has 6 NPC turns | 9 | **false** | 7 npc nodes, 9 client nodes |
| `bakery-1` is click-through, no forced speech | 9 | **verified** | no `advance` field → defaults to `"tap"` (`server/server.ts:135` shows the default) |
| The spoken scene "structurally cannot credit anything" | 9 | **false** | `server/server.ts:182` credits on every beat with `learnableProgress` |
| `zivjo` · `sem_ime` · `adijo` · `sem_iz` · `zivim_v` · `ne_razumem` · `se_enkrat` · `delam_kot` · `hvala` · `lahko_dobim` · `dober_dan` · `dober_vecer` · `ja` · `v_redu` · `kako_se_rece` · `koliko_stane` · `pocasi_prosim` · `ponovite_prosim` · `me_veseli` · `nasvidenje` · `eno_femacc` all exist | 1, 2, 5, 6, 7, 8 | **verified** | `server/catalog/learnables.json`, all present. No seat cited a non-existent id |
| `kako_ime` is stored in **vikanje** (`Kako vam je ime?`) — a `ti` form must be minted for S4's payoff | 2, 6 | **verified** | `learnables.json` `kako_ime.gloss` = "what's your name? (vi)"; `predictableError` names the informal form. The `ti` form used in `slavko-intro-1.json:n1` has **no catalog id** |
| `Kako si?` is not in the catalog; only `kako_ste` (vi) | 6 | **verified** | `learnables.json` — `kako_ste` = "Kako ste?" glossed "(vi)". Seat **3**'s S2 and seat **4**'s cut both turn on this |
| **`pocasi_prosim`, `ponovite_prosim` and `se_enkrat` are "all stored in vikanje"** | 8 | **false** | only `ponovite_prosim` is vikanje ("please repeat (vi)"). `Počasi, prosim.` and `Še enkrat, prosim.` are register-neutral. Seat **8**'s stated *reason* for cutting them does not hold; the one-repair-move argument does |
| `dober_vecer` and `v_redu` exist but are **not** `core` | 1, 7 | **verified** | both lack `core: true` — seat **7**'s "zero new learnables need minting" for `v_redu` is true for existence, not for core status |
| `lint-audio` checks clip presence; nothing measures elapsed time | 6 | **verified** | `server/scripts/` contains `lint-a1`, `lint-audio`, `lint-dialogue`, `lint-scenario`, `lint-tree`; none computes duration or word budgets |
| S1's authored silence ≈ 9.5s at `onboarding` | 6 | **verified (arithmetic)** | frame 1600+620, then per-beat `captionReadMs`+`glossDelayMs`+`handoverMs` (n1 has no gloss delay — `held`), plus `closeHoldMs` 2200 ⇒ ~9.7s |

**Pattern worth noting.** The three opus seats (**2, 6, 8**) produced nearly every claim that survived
verification, and between them produced two of the three that failed — both narrow overreaches on
otherwise-correct findings (seat **8** on vikanje and on midpoints). The sonnet and haiku seats produced
richer designs and made the panel-wide error: five seats specified an audio-recording behaviour the build
does not have.

---

## 5 · Recommendation

### The sequence

**Counting rule, adopted from seat 2 and binding on all of it:** *heard* = Slovene word-tokens delivered
including any re-speak; *produced* = word-tokens the learner utters; the learner's own name counts as a
turn and zero Slovene words. **The governing constraint is not the session ratio — it is that no
pre-production turn exceeds 2 heard : 1 produced.**

**S1 — one word out of your mouth, then one sentence.**
Hears: `Živjo.` → `Kako ti je ime?` → `Me veseli! Sem Slavko.` → `Adijo!` (split `n1`; split `n2`; delete
`Zdaj pa še ti`; cut `Lepo, da sva se spoznala` from the close). ~14 heard.
Says: `Živjo` (echo, ≤4s after hearing it twice) · own name · `Sem ___.` · `Adijo` — 4 turns, 4 Slovene
words produced. Worst pre-production turn: 2:1.
Sees: one English on-ramp line, Slovene caption paired with every line, gloss-after on the middle beats,
**no gloss on the closing line**.
Records: an `encountered` list only. No credit. No audio.
Lit: on-ramp, caption, gloss-after, `pulse`, `respeak`, `soften`. Withdrawn: nothing — S1 is the ceiling.
Profile: `onboarding`. Hands off to: S2, single path, no choice.

**S2 — the same words, cold.**
Hears: S1's opener as the **byte-identical clip**, then `Sem iz ___.` modelled. ~18 heard.
Says: `Živjo` (cold, first) · `Sem ___.` (cold, second) · `Sem iz ___.` · `Adijo` — 4 turns, 7 produced.
Sees: no English on-ramp; caption on the novel line only; gloss-after on the novel line only.
Withdrawn: the English on-ramp; the caption on returning lines. Profile: `onboarding` — S2 does not tighten.
Novel frame: **1** (`sem_iz`, verified core). Hands off to: S3, single path.

**S3 — when you don't understand.**
Hears: the openers, one deliberately fast line the learner is meant to miss, `Ne razumem.` **modelled by
Slavko about himself in the immediately preceding turn** (seat 2's de-difficulted version — the retrieval is
warm, not cold). ~24 heard.
Says: `Živjo` · `Sem ___.` · `Sem iz ___.` · `Ne razumem.` · `Adijo` — 5 turns, 9 produced.
Withdrawn: caption on everything produced twice; the automatic slow pass (now rung 2 only).
Profile: `guided`. Novel frame: **1** (`ne_razumem`, core, rank 8). Hands off to: S4, and the **first
choice screen** — worked dialogue or free chat.

**S4 — asking for a thing.**
Hears: the openers, `Lahko dobim ___?` modelled, and seat 7's witness sentence (`To je ___.`) — one
sentence, no new voice, no new art. ~28 heard.
Says: `Živjo` · `Sem ___.` · `Ne razumem.` (offered, not forced) · `Lahko dobim ___?` · `Hvala` · `Adijo`
— 6 turns, ~11 produced.
Withdrawn: gloss on anything older than one session. Profile: `guided`.
Novel frame: **1** (`lahko_dobim`, core; `hvala` is an echo, not a frame).
Hands off to: free chat with `focusLearnables: ["lahko_dobim","hvala","ne_razumem"]` — the seam is verified
working (§4), it just has no button on this surface.

Session heard:produced runs ~3.5:1 → 2.6:1 → 2.7:1 → 2.5:1 under this counting rule. **Ignore those
numbers.** The one to hold is the 2:1 pre-production cap, at every beat, in all four sessions.

**Do not build:** the world remembering the learner's name (seat 8, verified unbuildable); any own-voice
replay strip (verified: no capture); a recap screen at any session (seats 2, 4, and the prior panel);
`captionLeadMs` in any form (verified dead); the `held` gloss policy (verified no-op — collapse to `tap`).

### What to do first

**(a) Must exist before S2 can exist at all — in order:**

1. **A `create-scene` authoring surface.** Verified absent. This is seat 9's one proven point and it gates
   everything downstream: S2 cannot be authored through any gated pipeline today. Extend `create-dialogue`
   to the `advance: "audio"` schema rather than minting a fourth skill.
2. **Stop `/api/scene` crediting.** Delete `server/server.ts:182` and every `learnables` array on every
   `client` node; write an `encountered` list instead. One deletion, four previously-verified defects
   (§1.2–1.4 of the August panel, plus the lying A1 map). Seat 8's cut #1, and the highest-value item on
   this page.
3. **A level parameter on `/api/scene`** (`server/server.ts:135` currently takes the first audio dialogue)
   and a next-scene branch in `sceneFinish()` (`public/app.js:944-950`) instead of `openHome()`.
4. **Return `introduces` in the `/api/scene` payload** (`server/server.ts:178-191`) and bind a scene-side
   handoff control, mirroring `reinforceFromDialogue` (`public/app.js:1174`). The `focusIds` seam behind it
   is verified working.

**(b) Authoring decisions — settled here, to be executed by `slovenian-author` + `scenario-critic`:**

5. **Re-author S1** per §5: split `n1`, add the `Živjo` echo as the first production, split `n2`, delete
   `Zdaj pa še ti`, cut `Lepo, da sva se spoznala` from the close, leave the closing line unglossed.
6. **Author the `soften` rung** on every node that arms a button. Verified authored nowhere; it is the only
   rung that lowers the bar in English, which is what finding #4 requires.
7. **Demote the slow re-speak** to `respeak` (rung 2). One renderer branch; keep `slowSL` on the node.
8. **Collapse `glossPolicy` to `tap | after`.** `held` is a no-op branch, and S1's hardest beat is
   currently authored on it.
9. **Delete `captionLeadMs` / `captionDelayMs`** from the profiles, the schema and the renderer. Move
   `backchannelMs` out of the per-profile block — it is a constant.
10. **Mint the `ti` form of `Kako ti je ime?`.** The line ships in `slavko-intro-1.json` and has no catalog
    id; `kako_ime` is vikanje. Same for `Kako si?` if any session wants it. Flag, do not fudge.
11. **One novel frame per session, no exceptions** — `sem_ime` · `sem_iz` · `ne_razumem` · `lahko_dobim`.
    All four verified core.

**(c) Instrumentation — none of this is optional, given four green gates caught none of four defects:**

12. **A scene run log.** `/api/scene` accepts a `runId` and appends one row per beat: node id, wall-clock ms
    since turn open, which rungs fired, ms to advance. `/api/turn` and `/api/converse` already do this; the
    scene is the only surface that doesn't. This is the only instrument that would have caught the
    15.5-second frozen beginner.
13. **The 2:1 pre-production gate in `lint-dialogue`.** Fail any dialogue where a pre-production turn
    exceeds 2 heard : 1 produced, or where a session introduces more than one novel frame. Arithmetic on
    shipped JSON — the only class of check that has ever caught anything here. Seats 2, 6 and 8 proposed it
    independently.
14. **Rung-1 fire rate per beat**, from the run log. Target under 15% at S1; over ~40% at S2's cold
    retrieval means the caption should not have withdrawn there. This is the single number that falsifies
    the sequence.
15. **A static silence budget** in `lint-dialogue`: profile silence + measured clip durations, failing above
    a per-session ceiling. "How long is this lesson?" is currently answerable only by sitting through it.
16. **S(N+1) open rate within 48h**, as a raw count, not a curve.

---

## 6 · Confidence

**Medium-high on the diagnosis; medium on the sequence.**

High on the diagnosis because the load-bearing structural claims all survived verification and several were
found independently by seats that disagreed about everything else: S2–S4 are unreachable, `held` is a
no-op, `soften` is unauthored, `captionLeadMs` is dead and mis-specified, `create-scene` does not exist,
and `/api/scene` credits when it should not. The strongest single convergence — that S1's first production
must be an unfailable echo of a word heard twice — was reached by three seats from three incompatible
mandates, which is the least likely kind of agreement to be an artifact of shared priors.

Lower on the sequence for two reasons the panel cannot fix. First, the whole of S2–S4 is design against a
surface nobody has run: seat **6**'s own caveat applies to all nine layouts, and finding #7 warns that
onboarding is the least dense lesson this app will ever have, so nothing here is validated at the density
S3 and S4 actually carry. Second, five of nine seats specified a `records` behaviour the build does not
have — which means a fifth of the panel's design language was describing a product that does not exist.
Everything downstream of "the learner hears their own voice" is unsupported, and that included two of the
warmest return-loop hooks on the page.

The one call in §5 I would most expect to be overturned by real data is holding S2 at `onboarding`: it is
5–2 on argument with no measurement behind it, and seat **8**'s falsification test — if S3 shows the highest
abandonment despite being the simplest session, boredom outranks overwhelm — applies equally to S2. Build
instrument 12 before betting on it.
