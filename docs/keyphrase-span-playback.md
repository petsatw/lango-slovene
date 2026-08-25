# Playable Key Phrases in a spoken scene

**Status:** ruled and built. The five open decisions in §5 were settled by the operator on 2026-08-25 and
are recorded there; where a ruling contradicts the body of this document, **the ruling wins** and the
affected passage is annotated.

**What exists:** the `align` artifact type and `build:alignments` (§3.3), the `voice-key-phrases` skill and
its `keyphrase-critic` (§3.4), `reconcile:keyphrase-audio` and `lint:keyphrase-audio` (§3.4 stages 3–4),
the `DialogueVoicing` field (§3.5), and the server/renderer seek-and-stop (§3.6).

**Measured billing.** Forced alignment did not move the ElevenLabs character meter at all across 29 clips
(10,274 before and after). It is metered at Speech-to-Text rates — $0.22 per *hour* of audio — so a
scenario is a rounding error, once, cached thereafter.

**One bug this shook out.** `/api/speak` served cached clips without `Accept-Ranges`, so a media element
silently refused to seek: `currentTime` was ignored, the clip played from 0, and the learner heard the
whole sentence instead of their phrase — with nothing erroring anywhere. The endpoint now honours byte
ranges. Any future span playback depends on that.

**v2:** the selection is an LLM judgment in a skill, not a coded matcher. See §3.
**v3:** a blank resolves to the NPC's own filler — `Sem ___.` is modelled by `Sem Slavko.` See §2.1.

---

## 1. The bug, precisely

Key Phrases lists the **client** lines of a level — the phrases the learner produced — and offers a
play button wherever a clip for that exact text is on disk ([server.ts:212](../server/server.ts#L212)):

```ts
playable: store.has(store.audioKey(e3.name, voiceTag, n.sl), "audio"),
```

But in a spoken scene, client lines are **deliberately never synthesized**
([dialogue-lib.ts:236](../server/scripts/dialogue-lib.ts#L236)):

```ts
return !((dialogue.advance ?? "tap") === "audio" && node.speaker === "client");
```

> *"In a SPOKEN scene the client lines are what the LEARNER says aloud — they are never played back,
> and synthesizing them would bill for clips nobody hears, in the character's voice rather than the
> learner's."* — `build-dialogue-assets.ts`

So for `slavko-intro` the correct number of play buttons under the current rules is **zero**.
`lint:audio` agrees and passes 45/45, because it skips client lines too.

The one button that does appear is an **accidental key collision**. The store key is
`sha256(provider | voiceTag | text)`, and all three levels declare `voices.client === voices.npc ===
"slavko"`. So a learner line byte-identical to one of Slavko's lines silently finds his clip:

```
L3  "Govorim slovensko."  →  hits the clip built for L2/n5, an npc node with that exact text
```

It is the only phrase in L3 that collides, which is why it is the only button. Non-spoken rehearsal
dialogues are unaffected — their client lines *are* built, so their Key Phrases work as intended.

---

## 2. What we want

**The phrase list stays exactly as it is** — what the learner was expected to say. That selection is
about the learner and does not change.

**The audio comes from how the NPC said it** — in this lesson or an earlier one. We own no recording
of the learner, synthesizing their lines was rejected upstream, and we already own Slavko saying most
of these phrases inside his own lines. The button replays *that portion of the clip that already
exists*. Nothing new is synthesized, ever.

### 2.1 The join is the learnable id, not string similarity

The learner will say `Sem [something unpredictable]` — their own name. There is no clip of that and
there never can be. But **the frame is what the lesson teaches**, and Slavko says the frame himself
with his own filler: `Sem Slavko.` That is the model delivery.

The temptation is to find such things by loosening the string match. **Don't.** Fuzzy matching is
exactly how a phrase gets modelled by something that isn't it. The precise join already exists in the
data: **both nodes carry catalog `learnables` ids, and the catalog stores each frame with its slot
marked.**

```
govorim_lang        "(Ne) govorim (dobro) ___."
sem_ime             "Sem ___."
sem_iz              "Sem iz ___."
nisem_iz            "Nisem iz ___."
```

> **Updated.** Speaking a language collapsed from three catalog entries to one. `govorim_dobro_lang` and
> `ne_govorim_dobro` no longer exist; every line in that family — positive or negative, bare or qualified —
> tags `govorim_lang`, whose frame carries the negation and the qualifier as **optional segments** in
> parentheses. An optional word may therefore differ between the learner's line and the delivery; a
> non-optional one may not. `lint:keyphrase-audio` reads the parentheses for exactly this reason.

So the resolution is an **id equality test**, not a similarity score:

1. The client node's `learnables` and the npc node's `learnables` share an id → they are instances of
   the same taught shape. This is exact; there is nothing to tune.
2. The catalog frame for that id says **where the slot is**. The fixed words must match word for
   word; only the slot may differ.
3. No shared id, or fixed words that don't line up → **no match**. Never a partial-credit fallback.

`Ne govorim dobro slovensko.` (client `ne_govorim_dobro`) and `Ne govorim dobro angleško.` (npc, same
shape) are therefore reachable — the frame is identical and only the language name differs. Whether
the learner *should* hear a different filler than the one on their screen is a judgment (§3.1), and
the pointer records what they will actually hear so the reviewer decides with their eyes open.

**Fixed words are fixed.** Nothing outside a declared slot may vary. That is the whole guardrail.

### 2.2 Coverage — measured

Every distinct key phrase in `slavko-intro` against every npc utterance in the scenario, with the
blank rule applied. This is a feasibility probe, **not** the selection mechanism — §3 replaces it:

| Level | Phrase | Candidate NPC delivery | |
|---|---|---|---|
| L1 | `Sem ___.` | L2/n2 `Se spomniš? **Sem Slavko.**` | ✅ |
| L1 | `Adijo` | L1/n3 `Lepo, da sva se spoznala. **Adijo!**` | ✅ |
| L2 | `Živjo` | L2/n1 `**Živjo!**` — whole line | ✅ |
| L2 | `Sem ___.` | L2/n2 `Se spomniš? **Sem Slavko.**` | ✅ |
| L2 | `Govorim angleško.` | L2/n6 `A ti? **Govorim angleško?**` — a **question** | ⚠️ |
| L2 | `Govorim slovensko.` | L2/n5 `**Govorim slovensko.**` — whole line | ✅ |
| L2 | `Ne govorim dobro slovensko.` | L2/n12 `Uf. **Ne govorim dobro angleško.**` — same shape, other filler | ⚠️ |
| L2 | `Govorim dobro angleško.` | L2/n12 `Uf. Ne **govorim dobro angleško.**` — inside a **negation** | ⚠️ |
| L2 | `Adijo` | L2/n16 `Ja, ja! **Adijo!**` | ✅ |
| L3 | `Živjo` | L2/n1 `**Živjo!**` | ✅ |
| L3 | `Ne` | L2/n9 `**Ne** verjamem! Še enkrat!` — emphatic | ⚠️ |
| L3 | `Nisem iz Slovenije.` | L3/n5 `Potem pa takole: **Nisem iz Slovenije.**` | ✅ |
| L3 | `Sem iz ___.` | L3/n9 `Jaz? **Sem iz Ljubljane.**` | ✅ |
| L3 | `Govorim slovensko.` | L2/n5 `**Govorim slovensko.**` — whole line | ✅ |
| L3 | `Od kod si?` | L3/n6b `In ti? **Od kod si?**` | ✅ |
| L3 | `Adijo` | L3/n10 `In govoriva slovensko! **Adijo!**` | ✅ |

**12 clean, 4 judgement calls, 0 impossible.** L1 goes 0→2, L2 1→4 (up to 7), **L3 1→6** (up to 7).

Every clean one is **sentence-final**, which is the best case: complete, falling intonation and a
natural tail, so the excerpt sounds like a phrase rather than a cut.

### 2.3 Two data gaps this exposes

Both are pre-existing, both are the operator's call, and neither is touched by this spec.

**a. `ne_govorim_dobro` has no slot.** ~~Its catalog frame is `"Ne govorim dobro slovensko."` while every
sibling marks the language as a slot.~~ **Resolved, and no longer a gap.** The catalog collapsed the family
into the single frame `govorim_lang` = `"(Ne) govorim (dobro) ___."`, which declares the language as its
slot for every member. The phrase is reachable, and under the §5.3 ruling it is voiced.

**b. Three L2 npc nodes carry no `learnables`** — `n8 "Daj, poskusi!"`, `n13 "A ti? Slovensko?"`,
`n14 "Ha! In angleško?"`: prompts and elliptical fragments with no catalog content, and no phrase's
source. Everything else is tagged on both sides, so the id-join is exact throughout this scenario.
Keep the `grounding: "text-only"` marking in the ReviewPackage for scenarios where it is not.

---

## 3. The tooling is a skill, not a matcher

### 3.1 Why

A coded matcher would pick a clip by string containment and a rule table. But the interesting question
is not *where does this text occur* — it is **which delivery of this phrase should a learner hear**,
and that is a teaching judgment. The three ⚠️ rows above are each a different way a matcher gets it
silently wrong:

- **`Govorim angleško.`** occurs only in `"A ti? Govorim angleško?"` — a **question**. The learner's
  phrase is a statement. Same words, rising intonation, wrong lesson. A matcher sees a perfect hit.
- **`Govorim dobro angleško.`** occurs only inside `"Ne govorim dobro angleško."` — the affirmative
  lifted out of a **negation**. The words are right and the meaning is inverted.
- **`Ne`** occurs inside `"Ne verjamem! Še enkrat!"` — an emphatic disbelief, not a plain "no".
  A one-word excerpt of someone else's emphasis, in the wrong register.

And where several sources exist, the choice still matters. `Adijo` occurs in `"Lepo, da sva se
spoznala. Adijo!"` and `"Ja, ja! Adijo!"` — a warm close and a brush-off, not interchangeable.
`Govorim slovensko.` exists both as a standalone line (L2/n5) and buried mid-sentence in `"…Dajva
skupaj: Govorim slovensko."` (L3/n7); the standalone is obviously better, but "obviously" is a
judgment, not a rule.

My instinct on all three ⚠️ is **no button** — but that is the point: it should be judged per phrase,
in context, and reviewed.

This is the same reason the rest of the repo authors rather than computes. So it goes in a skill,
with a ReviewPackage and an approval gate, exactly like `create-dialogue`.

### 3.2 The lanes

Following `docs/authoring-pipeline.md`, three lanes that never blur:

| Lane | What | Who |
|---|---|---|
| **L — measurement** | Word-level timings for clips that already exist | `build:alignments`, operator-run |
| **J — judgment** | Which npc utterance models each phrase; which words within it; or none | the **skill** |
| **L — write + gate** | Pointers into the dialogue JSON; lints | reconcile script + `lint:keyphrase-audio` |
| **G — generation** | *nothing* | — this feature never synthesizes |

**On the one remaining script.** `build:alignments` makes no decisions. It is an instrument — it
reports where each word falls in a clip we already own, the way `lint:a1` reports a band. The skill
consumes its output and does all the choosing. If you want zero scripts, §5.1 offers the alternative.

### 3.3 The measurement: Forced Alignment

**`POST https://api.elevenlabs.io/v1/forced-alignment`** — multipart `file` (the audio, any major
format, <1GB) plus `text` (the transcript). Returns:

```jsonc
{
  "characters": [{ "text": "G", "start": 0.31, "end": 0.35 }, …],
  "words":      [{ "text": "Govorim", "start": 0.31, "end": 0.88, "loss": 0.02 }, …],
  "loss": 0.04                       // average alignment confidence
}
```

This is the right endpoint because it aligns **the bytes we already have**. The `with-timestamps`
synthesis endpoint returns alignment too, but only by generating *new* audio — re-rolling clips
already approved and paid for. Forced alignment touches nothing.

*Unverified:* the docs page states no pricing. Confirm the per-call cost before the first run.
Volume is ~45 clips for this scenario, once, and free thereafter (cached like every other artifact).

**Storage.** A third artifact type beside `audio` and `image` in `server/assets/store.ts`:

```ts
export type AssetType = "audio" | "image" | "align";
const EXT = { audio: "mp3", image: "jpg", align: "json" };
```

Keyed by **the audio key of the clip it describes**, so an alignment cannot drift from its audio:
same key, different extension. `build:dialogue-assets --regen` deletes the audio key and **must**
delete the `align` artifact with it — otherwise a re-rolled clip keeps stale timestamps. That is the
single most likely source of a silent bug in this design, and it gets a lint.

### 3.4 The skill: `voice-key-phrases`

`.claude/skills/voice-key-phrases/SKILL.md`. Mirrors `create-dialogue`'s
author → critic → reconcile → gate → ReviewPackage shape.

**Input.** A `scenarioId` (optionally one level).

**Stage 0 — gather (L).** Read the scenario's spoken levels. Collect:
- the **key phrases**: distinct client `sl` per level, in met order — the same list the close screen
  shows, computed by the same rule (`server.ts` `keyPhrases()`), never re-judged;
- every **npc utterance** in the scenario across all levels — `sl` and `slowSL` — with its node id,
  level, and its alignment `words[]`.

**Stage 1 — judge (J), one phrase at a time.** For each key phrase, decide:
- **which utterance** is the best model of it, across the whole scenario, weighing register, warmth,
  and whether the phrase carries complete intonation there;
- **which word range** within that utterance's `words[]` — by index, e.g. words 4–5;
- or **none**, with a stated reason.

Rules it works under:
- Never invent a timestamp. It selects **word indices**; the milliseconds are read from the
  alignment. A span the skill cannot ground in `words[]` is rejected by the gate.
- Prefer a whole utterance over an excerpt where one exists — no seek, no clipping, true prosody.
- Prefer the natural clip over `slowSL`. The slow clip is a teaching device, not a model of the
  phrase.
- Prefer a level the learner has already reached.
- **Candidates come from the id join, not from reading.** An npc utterance is eligible when it shares
  a catalog `learnables` id with the client node. The catalog frame for that id says where the slot
  is; every fixed word must line up exactly. Nothing outside a declared slot may vary, and there is no
  partial-credit fallback — no shared id and no exact fixed-word run means no candidate.
- **A substituted filler is disclosed, never silent.** `Sem ___.` modelled by `Sem Slavko.` is the
  intended case. `Ne govorim dobro slovensko.` modelled by `…angleško.` is the same mechanism but a
  harder call, because the learner's screen shows a word they will not hear. Both record `heard`.
- Check the **sentence type and polarity**, not just the words. A statement must not be modelled by a
  question; an affirmative must not be lifted out of a negation.
- **No button is a valid and often correct answer.** A bad excerpt teaches wrong prosody or inverted
  meaning, which is worse than silence.

**Stage 2 — critique (J, independent).** A second agent, given only the phrase and the candidate
utterance's full text with the span marked, answers: *would a beginner hearing this excerpt learn the
right thing?* It never edits; it returns a verdict. Same shape as `scenario-critic`.

**Stage 3 — reconcile (L).** A deterministic script writes the approved pointers into the dialogue
JSON. The skill never writes files itself.

**Stage 4 — gate (L).** `lint:keyphrase-audio`:
- every referenced node id exists and is an `npc` node;
- the referenced clip is in the store, and its alignment is present and keyed to the current audio;
- the word range exists in that alignment, and the stored ms **equal** the values derived from it —
  so a hand-edited or hallucinated number fails;
- the client node and the referenced npc node **share the catalog id** the pointer names, or the
  pointer is explicitly marked `grounding: "text-only"` (the L1/L2 untagged case, §2.3b);
- the span's words, normalised, reproduce the frame's **fixed words exactly**, in order, with
  variation confined to the slot the catalog declares — and `heard` recording the actual filler.
  A frame with no declared slot admits no substitution at all.

**Stage 5 — ReviewPackage (PR semantics).** A table: phrase → chosen utterance with the span marked
in context → duration → the critic's verdict → or the reason for no button. Nothing is written until
approved. Drafts under `.scratch/keyphrase-drafts/<scenarioId>/`.

### 3.5 What lands in the dialogue JSON

On the client node, so the diff is reviewable:

```jsonc
"c5": {
  "speaker": "client",
  "sl": "Govorim slovensko.",
  "audio": { "from": "n5", "level": 2, "kind": "whole" }
}
```

A blank, carrying the NPC's filler so the diff shows what the learner will actually hear:

```jsonc
"c1": {
  "speaker": "client",
  "sl": "Sem ___.",
  "audio": { "from": "n2", "level": 2, "kind": "span",
             "words": [2, 3], "heard": "Sem Slavko.", "startMs": 980, "endMs": 2110 }
}
```

```jsonc
"c3": {
  "speaker": "client",
  "sl": "Od kod si?",
  "audio": { "from": "n6b", "level": 3, "kind": "span",
             "words": [2, 4], "startMs": 1240, "endMs": 2010 }
}
```

`from` is a node id, not raw text, so a reviewer sees **which of Slavko's lines** a phrase was taken
from. `words` is what the skill chose; `startMs`/`endMs` are derived and gate-checked against it.
No `audio` field → no button, correctly and permanently, which is the right answer for `Sem ___.`

### 3.6 Server and renderer

`/api/scene` stops calling `store.has` on the client line and reads the resolved field, returning the
source clip's **text** (what `/api/speak` keys on) plus the span:

```jsonc
{ "sl": "Od kod si?", "en": "Where are you from?",
  "play": { "text": "In ti? Od kod si?", "startMs": 1240, "endMs": 2010 } }
```

`play` absent → no button. In `renderKeyPhrases` ([app.js:1046](../public/app.js#L1046)) the existing
`▶` gains a seek and a stop; a `whole` pointer omits the ms and plays as it does today.

**Playback mechanics.** The client sets `currentTime` and stops on `timeupdate` at `endMs`, padded
**−60ms** head and **+120ms** tail — an unpadded span clips the onset consonant and swallows the
final one, which in a language lesson is precisely the wrong thing to lose. The known weakness is
mp3 seek precision, frame-granular and imprecise on VBR; with the pad it should be inaudible, but it
is a *should*, and it is the first thing to listen for. If it sounds bad, the escalation is cutting
the span server-side with ffmpeg into its own asset — which changes only the reconcile and the store,
not the skill, the server contract, or the renderer.

---

## 4. Phasing

**Phase 0 — free, no API calls, no skill.** Resolve only the phrases where an npc utterance
*is* the phrase (normalised for case and trailing punctuation, so `Živjo` finds the clip for
`Živjo!`). Pure key lookup, no alignment, no spans, perfect prosody. Fixes `Živjo`, and makes
`Govorim slovensko.` principled instead of a hash coincidence. **L1 0, L2 2, L3 2.**

**Phase 1 — the skill.** Alignments, judged spans, seek-and-stop. **L1 0→2, L2 2→4, L3 2→6.**

Phase 0 stands alone and is worth shipping regardless. Note it does nothing for L1, whose every
phrase needs a span.

---

## 5. Decisions — RULED 2026-08-25

> **These rulings are authoritative.** The proposals below them are kept as the record of what was asked
> and why; where they disagree with a ruling, the ruling wins.

| | Question | Ruling |
|---|---|---|
| **5.1** | Should `build:alignments` exist at all? | **Keep the script.** Forced alignment is a measurement, it re-synthesizes nothing, and it costs effectively nothing (measured: no movement on the character meter across 29 clips). Keeping it gives the Stage-4 gate a ground truth, which is what makes a hallucinated timestamp fail instead of ship. |
| **5.2** | One-time bootstrap, or a reusable skill? | **A reusable skill**, `voice-key-phrases`, runnable on any scenario. |
| **5.3** | The four ⚠️ phrases | **The phrase is a SHAPE, not a string.** The taught frame is `govorim dobro ___`; which language sits in the slot is not what the lesson is about. Choose whichever filler sounds best to the ear and makes most sense in context. Clipping out of a question or a negation is acceptable *where it is the only way* — "it might sound a little awkward but it still will make sense". A cleaner declarative delivery is preferred where one exists. **All four get buttons.** |
| **5.4** | Should the button disclose the voice? | **No. A bare ▶, no label.** And the wires that got crossed get purged: nothing in the code or the docs may frame this panel as a playback of the learner's own voice. It never was, and that was never the intent. |
| **5.5** | Cross-level sourcing | **Best delivery wins.** Level order is not a constraint. |

**On 5.3 — what the ruling changed.** The §2.2 coverage table was built by string containment and so
missed the clean sources. Under the shape reading, `Govorim angleško.` is modelled by L2/n5 `Govorim
slovensko.` — a whole line, clean declarative — and `Govorim dobro angleško.` by L2/n11 `Govorim dobro
slovensko.`, likewise whole. Neither needs the question or the negation the table pointed at. Reading the
phrase as a shape did not merely permit the awkward cases; it made most of them unnecessary.

**On 5.4 — the display consequence.** Where the delivery fills the slot with the character's own word, the
panel shows the phrase as its **shape** — `Ne govorim dobro ___.` — rather than the learner's wording. So
no word is on screen that the ear will not hear, and no label is needed to explain the difference. The
frame is derived at render time (`frameFor`, `server/scripts/dialogue-lib.ts`), not authored, and only
where the two lines agree word for word with exactly one substitution.

---

## 5a. The original proposals (superseded where they conflict)

**5.1 Should `build:alignments` exist at all?** You said the tooling should be an LLM evaluation, not
a coded script. I have kept one script, arguing it is a *measurement* and makes no choices. The
alternative is to drop it and have the skill listen to the mp3 directly through a multimodal model
(Gemini is already the E2 adapter and accepts audio). I recommend against it: a model asked for
timestamps from raw audio will produce plausible numbers with no way to tell a good one from a
hallucinated one, and the gate in Stage 4 — which is what makes this safe — depends on there being a
ground truth to check against. **But this is your call, and it is the core of what you corrected.**

**5.2 Does the skill re-run per lesson, or once?** Cheapest is a one-time bootstrap across the
scenario whose output you then edit by hand, after which `create-dialogue` authors the `audio`
pointer for new levels as part of normal authoring. That makes the judgment part of lesson design
instead of a separate pass over it, and the skill stops being load-bearing.

**5.3 The four ⚠️ cases** — each fails for a different reason, so they may not want the same answer:

| Phrase | Source | Fails on | My instinct |
|---|---|---|---|
| `Govorim angleško.` | `A ti? Govorim angleško?` | sentence type — a **question** | no button |
| `Govorim dobro angleško.` | `Ne govorim dobro angleško.` | polarity — inside a **negation** | no button |
| `Ne` | `Ne verjamem! Še enkrat!` | register — emphatic, not a plain no | no button |
| `Ne govorim dobro slovensko.` | `Ne govorim dobro angleško.` | filler — screen says one word, ear hears another | **yours to call** |

The last is the one you raised. It is reachable and the shape is genuinely identical; the cost is
that a learner reading `slovensko` hears `angleško`. Fine as a model of the *shape*, or confusing?
Also: should one-word phrases be excluded by rule, or judged each time?

**5.4 Should the button say what it is?** The panel is "phrases *you* met", but the voice is Slavko's,
and for a blank the words differ from what the learner said — they will hear `Sem Slavko.` beside
their own `Sem ___.` A bare `▶` may read as a recording of them. Options: label it
`"Hear Slavko say it"`, or show the `heard` text beside the row when it differs from the phrase.

**5.5 Cross-level sourcing direction.** Taking L3's `Živjo` from L1 is fine. Taking an L1 phrase from
an L3 clip means the model delivery comes from a lesson the learner has not reached. Harmless, or
should sourcing only ever look backwards?

---

## 6. Out of scope

- Re-synthesizing client lines. Rejected upstream; this spec does not revisit it.
- The non-spoken rehearsal surface, whose Key Phrases already work.
- `lint:audio`. It skips client lines correctly and should keep doing so.
