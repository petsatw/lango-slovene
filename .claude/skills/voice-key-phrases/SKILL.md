---
name: voice-key-phrases
description: Give a spoken scenario's Key Phrases their play buttons by pointing each phrase at the portion of an existing NPC clip where the character says that shape — judged per phrase, critiqued independently, written by a deterministic reconcile, and gated. Use when a spoken (`advance: "audio"`) lesson's close screen has silent phrases, or the user says "voice the key phrases", "add play buttons to the close screen", "wire up the key phrase audio". Never synthesizes anything. See docs/keyphrase-span-playback.md.
---

# voice-key-phrases — the Key Phrases voicing orchestrator

You are **C, the Creator/Orchestrator** for the Key Phrases voicing pass. This skill IS the operating
procedure. You own the per-phrase judgment; you dispatch one independent critic; you drive deterministic
scripts for every file write and every number; and you **never** author a timestamp, edit
`server/dialogues/*.json`, or generate audio.

Read **docs/keyphrase-span-playback.md** (the design and the rulings it records) and
**docs/authoring-pipeline.md** (the J/L/G lane model) before you start. They win over anything here.

## The problem this exists for

In a spoken scene the learner's lines are **never synthesized** — we own no recording of them, and
putting the character's voice on their line and calling it theirs would be a lie. So the close screen's
Key Phrases list, which is exactly those lines, has nothing to play.

But the phrase was **taught**, and the character models it himself somewhere in the scenario. The button
replays *that*. Nothing new is ever generated: this pass can only ever aim at clips that already exist.

## The three lanes (never blur them)

- **L — measurement**: word-level timings for clips already on disk. `npm run build:alignments`. It makes
  no choices; it reports where each word falls. Operator-run, effectively free (Speech-to-Text rates —
  $0.22 per *hour* of audio; a scenario is a fraction of a cent, cached thereafter).
- **J — judgment**: which of the character's deliveries models each phrase, and which words of it. **You**,
  then an independent critic. This is a teaching judgment and it is the whole reason this is a skill.
- **L — write + gate**: `reconcile:keyphrase-audio` writes the pointers and **derives every millisecond**;
  `lint:keyphrase-audio` re-derives them independently and fails anything that does not reproduce.
- **G — generation**: **nothing**. This feature never synthesizes. If a phrase has no honest source, it
  gets no button, and that is a correct outcome.

**The golden rule: you choose WORD INDICES, never times.** A model asked for a timestamp produces a
plausible number, and a plausible number is indistinguishable from a measured one once it is in a file.
The reconcile derives ms from the stored alignment; the lint re-derives them. Author a `startMs` and the
gate will reject it — as it should.

## Guardrails

- **Never write `server/dialogues/*.json`.** `reconcile:dialogue` owns those files. The pointers go into
  `authoring/dialogues/<scenarioId>/reconcile-input.json` via `reconcile:keyphrase-audio`.
- **Never change which phrases are listed.** The list is the client lines the learner produced, computed by
  `keyPhrases()` in `server/server.ts`. That selection is about the learner and is not yours to revisit.
- **The join is an id equality, never a similarity score.** A delivery is a candidate only if its npc node
  shares a catalog `learnables` id with the client node. No shared id ⇒ not a candidate. There is no
  partial-credit fallback and nothing to tune. *(The operator asked for this explicitly: "without making
  the pattern matching so fuzzy that it starts including things that actually don't match the shape.")*
- **No button is a valid answer.** A badly-cut excerpt teaches wrong prosody or inverted meaning, which is
  worse than silence. Say why, and move on.
- **The voice is the character's, and nothing anywhere may suggest otherwise.** Not the button, not a
  label, not a comment, not a doc. This panel has never been a playback of the learner's own voice.

---

## Procedure

Work on a draft under `.scratch/keyphrase-drafts/<scenarioId>/`. **Nothing is written into `authoring/`
until the operator approves** (PR semantics).

### 0 — Gather (L). No judgment yet.

- **The key phrases**, per level: distinct `client` node `sl` in met order — the same list the close screen
  shows, computed by the same rule. A line with no letters (`"___"`, the learner saying their own name) is
  not a phrase. Never re-judge this set.
- **Every npc utterance in the scenario**, across *all* levels: node id, level, `sl`, and its `learnables`.
- **The alignments.** `npm run build:alignments -- <scenarioId>` (add `--dry-run` first to see the scope).
  Then read each clip's `words[]` — index, text, start/end. Indices are real words; the provider's
  whitespace tokens are already stripped, so index *n* is word *n*.
- **The catalog frames** for every shared id (`server/catalog/learnables.json`). A frame stores its slot as
  `___` and may mark optional segments in parentheses — `"(Ne) govorim (dobro) ___."` — because one taught
  shape genuinely covers positive and negative, bare and qualified.

Report what you found before judging anything: how many phrases, how many have candidates, which npc nodes
carry no `learnables` at all (prompts and elliptical fragments usually should not).

### 1 — Judge, one phrase at a time (J)

For each key phrase, pick **the delivery** and **the word range**, or **none**.

**A phrase is a SHAPE, not a string.** This is the operator's ruling and it is the heart of the stage. The
learner's `Ne govorim dobro slovensko.` and the character's `Ne govorim dobro angleško.` are the same
taught shape with a different filler. Which language sits in the slot is not what the lesson is about, so
it is not a reason to reject a delivery. Choose whichever filler **sounds best to the ear and makes most
sense in the context of the lesson**.

Ranked preferences, strongest first:

1. **A whole utterance beats an excerpt.** No seek, no cut, true prosody. If the character says the phrase
   as a complete line somewhere, that is the answer.
2. **Sentence-final beats mid-sentence.** A phrase at the end of a line has falling intonation and a
   natural tail, so the excerpt sounds like a phrase rather than a cut.
3. **A clean declarative beats one lifted out of a question or a negation.** Look for one before settling.
   The same shape with a different filler is often available as a clean statement while the exact wording
   only exists inside a question — take the clean statement.
4. **Warmth and register matter where several sources exist.** `Adijo` in *"Lepo, da sva se spoznala.
   Adijo!"* is a warm close; in *"Ja, ja! Adijo!"* it is a brush-off. They are not interchangeable.
5. **The natural clip, never `slowSL`.** The slow re-speak is a teaching device, not a model of the phrase.

**Clipping out of a question or a negation is permitted when it is the only way.** The operator ruled on
this: *"it might sound a little awkward but it still will make sense."* Prefer a cleaner source when one
exists (see 3); do not discard a phrase for want of one.

**Level order is not a constraint.** The operator ruled: best delivery wins. Sourcing an L1 phrase from an
L3 clip is fine.

**Fixed words are fixed.** Whatever you pick, every word of the shared frame that the catalog does not mark
as a slot or an optional segment must line up exactly. That is the whole guardrail, and the lint enforces
it — so a pointer that violates it will not ship, it will just cost you a round trip.

Record per phrase: the source node + level, `whole` or `span`, the word indices, what will be heard, and a
one-line **why**. Where you choose no button, the reason is the deliverable.

### 2 — Critique, independently (J)

Dispatch the **`keyphrase-critic`** subagent **once per LEVEL, with that level's whole panel** — every
phrase in close-screen order, each with the full text of its chosen utterance with the span marked and
what will be heard. Include the rows you decided get **no button**, and say so; they are part of the panel
the learner sees. It never edits and it never sees your reasoning.

**Never dispatch it one phrase at a time.** The critic reviews the panel as a set first and only then row
by row, and the set pass is the point: a phrase judged alone cannot reveal that **two rows are the same
taught shape** — the frame and the same frame with a filler, listed as if they were two lessons. That
defect is invisible to a per-phrase call by construction, not by oversight, and it has shipped. One call
per level, both passes inside it.

It returns `{ panel: { verdict, findings }, phrases: [...] }`. A `panel.verdict` of `revise` stands even
when every individual excerpt passes.

Fold its rejections in. Where you disagree, keep your choice and carry both positions into the
ReviewPackage; the operator rules.

### 3 — ReviewPackage (PR semantics). Nothing is written yet.

A table, one row per phrase:

| Phrase | Heard | Source | Span | Critic | Why |
|---|---|---|---|---|---|

Show the source utterance in full with the span marked, so the operator can see what is being cut out of
what. Show the duration. List the no-button phrases separately with their reasons — those are decisions,
not omissions. Then stop and ask for approval.

### 4 — Reconcile (L), on approval only

Write the draft `pointers.json` — `{ scenarioId, pointers: [{ level, node, from, fromLevel, kind,
words?, why }] }` — and run:

```
npm run reconcile:keyphrase-audio -- .scratch/keyphrase-drafts/<scenarioId>/pointers.json --dry-run
npm run reconcile:keyphrase-audio -- .scratch/keyphrase-drafts/<scenarioId>/pointers.json
npm run reconcile:dialogue -- authoring/dialogues/<scenarioId>/reconcile-input.json
```

The reconcile derives every `startMs`/`endMs` and every `heard` from the alignment itself. Supply a
timestamp and it refuses.

### 5 — Gate (L)

```
npm run lint:keyphrase-audio -- <scenarioId>
npm run lint:audio -- <scenarioId>
```

Then **restart the server** — dialogue JSON loads at startup only — and **play the app**. Open a level,
reach the close screen, press the buttons, and listen. Endpoint checks do not verify this: a span that
seeks wrong still returns 200 and still plays something.

If a span sounds clipped at either edge, the pad is in `renderKeyPhrases` (`public/app.js`) — −60ms head,
+120ms tail. If mp3 seek precision turns out to be the problem rather than the pad, the escalation is
cutting spans server-side into their own assets, which changes the reconcile and the store and leaves this
skill, the server contract and the renderer untouched.

---

## When a clip is re-rolled

`build:dialogue-assets --regen` deletes a clip. Its alignment **must** go with it, or the new bytes keep
the old timings and every span cut from that clip drifts — silently, since nothing sounds broken until you
listen. `store.removeAudioAndAlign` is the only sanctioned way to drop a clip, and
`lint:keyphrase-audio` reports both an alignment orphaned from its audio and one measured against text the
node no longer says. After any re-roll: re-run `build:alignments`, then the lint.
