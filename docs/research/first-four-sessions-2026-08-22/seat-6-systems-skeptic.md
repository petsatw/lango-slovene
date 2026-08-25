# Seat 6 — Systems skeptic (A1)

*Model: opus. Panel: first-four-sessions, 2026-08-22. This seat is required to cite `file:line`.*

---

Everything below is checked against the code. The headline: **three of the four sessions this panel is being asked to design cannot be reached by a learner today.** `openScene` fires only from `!learnerStarted` or a `?scene=` query param (`public/app.js:1202-1204`), and `sceneFinish()` calls `openHome()` (`public/app.js:944-950`). There is no S2 in the product; there is a zero-state onboarding and then the app proper.

---

## The four sessions

### S1 — Meeting Slavko (ships today)

| Element | Spec | Representable? |
|---|---|---|
| **Hears** | 3 NPC beats, 20 Slovene words, each re-spoken chunked-slow → ~40 word-exposures | Yes — `slavko-intro-1.json:42,71,102`; slow pass `public/app.js:882-887` |
| **Sees** | 4 English on-ramp lines, then one caption at a time; gloss `held` on beat 1, `after` on 2 and 3 | Yes — `slavko-intro-1.json:32-37,47,76,107`; `public/app.js:824-854, 890-896`. **Caveat:** `glossPolicy:"held"` has no renderer branch (`public/app.js:890-896`) — it is "do nothing", not a held-then-available gloss |
| **Says** | own name (0 SL words), `Sem ___.` (2), `Adijo` (1) = **3 produced** | Yes |
| **Records** | **Nothing.** No mic, no runId, no turnlog | `/api/scene` (`server/server.ts:131-192`) takes no `runId` and never calls `sessions.append`; the button does not record (`public/app.js:967-994`) |
| **Lit** | frameEN, slow re-speak, prompt stem beside the button, backchannel, pulse+respeak stall rungs | Yes — `server/server.ts:146-166`, `public/app.js:777-800, 908-919` |
| **Withdrawn** | gloss on beat 1; meter; score; the `soften` rung | `soften` exists in schema and renderer (`server/dialogues.ts:61`, `public/app.js:795-797`) and **is not authored** at S1 (`slavko-intro-1.json:48-55`) |
| **Pacing** | `onboarding` — ~9.5 s of authored silence (2220 frame + 3×caption/gloss/handover + 2200 close) | Yes — `server/catalog/pacing.json:6-23` |
| **Hands off** | `openHome()` | **No.** The decided "ends into a choice" does not exist on this surface |

**Budget:** heard 40 / produced 3 → **13:1**. 3 learner turns. 1 novel frame (`sem_ime`, verified `learnables.json`).

### S2 — The door remembers you

**Hears** ~22 words / 3 beats: token-identical `Živjo! Kako ti je ime?` reopener, then a new fact-exchange beat. **Says** `Živjo` (1), `Sem ___.` (2, re-produced), `Sem iz ___.` (3) = **6 produced**; heard-to-produced **~7:1**. Introduces `zivjo` + `sem_iz` — **both verified in `learnables.json`**. **Pacing:** `onboarding` again — a second session is not a second week. **Withdraws:** frameEN drops to one line. **Lit:** everything else, plus the `soften` rung finally authored on the new beat.

Representability: the whole node content is expressible (`server/dialogues.ts:66-113`). What is not: **reaching it**. `/api/scene` picks `getDialoguesForScenario(scenarioId).find(d => d.advance === "audio")` — *the first* audio scene, one per scenario (`server/server.ts:135`). Two audio levels in one scenario are silently unreachable; `slavko-intro-1.json:3` pins `scenarioId: "slavko-intro"`. **Required:** `/api/scene` accepts a level, and the client routes to the next unplayed scene instead of `openHome()`.

### S3 — When you don't understand

**Hears** ~26 words / 4 beats; one beat deliberately over the learner's head. **Says** `Živjo` (1), `Ne razumem.` (2), `Še enkrat, prosim.` (3), `Sem iz ___.` (3) = **9 produced**; **~6:1**. Introduces `ne_razumem` (core, rank 8) + `se_enkrat` (core, rank 10) — both verified. **Pacing:** `guided`. **Withdrawn:** no frameEN; `glossPolicy:"held"` on the over-the-head beat. **Lit:** slow re-speak, all three stall rungs.

This is the first session where the **silent hold** is worth having, and it is representable: `captionDelayMs` on one node (`server/dialogues.ts:100-102`), resolved server-side into `captionLeadMs` (`server/server.ts:158`) and awaited before the audio (`public/app.js:876`). **No dialogue in `server/dialogues/` sets it** — grep returns nothing. So the fight is over an unused field.

### S4 — Asking for a thing

**Hears** ~28 words / 4 beats. **Says** 4 turns, `Lahko dobim ___?` (3) + `Hvala` (1) + two re-produced frames = **~11 produced**; **~5:1**. Introduces `lahko_dobim` + `hvala` — both verified core. **Pacing:** `guided`, not `brisk`. **Hands off** to free chat with `focusLearnables: ["lahko_dobim","hvala"]`.

The handoff mechanism **is real and I verified it**: `reinforceFromDialogue` → `openTutor({focus})` → `chatFocus` → POST `focusLearnables` → `selectForWitness(model, level, focusIds)`, which force-includes unseen focus ids at the head of the target list and caps at 8 (`public/app.js:606-618, 226`; `server/server.ts:293-310`; `server/orchestrator.ts:189`; `server/mastery.ts:213-242`). **But the button is bound to the tapped-tree surface only** (`public/app.js:593, 1174`; `public/index.html:128`) and the scene surface has no such control. Adding it is small: `sceneFinish()` must read `dialogue.introduces` — which S1 already populates (`slavko-intro-1.json:21-24`) and which `/api/scene` does not currently return (`server/server.ts:178-191`).

---

## 1. The stepping stone

**`Sem Ana.`** Not the name alone — a bare name is not Slovene, and `c1` credits nothing (`slavko-intro-1.json:60-67`, empty `learnables`). One frame with one slot the learner already owns. It is what makes S2 openable, because S2's opener is token-identical and the learner arrives already able to answer it. Everything else at S1 — `adijo`, the goodbye — is decoration on that.

## 2. The frontier

Confidence and simplicity collide at **S3**. Confidence says: never let the novice hear something they can't parse. Engagement says: the over-the-head line is the only thing that makes S4 feel like progress. Simplicity says: one novel frame per session.

I sacrifice **engagement at S3** by refusing to add a second scene, a second character, or a branch — and I pay for the un-glossed beat with the `soften` rung and a `captionDelayMs` hold, both already expressible. Cost, stated plainly: S3 is the least interesting of the four and a returning learner may find it flat. That is the correct trade. The novice who quits does not quit from boredom at session three; they quit from incomprehension at session one.

## 3. The drop-off

**Not S1's first beat — S2's, on the second turn.** At S1 `c1`, the learner says their own name; nothing can go wrong. At S2 they are asked for `Sem ___.` with the frameEN cut to one line and the last exposure ~24 hours old. What prevents it is decided policy and it is buildable: pre-supply, never diagnose. The reopener is token-identical, and the `soften` rung fires at `stallMs[2]` = 11000 ms (`server/catalog/pacing.json:18-22`) with English on the control. Today the rung is unauthored, so at 11 s an S2 novice gets a second pulse and nothing else.

## 4. What I would cut

**The `held` gloss policy, and the second half of S1's closing beat.** `held` is not a behaviour; it is an absent branch (`public/app.js:890-896`). Either it means "available on tap after N ms" — a renderer change — or it means `tap`. Collapsing it to two policies removes a designed absence nobody built the support for. And `Lepo, da sva se spoznala. Adijo!` (`slavko-intro-1.json:102`) spends 6 heard words to elicit 1 produced. Cut it to `Adijo!`. That buys 5 words off the heard side, 2.5 s off a 90 s run, and drops S1's ratio from 13:1 to ~11:1 without touching what the learner produces.

## 5. How we would know

The four green gates failed because **every gate reads the JSON; none observes the run.** `lint-audio` checks that clips exist (`server/scripts/lint-audio.ts:114,154`), `lint-dialogue`/`lint-tree`/`lint-a1` check structure. Nothing measures elapsed time, and the scene writes no record at all: `/api/scene` has no `runId` parameter and never appends a session, unlike `/api/turn` and `/api/converse` (`server/server.ts:241,256-268` and `293,327-338`).

Three instruments do not exist:

1. **A scene run log.** `/api/scene` takes a `runId` and appends one row per beat: node id, wall-clock ms since turn opening, which stall rungs fired, ms to advance. Cheap, and it is the only thing that would have caught the 15.5-second frozen beginner.
2. **A static silence budget in `lint-dialogue`.** Sum the profile's authored silence across the tree plus measured clip durations and fail above a per-session ceiling. Today "how long is this lesson?" is answerable only by sitting through it.
3. **A produced-word ledger.** Words heard (counting the slow pass) vs. words on `client` nodes, per session, asserted monotone across S1→S4. Every number in this document I computed by hand; nothing in the repo computes them.

Failure signal, in one line: **median seconds-to-advance rising across turns within a session, and rung-3 fire rate above ~20%.** Neither is currently observable.

---

## Claims I could not verify

- That S1 actually runs ~90 s — no clip durations on disk were measured; my ~9.5 s is authored silence only.
- That the `focusLearnables` handoff produces credit end-to-end at runtime; I read the code path and the unit probe (`server/probes/learnable-test.ts:130-160`), I did not execute a live turn.
- That "Kako si?" (informal) is authorable — **it is not in `learnables.json`**; only `kako_ste` (vi). Any S2 using it mints a new id.
- Whether `brisk` was ever run by a learner; nothing in `server/dialogues/` selects it.

---

**Confidence:** medium-high — every representability claim is read directly from source and the two gaps (no S2 route, no scene logging) are grep-verifiable in one command; the pedagogical sequencing is argument, not evidence.

**Strongest counterargument to my own view:** I am treating "not reachable today" as near-fatal, but the missing S2 route is perhaps forty lines — a level parameter on `/api/scene`, a next-scene branch in `sceneFinish`, and `introduces` in the response payload. If that is cheap, my insistence on designing to today's surface is a self-imposed constraint that makes the sequence more timid than it needs to be, and the panel would be right to design S2–S4 against the schema rather than against the router.
