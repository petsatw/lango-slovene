# Seat 1 — Adult-L2 speaking tutor (A1)

*Model: sonnet. Panel: first-four-sessions, 2026-08-22.*

---

## S1 → S4 as a spoken spine

| | S1 Onboarding | S2 Returning | S3 The tool | S4 The threshold |
|---|---|---|---|---|
| **Hears** | 20 words total (n1:5, n2:9, n3:6) | ~14 words: repeat opener (5) + 1 new NPC line (≤6) + close (3) | ~16 words: repeat opener (5) + 2 new NPC lines (≤11) | ~18 words: repeat opener (5) + 3 new NPC lines |
| **Says** | 4 words: name, "Sem ___", "Adijo" | 5 words: name, "Ja.", "Hvala.", "Adijo" | 6 words: name, "Sem ___" (retrieval), "Še enkrat, prosim.", "Adijo" | 7 words: name, greeting swap ("Dober dan."/"Dober večer."), "Ne razumem." (offered, not forced), "Adijo" |
| **Heard:produced** | 5:1 | ~2.8:1 | ~2.7:1 | ~2.6:1 |
| **Sees** | English frame lines fading in; no meter, no score | World remembers name on-screen ("Živjo, [name]!"); Slovene caption still present, held longer on new line only | Same, but the caption on the *new* line is delayed (retrieval window) before appearing | Same, English frame gone; only Slovene caption, terse |
| **Lit scaffolds** | frame EN lines, gloss(after/held), slow re-speak, stall pulse+respeak, `stallMs` generous | name recall pre-supplied, gloss(after) on new content only, stall respeak | gloss withdrawn on repeated content, held on new content; stall now offers the taught escape phrase itself | gloss only on truly new lexeme; stall ladder tightened |
| **Withdrawn** | — | English frame after opener | English frame entirely; gloss on anything previously introduced | held-gloss default; slow re-speak auto-fires only after 2 stall rungs, not 1 |
| **Pacing profile** | `onboarding` | `guided` | `guided` (tightening `stallMs` node-override on repeat content) | `brisk` |
| **Records** | audio only, no judgment | audio only | audio only | audio only |
| **Hands off to** | S2 (single path, no choice) | S3 (single path, no choice) | **first choice**: S4, or a worked dialogue (uncredited) | choice: free chat (mastery) or next scenario's S1 |

Learnables cited: `sem_ime`, `adijo` (S1, shipping); `ja`, `hvala` (S2 candidates); `se_enkrat`, `ne_razumem` (S3 candidates); `dober_dan`, `dober_vecer` (S4 candidates). All Slovene lines below are suggestions for `slovenian-author`/`scenario-critic`, not shipped text.

**S2 sketch.** Opener token-identical to S1: "Živjo! Kako ti je ime?" → learner retrieves own name cold (no pre-supply — this is the one retrieval S2 is allowed, because it's already been produced once). Slavko: "[name]! Si pripravljen/a?" (≤4 words) → learner: "Ja." New elicitation, new lexeme, one word. Slavko: "Super. Hvala, da si tu." → learner echoes "Hvala." Close reuses "Adijo" verbatim.

**S3 sketch.** Opener repeats S1+S2. Slavko deliberately mumbles or the audio "clips" (authored, not accidental) and *demonstrates* the fix himself first: "Še enkrat? … Kako ti je ime?" — modeling the phrase before asking the learner to use it. Learner's stall rung on the *next* prompt now offers "Še enkrat, prosim." as the on-screen scaffold text the learner can literally read aloud — teaching the escape hatch as content, not just infrastructure.

**S4 sketch.** Opener same. New elicitation: time-of-day greeting choice — screen shows two icons (sun/moon), learner produces whichever the scene's daypart calls for, "Dober dan." or "Dober večer." — first productive *choice*, not fill-in-blank. Session ends: "Se vidimo — ali greva naprej?" with the two-tile handoff (dialogue / free chat).

---

## 1. The stepping stone

S1 must leave the learner able to do exactly one thing: **say their own name unprompted when asked "Kako ti je ime?" a second time, cold, with the English frame gone.** Not "Sem [name]" — that's the *frame*, teachable by repetition. The name-in-isolation (c1) is the proof the *ear* worked without support. If S2 opens with the identical question and the learner can answer without the gloss holding their hand, S2 is provably openable — the learner has independently verified, in their own head, that Slovene entered and something came back out. That's the utterance: **their own name, spoken to a Slovene question, unglossed.**

## 2. The frontier

S3 is where it bites. Engagement wants a new *situation* (a different room, a different stake) — confidence wants nothing but *repetition of what already worked* — simplicity says: same room, same Slavko, same opener, one new lexeme. I sacrifice engagement. A novice three sessions in has banked maybe 15 seconds of total self-produced speech; a scene change costs them the one thing they have — recognition. The cost is real: S3 will feel to a designer like "nothing happened," and a stakeholder will ask why session 3 still opens in Slavko's kitchen. That's the bill for simplicity winning, and I pay it on purpose.

## 3. The drop-off

The exact beat: **S1, n2→c2**, the 9-heard/2-produced turn, on a *second* attempt — i.e., not first-run (novelty carries first-run) but the first time a *returning* learner hits it and it's still the hardest ask in the whole four-session arc relative to what's been built up to it. Nothing in S2–S4 is harder than that single beat. If a learner survives it once but the *second* exposure (in S2's opener) doesn't feel easier, they conclude the app never gets easier and they quit before S3. What prevents it: the token-identical repeat plus pre-supply is not decoration — it is the entire retention proof. If S2's opener doesn't land easier than S1's did, cut everything else in S2 before touching that.

## 4. What I would cut

I would cut S3's second new lexeme entirely (originally I'd drafted `se_enkrat` *and* `ne_razumem` both landing in S3). Ship only `se_enkrat` as productive content; let `ne_razumem` stay a stall-ladder *offer* the learner can use but never a *required* elicitation until S4. One new productive word per session, full stop — even at S3, where "the learner is getting the hang of it" tempts a second. The removal buys back the heard:produced ratio staying above 2.5:1 through S3 instead of dropping toward parity, and it buys a session that a burnt-out adult can finish in under 60 seconds without feeling quizzed.

## 5. How we would know

Instrument two numbers, not vibes: **(a) latency-to-first-sound on the repeated opener**, session over session — if a returning learner takes as long or longer to start speaking on a line they've already produced once, the "world remembers you" design is not landing regardless of what the screen says; **(b) stall-rung depth on the new-content turn only**, session over session — if the learner needs rung 2 or 3 on S3's single new word as often as they needed it on S1's hardest beat, S2 did not do its retention job and S3 is over-scoped no matter how small it looks on paper. Both are measurable from existing stall/advance telemetry without adding a score to the UI — the instrument stays out of the learner's sight, which is the whole point.

---

**Confidence:** medium — the S1 arithmetic and stepping-stone claim are grounded directly in the shipping file; S2–S4 content is my best design judgment and depends entirely on `slovenian-author`/`scenario-critic` sign-off on the specific lines.

**Strongest counterargument to my own view:** a tutor optimizing this hard for "never harder than the last hardest beat" risks a curve so flat that an engaged adult feels babied by S4 and disengages from boredom rather than difficulty — the failure mode this seat is blind to, because I'm built to fear the stall, not the yawn.
