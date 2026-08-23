# Seat 5 — Voice-interface designer (A1)

*Model: sonnet. Panel: first-four-sessions, 2026-08-22.*

---

## S1 → S4: the spoken spine, milliseconds included

| | S1 (onboarding) | S2 | S3 | S4 |
|---|---|---|---|---|
| **Hears** | 22 words total across 3 npc turns (n1: 5, n2: 11, n3: 6) | opener token-identical to S1's n1 (5 words) + 1 new npc turn (~9 words) = ~14 | 2 npc turns, ~10 words each = ~20, one turn now unglossed | 3 npc turns, ~26 words, closing line unglossed |
| **Says** | 1 name + "Sem ___." + "Adijo" = 3 tokens | "Sem ___." again + 1 new chunk (e.g. `dober_dan` or `prosim`) = 2 tokens, one repeated | 2 chunks, one new (`koliko_stane`), one reused | 3 chunks chained into one exchange, still each individually cued |
| **Heard:produced ratio** | 22:3 ≈ **7.3:1** | 14:2 = **7:1** | 20:2 = **10:1 → drops to ~6:1** once c2 lands | 26:3 ≈ **8.7:1**, trending toward the 4:1 target by S5+ |
| **Scaffolds lit** | English frame (`frameEN`), `glossPolicy: held`/`after`, `slowSL`, stall pulse→respeak, English closeHold | English frame **withdrawn after n1** (Slovene-only caption from n2), gloss still `after`, `slowSL` retained | Caption withdraws to Slovene **plus** English gloss only on stall (re-arm), `slowSL` retained only on stall rung 2+ | No `frameEN` at all; gloss appears only after 2nd stall rung; `slowSL` still exists but never plays unless stall rung 3 fires |
| **Pacing profile** | `onboarding` | `onboarding` (n1 identical) → `guided` from n2 onward | `guided` | `brisk`, with `stallMs[0]` manually pinned to 5500 (see below) |
| **Hands off to** | choice screen: dialogue vs free chat (uncredited either way) | same choice, now the dialogue option is pre-selected/nudged | same choice, free chat gently promoted (first live-mic exposure of a phrase from S3) | free chat promoted as default; dialogue becomes optional deep-dive |

### Per-session detail

**S1 — as shipped.** `n1` "Živjo! Kako ti je ime?" (`glossPolicy: held`, English caption armed) → learner says their name, unglossed, ungraded → `n2` "Me veseli! Jaz sem Slavko. Zdaj pa še ti." introduces `sem_ime` → `n3` "Lepo, da sva se spoznala. Adijo!" introduces `adijo`. `advance: "audio"` throughout — releasing the button is the whole signal. Nothing is credited. This is the floor everything else stands on; I'm not touching its timings.

**S2.** Opens with `n1` **byte-identical** to S1 (per "Already answered" — token-identical repetition, pre-supply not diagnose). The learner already knows what's coming; this is the confidence transaction of the whole sequence — recognition, not novelty, is the first thing S2 gives them. After the learner answers with their name again (same c1, same non-grading), Slavko's second turn is **new**: something like "Dober dan! Kako si?" gated on `dober_dan` (verified in catalog, `core: true`). English `frameEN` is present only on the opening screen (mirrors S1's onramp) and gone by the second npc turn — the first scaffold withdrawal of the whole course. Profile switches `onboarding → guided` at that same seam, so `frameLineMs` drops 650→550, `frameHoldMs` 1600→1200, `stallMs[0]` 4500→5000. Note the stall floor actually gets *longer* even as everything else tightens — deliberate, see Q5 below.

**S3.** No English caption at all after the cold open (which now doesn't exist — S3 starts directly in Slovene, no frameEN screen). Two npc turns instead of one-plus-a-greeting: an npc line ending in a real question (`Kako se reče "hvala"?` — `kako_se_rece`) and a transactional beat introducing `koliko_stane`. Gloss policy moves from `after` (always shown) to `stall-gated`: the English gloss for a line only renders if the learner sits past `stallMs[0]`. This is the first session where getting help costs the learner something legible — a half-second of visible waiting — rather than being ambient. Profile: `guided` throughout, `stallMs` widened to `[5000, 8000, 12000]` unchanged from the profile default; I'd resist tightening stall floors further here because S3 is exactly where a real question (not a name prompt) first lands, and a real question deserves more room than a name does, not less.

**S4.** `brisk` profile: `frameLineMs` 450, `frameHoldMs` 900, `frameFadeMs` 450. Three npc turns chained into something closer to a real micro-exchange — greeting, a request frame (`eno_femacc` + `kava`/`caj`/`voda`), and a closer using `hvala_nasvidenje` instead of the bare `adijo` S1 taught. The closing line is deliberately **unglossed and never gloss-gated** — it's the "unglossed closing line that becomes comprehensible next session" already decided. `advance: "audio"` unchanged; still nothing judges the recording. One manual override: `stallMs[0]` pinned to 5500 instead of the `brisk` default 6000, because this session's stall rung 1 (`pulse`) is now the *only* per-line safety net left before the gloss fires at rung 2 — I want the eye redirected slightly sooner given how little scaffold remains standing.

---

### 1. The stepping stone

S1 must leave the learner able to do exactly one thing on request, cold, with zero on-screen help: **respond to "Kako ti je ime?" by saying "Sem [name]."** Not the bare name — the app already has a bare-name lesson and it isn't Slovene (finding #3). "Sem ___." is the smallest utterance that is (a) grammatically Slovene, (b) something the learner *produced*, not repeated, and (c) recognizable the instant it recurs. S2 is openable the moment S1 leaves them able to predict, unprompted, "he's going to ask my name again and I know what I say back." That prediction — not the vocabulary — is the actual product of S1.

### 2. The frontier

The sharpest conflict is in S3, at the gloss-gating decision. Engagement wants the real question to land with full comprehension immediately — nothing kills willingness-to-continue like confusion at a novel construction. Confidence wants the learner to feel like they didn't need the crutch. Simplicity says: one mechanism, applied uniformly, no per-line judgment calls about which lines "deserve" help. I sacrifice engagement's demand for instant comprehension and let stall rung 1 (visual pulse only, no English) run its full `stallMs[0]`=5000ms before anything clarifies. The cost is concrete: a learner meeting the new construction for the first time sits in 5 seconds of authored, unrelieved silence before any help arrives. That's the price of keeping the gloss-gating rule the *same rule* everywhere in S3 rather than hand-tuning per line — hand-tuning is exactly the kind of authoring debt that produced the 15.5-second bug in the first place.

### 3. The drop-off

It's S3's second npc turn — the transactional beat — not S1 at all. S1's failure points were already found and fixed (asymmetry, dead air, name-only lesson). S3 is where the course first asks the learner to hold two unglossed constructions in one session with no English frame anywhere on screen. A novice who successfully cleared S1 and S2 on recognition and repetition meets, for the first time, a line they cannot pattern-match to something they've already said back. What prevents the quit: the stall handler's rung 1 (`pulse`) fires at exactly `stallMs[0]`, redirecting the eye without adding language — per finding #4, never answer a stuck learner with more Slovene — and rung 2 arms the gloss in the learner's own language. If pulse-then-gloss doesn't visibly fire within 13 seconds total (5000+8000) for a learner who's gone silent, that's the beat to instrument first.

### 4. What I would cut

I would cut the second npc turn from S2. As tabled above S2 currently has opener-repeat + one new turn; I'd drop the "Kako si?" beat entirely and let S2 be nothing but the token-identical opener, the same c1/c2 exchange, and a single new closing chunk. That halves S2's novel content to match the "novel frames per session ≈ 1" budget already decided — right now my S2 draft smuggles in a second novel item (`dober_dan` *and* a "how are you" turn) which violates the growth rule ("sessions grow by the learner's own turns, not more items"). The removal buys back the one thing S2 is actually for: a recognisable, low-cost session that's purely evidence the learner remembers S1, with confidence, not new material, as the payload.

### 5. How we would know

Instrument three numbers per session, not gate-pass/fail: (a) time-to-first-utterance after the npc's line ends — if it clusters near `stallMs[0]` rather than near zero, learners are waiting out the pulse rather than answering on recognition, meaning the "confidence" story is false; (b) fraction of sessions where the *stall handler itself* fires — if it's near 0% in S1–S2 and spikes in S3, that's the drop-off beat confirmed empirically rather than by table; (c) wall-clock silence per session summed from real timestamps, not authored durations — because the last four defects were only caught by running and measuring, and the specific bug that hid a 15.5s freeze was a transcription artifact invisible to any static check of these very JSON files.

---

**Confidence:** medium — the profile deltas and stepping-stone claim are grounded directly in shipped `pacing.json`/`slavko-intro-1.json`; the S2–S4 content itself is proposed, not built, so it hasn't been run or measured yet.

**Strongest counterargument to my own view:** widening `stallMs[0]` at S2's `guided` seam (4500→5000ms) while simultaneously tightening everything else could read as inconsistent rather than deliberate — a critic could argue that a course withdrawing scaffolding should shrink *every* named duration monotonically, and that giving the stall floor extra room right as English support disappears is quietly re-adding scaffolding under a different name rather than genuinely withdrawing it.
