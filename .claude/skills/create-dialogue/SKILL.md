---
name: create-dialogue
description: Author a complete, gated, internally-verified REHEARSAL-DIALOGUE package for a lango-slovenian scenario — the branching npc/client trees (N levels), their catalog learnables, and the scenario MANIFEST — present it PR-style for approval, and on approve reconcile + gate it (audio stays a separate operator-run step). Use when the user wants to add or extend a scenario's click-through rehearsal dialogue (café, bakery, pharmacy, …) or says "create a dialogue", "author the rehearsal trees", "add levels to <scenario>". This is the `dialogue` surface of the authoring engine (see docs/authoring-pipeline.md); it mirrors create-scenario's author→critic→reconcile→gated-generation shape for the branching-tree surface the MVP practices.
---

# create-dialogue — the rehearsal-dialogue orchestrator (the `dialogue` surface)

You are **C, the Creator/Orchestrator** for the rehearsal-dialogue surface. This skill IS the operating procedure. You own the pipeline: you assemble each stage's brief from what the stage before it returned, dispatch the subagents that do the judging and the authoring, drive the deterministic **reconcile** script for every file write, run the gates, and put the result in front of R. What each lane may and may not do is below, and it is stated there only.

Read **docs/authoring-pipeline.md** (the engine model + the J/L/G lanes) and **docs/rehearsal-dialogues.md** (the data model, the **tree template + sizing**, the **minting rubric**, the voice/env matrix) before you start — they are authoritative and win over anything here.

## The three lanes (never blur them)
- **J — Judgment**: the situation, the per-level objectives, the **branching graph** (ids + who speaks + the English intent per node + where branches re-converge), and every word the learner reads or hears. Done by the three `lesson-designer` subagents (who propose how the lesson teaches), the `learning-designer` subagent (who returns the design that gets built), the `slovenian-author` subagent (LS, who writes the Slovene), and the `scenario-critic` (who rules on it). **Not by C** — see the two rules below.
- **L — Logic**: id assignment, catalog merge, `introduces` computation, file writes, the structural + catalog + a1 lints. Done by **scripts** (`reconcile-dialogue`, `lint:*`), never by hand.
- **G — Generation**: per-speaker audio bytes. Done by `build:dialogue-assets` — **operator-run, on approval only**. Trees ship `audio: "pending"`.
- **Golden rule:** the designers propose how the lesson teaches; the learning-designer returns the design that gets built, complete; C transcribes it and moves it through the pipeline; LS writes the language; the reconcile assembles/mints/writes; the operator runs generation.
- **C never writes a string the learner reads or hears.** Not the on-ramp, not a stall's soften label, not a tutorial line, not an objective descriptor. Those are learner-facing content and belong to the designers (2a/2b) and LS (3). If a learner-facing string has no author, that is a gap in the brief — go and get it authored. It is not a job for the orchestrator.
- **Do not introduce content bias or editorialize content unless asked specifically to follow a specific direction by the operator.** A brief you compose carries what the stage before it returned and what the operator asked for — not your preference for a situation, a device, a phrasing or a tone. Steering shows up as an example that is really a suggestion, a constraint the operator never set, or a "shuffled" list that keeps its order. Where you believe a direction is right, put it to the operator as a recommendation and let them set it; where they have set one, follow it exactly.

## Umbrella-ready (D1) — why the input is a manifest
This skill is built as the **`dialogue` surface generator** of a future umbrella (`author-scenario --surface dialogue|handoff|guided-live|visual|a1`). Its input is therefore **manifest-shaped** (D2): a scenario package (situation/register/role/voices + the levels to author). The tree is the canonical **scene-script** (D3) — the same nodes a future guided-live mode will consume — so keep npc lines as clean scene beats and client choices as clean expected productions.

## Guardrails (every stage — from the handoff)
- **Audio is a distinct generation step.** Interactive runs leave it to the operator (trees ship `audio: "pending"`); a **headless run generates it as part of the flow** — lines via `build:dialogue-assets`, intros via `build:dialogue-intros` — with operator intent assumed.
- **Catalog: mint once by id, dedup by canonical `sl`.** Reuse existing ids; the reconcile enforces it and FAILS on a duplicate surface — resolve upstream, never by weakening the guard.
- **Conventions hold; deviations become recommendations.** The deterministic gates are the only hard stops. Where a run's aim meets a convention (growing the A1 core, a lesson that lands a band above its aim), ship convention-honoring output and surface a **firm, specific recommendation** in the ReviewPackage for the operator to ratify — see [dialogue-difficulty-model.md §7](../../../docs/dialogue-difficulty-model.md). No silent overrides, no mid-run blocks on a judgment call.
- **Legacy stays; scope discipline.** No guided-live runtime, no A1 engine, no auto-competency assignment. Don't touch create-scenario.

---

## Procedure

**The decision line** — referred to by name from the stages that quote it into a brief (2a, 2b):

> For every decision, ask what the best expert in that field would do and why they would reject your
> current choice; if you can name that reason, don't make the choice. Optimize for what that expert
> would judge correct, never for what satisfies the stated constraints most cheaply.

Work on a DRAFT under `.scratch/dialogue-drafts/<scenarioId>/` — **nothing is written into `authoring/` or `server/` and no audio is generated until R approves** (PR semantics). On approval the reconcile input moves to `authoring/dialogues/<scenarioId>/reconcile-input.json`, where it is committed source; everything else in the draft dir is working material and stays behind.

### 0 — Lesson ingredients (L + J) — before any authoring
Answers to **AGENTS.md › How the lessons teach**. Read it first; it is the law this stage applies. Two halves, never blurred.

**Computed (L) — read from the scenario's existing levels, never judged:**
- **Said before** — walk back up the spoken chain: this scenario's `advance: "audio"` dialogues sorted ascending by `level` (`server/dialogues.ts` sorts them; it is the same ordering the close screen's "Next lesson" button walks forward — `nextLevel` in `server/server.ts`), taking the **five levels immediately below this one**. Collect every catalog id appearing in `learnables` on a **`client`** node, and record which levels produced it. Client nodes only: those are what the learner said aloud, the same rule the runtime credits by — a spoken beat plants its client `learnables` as attempts, and tapped rehearsal trees credit nothing, so they are not part of this chain. This is also what the slot rule and gloss withdrawal test against.
  Mark which entries are **facts about the learner** — their name, where they're from, what they speak. Those are what the character can remember and raise; the rest he has no reason to bring up.
- **Heard-only set** — what appears on `npc` nodes but has never been in a slot.
- **Held lines** — what earlier levels left unglossed (`glossPolicy: "held"`). This level's material may make one of them land.

**Cloud (L) — the ingredients, from the same five levels.** The computed ledger above is narrow and
precise: what this learner has produced. The cloud is wide: the material that has been in their ear,
handed over loose so a designer can build turns out of sound they can already pick out.

- **The inventory** — the sound this learner can already pick out, as a **flat pool of units**:
  - every **catalog item** the five levels used, npc and client nodes alike, as `id` + citation form +
    gloss;
  - every **word the catalog has no id for**, folded to citation form (`babici` → `babica`, `žepu` →
    `žep`).

  **Build it as one shuffled pool** — every unit from all five levels in a single list, in random order.
  A unit is a word or a frame: the size of thing that goes in a slot. Pooled this way each item sits at
  its true frequency in the data, and a designer reaches for what serves the objective.
- **A one-line synopsis of each level's objectives** — what it set out to teach.
- **A one-sentence narrative summary of each level** — what happened in it, so a designer can see which
  devices have already been used.
- **The freedom block** (stage 2a), verbatim.

Hand the cloud over as a collection of ingredients for the designers and authors use as needed to best
perform their task.

**Judged (J) — two halves.** You (C) fix the shape, and it is identical in all three designs. Everything after it is what the three `lesson-designer`s each answer differently at stage 2a — **decide none of it here.**

**Fixed by you (C):**
- **The one new shape.**

  **A shape is a sentence frame with a slot.** `___ sem ___`, `Imam ___`, `Ali si ___?`, `Rad bi ___`. Two
  utterances are the SAME shape when one is the other with a different filler in the slot, **or the same
  frame carried by a different person, number, case or tense of the same verb**. *Sem Slavko / Sem zmaj /
  Ti si človek / Ti si zmaj* is one shape. *Govorim slovensko / ne govorim dobro angleško* is one shape.
  `Imam ___` is a different shape from `Sem ___` — different verb, different frame.

  A shape is NOT a string, and it is not a paradigm cell. Working one shape across two persons inside a
  lesson is the shape being *learned*, not two shapes being taught — a learner who can only say the 1sg has
  memorised a phrase, not acquired a frame.

**Answered by each designer (stage 2a) — spec these in the brief, don't answer them:**
- **The situation** — where they are, why the two of them are talking, what the character is doing, and
  who and what is in the scene with them. Each design answers this fresh, and the three answers are the
  main axis along which they differ.
- **The variation plan** — how the shape gets worked, and how many turns that yields. Moves: answer it · negate it · swap the filler · add a qualifier · hear it said back.
- **Natural reasons to repeat and improvise** — the in-fiction *reasons* those variations happen. Play is always lighthearted and never at the learner's expense.

  **Hand this to the author in a RANDOM order.** The sequence below is not a ranking and carries no preference — it is written in a fixed order so a person can read it. Shuffle it when you compose the brief; an author reading a stable list pulls every lesson toward its first few entries. The three tests follow the list, in the order given, unshuffled.

  - **He asks about a second thing.**
  - **Reciprocity — "In ti?"** The most common turn in conversation. It makes the learner's line an answer to a question rather than a recitation, and it's free: he already said the shape about himself to model it.
  - **Consequence.** The scene forks on what the learner said — which coffee arrives, which door, whether he keeps speaking Slovene. The line gets confirmed because it mattered. The anti-exercise reason.
  - **He writes it down.** A form, an order pad, a phone contact. Reading back is what people actually do — *Ana? Z enim n?* Confirmation without putting an error in the ear.
  - **Affirming echo.** He's pleased and says the learner's own line back, correctly. A native voicing what the learner just produced is the highest-value input moment in the lesson, and it costs nothing.
  - **Task arity.** The job itself has three items — three fields, three people to introduce. The reps come from the task, not from his curiosity.
  - **He's self-deprecating and invites the mirror.**
  - **He is unsure he heard correctly.**

  **Not a strict list** — say so in the brief. A reason that is not here is fine if it passes all three tests:
  1. **It works purely as sound.** Nothing to see, nothing to picture — *Writing for the ear* (stage 2c) applied to the reason itself. Stagecraft that has to be watched (an interruption, a passing bus, someone walking up) buys a repeat without teaching anything.
  2. **It exists outside the lesson.** A person would do this with a fluent speaker.
  3. **Constructive variation over rote.** If the shape can be varied for a rep, a constructive variant is used instead of rote repetition.
- **Not yet reused** — from **Said before**, every id the learner has produced **only in the lesson that introduced it** and in no lesson since. Each is a candidate for this lesson: include it if there is a good, natural way to, doing something different from last time rather than recited. Where several fit naturally, prefer the one that has gone longest without being reused. Where one does not fit, leave it out and give a one-line reason — "no room" is not a reason, so name what took the room.
- **The closing line** — what the character says as this conversation ends. It belongs to this lesson: it uses this lesson's material, and it reads as a person finishing a conversation.

**Sizing — quote both of these into every designer brief.**

Size against the level's band (AGENTS.md › Lesson shape). Beginner: 9–18 nodes, one new shape. Where in the band it lands follows from how much play the shape offers, never from a length target. **Length is not difficulty** (docs/dialogue-difficulty-model.md › Decided specifics) — a longer design is not a better one.

**The split is a floor, not a target.** Beginner: at least two learner turns for every three npc nodes. Clear it, then improve on it wherever the rest of the lesson allows. The floor exists because a beginner needs the situation set and the language modelled before they can say anything — it is what that scaffolding costs, not what to aim for. The learner's own voice is the main event; every node above the floor is a node that has to earn its place against a turn.

### 1 — Parse the manifest-shaped brief (J)
Fix: the **situation**, a **register** (ti/vi + pogovorni/knjižni), the tutor **role** (Slovene role noun, e.g. `natakarica`, or a named character who appears as himself), the **voices** (`npc` + `client` catalog voice profiles — and the learner's gender, which fixes first-person forms), the **advance mode**, and the **levels** to author (each: a `levelLabel`, a `title`, and its ordered **objectives** as EN meanings + the grammar point each teaches). Pick a kebab/lowercase `scenarioId`. If the scenario already exists, you are EXTENDING it — read its manifest + existing levels first so new levels don't re-introduce covered learnables.

**The advance mode picks the shape (docs/rehearsal-dialogues.md › Tapped vs spoken).** Two kinds of package come out of this skill:

| | `advance: "tap"` — a rehearsal tree | `advance: "audio"` — a spoken scene |
|---|---|---|
| Shape | branching: npc → **≥2 client choices** → re-convergence, sized per the template below | a **linear spine**, `next[0]` at every fork; extra entries are alternates a surface previews |
| Client nodes | canned lines the learner **picks** | what the learner is expected to **say**; each carries `learnables` (the attempt allowlist, possibly `[]`) |
| Band denominator | **every** node — a worked example is read end to end | **client nodes only** — the band is what the learner must produce |
| Arc | a real transaction: greeting → core exchange → closing | whatever the situation genuinely is — a **relationship opener** (curiosity → names exchanged → an invitation back) is as valid as an errand. Let the situation name its own arc. |
| Extra node fields | — | `slowSL` + `deliverySlowSL`, `glossPolicy`, `stallHandlers` (2a › What the format can do) |
| Timing | the learner's own finger | a **pacing profile** (`server/catalog/pacing.json`) — see stage 2c |

Set `dialogueAdvance` in the reconcile input to match. Absent ⇒ `"tap"`.

### 2a — Three designs (J), three authors, in parallel
**The objective is always given** — by R directly, or by the roadmap/syllabus the brief carries. The three designs are three ways to teach *one* objective; they never propose different lessons.

Dispatch **`lesson-designer`** three times, concurrently and **blind to each other**. Three passes from one context converge — independence is what makes the designs genuinely different, and it is the same reason the reasons list is shuffled.

Every brief carries, identically:
- **The shape** (stage 0) — the one new sentence-shape this lesson teaches. It is the whole of what is
  fixed for a designer, and three designs are three routes to it.
- **The settings** (stage 1) — the advance mode, the register, the two voices and which of them is the
  learner, and the learner's gender wherever it constrains the forms that can be elicited. Every entry
  states what the format allows. `role` names the npc: a Slovene role noun (`natakarica`) or the
  character's id (`slavko`).
- **The computed ledger** — said before · heard-only · held lines · not-yet-reused. Extraction from the
  levels already built; a script emits every line of it.
- **The cloud** (stage 0) — the shuffled inventory, the one-line objective synopses, and the one-sentence
  narrative summaries.
- **The decision line** (Procedure), quoted verbatim.
- **This block**, quoted verbatim into every brief:

  > ## You are free of previous narrative lines
  >
  > **The learning objective comes first.** You are not continuing a story, and no earlier scene has any
  > claim on this one. Take the narrative wherever it needs to go to teach this objective best — if it
  > continues a previous narrative, great. If it introduces a new situation, a new place, a new reason
  > for the two of them to be talking, equally great!
  >
  > The learner's history above exists to tell you **which words are already in their ear**, so you can
  > build turns out of sound they can pick out. That is all it is for. If the new lesson happens to sit
  > well alongside what came before, good — but synergy is a bonus, never a requirement, and it must
  > never cost the lesson anything.
  >
  > **Storytelling exists to enhance the learning. If it distracts from it, it is the wrong path.**

- **What the format can do** — quoted verbatim into every brief. A designer who does not know these builds
  a ladder that cannot be built, and the gap gets patched downstream by whoever notices, which is exactly
  where the orchestrator starts authoring.

  > - `slowSL` belongs to a node and can only re-say **that node's own line**. A beat that wants the target
  >   re-modelled slowly must carry the target in its own line.
  > - It fires two ways: the learner taps the tortoise, or a hand-over beat's `respeak` stall rung fires
  >   after silence. It is never automatic.
  > - `stallHandlers` is the quiet-learner ladder, npc nodes only, taking its timing from the pacing
  >   profile's `stallMs` **by position**. Each rung is `{ kind, label? }`: `pulse` flashes the caption (no
  >   copy), `respeak` replays that node's slow clip (so the node needs a `slowSL`), `soften` lowers the
  >   button's label to an English instruction. **They carry no Slovene** — someone who has not spoken is
  >   not short of Slovene, they are stuck, and answering that with more of the language they do not have
  >   is the one thing a lesson must never do.
  > - `glossPolicy` says when the learner sees a node's English: `"tap"` (click to reveal), `"after"` (it
  >   follows the Slovene on its own), or `"held"` (the situation carries the meaning here).
  > - There is no microphone. The turn cannot be failed and nothing inspects what the learner says.
  > - A spoken level is a linear spine; `next[0]` is the path. A "branch" lives in the slot, not the tree.
  > - The four run controls (🐢 « » ✕) are on screen throughout, and a level may teach them with `tutorial`.

- **The reasons to repeat and improvise** (stage 0), **shuffled independently for each brief**, with the three tests in the order given.
- **Writing for the ear** and, for a beginner spoken level, the **scaffolding ladder** — both quoted in full from stage 2c.
- The two **sizing** paragraphs from stage 0.

Each returns a **design sketch**: English intent only, no Slovene, no per-node fields.

- **Premise** — one line: what happens.
- **Opening** — how the scene starts and what puts the new shape in play. If it draws on what he remembers about this learner, say what and why it comes up now; if the situation is new, say what makes it the right one for this objective. Either is a complete answer.
- **Ladder trace** — the new shape's exposures in order: heard in a sentence → heard alone → heard slowly → in the slot.
- **Retrieval schedule** — the distinct productions of the shape, and what sits between them.
- **Reasons used** — which, and where each fires.
- **Slot shape + fillers** — where the new shape is a `pattern`, which of its three slot shapes is being worked (fill in the blank · fill in the blanks · sentence stem — docs/learnable-subsystem.md) and which fillers pass through it. Same shape, materially different lesson.
- **Skeleton** — the node graph itself, as `{ id, speaker, intentEN, next }`, plus per node its
  `glossPolicy`, whether it carries a `slowSL`, and its `stallHandlers` **with their English soften
  labels**. Then the count: turns : substantive nodes, against the floor. Prose alone ("4 turns : 6 nodes")
  leaves the graph to be invented downstream, which is where a design stops being the design that was
  chosen.
- **Objectives** — `[{label, descriptorEN}]` for this level, in the learner's language.
- **Reuse** — stale ids picked up, and how each is used differently from last time; ids left out, each with a reason that isn't "no room".
- **Branch** — if any, and what each arm earns.
- **Closing line** — its job in this lesson.
- **Thinnest point** — where it is most likely to fail character truth or the ear.
- **The on-ramp** (`frameEN`) — the English lines shown before any Slovene, **written LAST**, after
  everything above is settled. It frames *this* lesson: where the learner is, what is about to happen, what
  they will be asked for, and that nothing is at stake yet. It is the only place the lesson may speak
  English freely, and it is what earns the right to withhold English once the character starts speaking —
  **a lesson may only withhold English on its first beat if it has first framed the situation.** Write it
  from the design you have just finished: an on-ramp written first frames a lesson that does not exist yet,
  and the lesson then bends to fit it.

Nothing is written to disk; the sketches live in your context.

### 2b — Choose the lesson (J → learning-designer)
Dispatch **`learning-designer`** once, with all three sketches, the shape and the settings. Give it **the
decision line** (Procedure) and this, verbatim:

> Your role is that of an optimizer and decision maker to guide the most masterful design.
>
> Gating functions and auditing for quality will occur later and be performed by other roles, you have
> the freedom to make sure this lesson is optimal.

It returns a **complete, buildable design** — not a verdict naming a winner:
`{ built_on, why_it_teaches_best, taken_from_others:[{from,what,why_it_fits}], left_behind:[{what,why}],
what_to_watch, nodes:[{id,speaker,intentEN,next,glossPolicy,slowSL,stallHandlers}], objectives, frame_en,
closing_line }`.

`frame_en` is the on-ramp being built — taken whole from one design, or assembled from named lines with a
reason per line. Naming a winning *design* and leaving its frame unstated is the gap the orchestrator ends
up filling.

Everything it returns is what stage 2c transcribes. **If it comes back incomplete, send it back** — a
missing piece is a gap in this stage, not work for C.

**Interactive:** show R the three sketches and the verdict; R picks. **Headless:** the verdict stands, and stage 9 reports the two designs not built on.

### 2c — Transcribe the chosen design (J)
The design chosen at 2b arrives complete — nodes, objectives, on-ramp, closing line. This stage **transcribes
it** into the per-level shape the reconcile input takes, and checks it against the format. It does not
construct it.

**If you are about to write something that did not come from a designer, the author or the critic, stop**
(the lane rule at the top of this file). That is a gap in the stage that owns it — re-dispatch that stage.

**Check the design against the format, and fix nothing yourself** — a failure here goes back to 2b. This is
the last point where the shape is free to change: once LS has written the level, changing it costs a
re-dispatch, and once the audio is built it costs clips.

- **The graph is well-formed for its advance mode** (stage 1's table), against the template in
  docs/rehearsal-dialogues.md: `root` is an `npc` node, every path ends at `next: []`, and a tapped tree's
  branches re-converge onto shared later nodes.
- **Every objective is demonstrated on a reachable path**, and the objectives are distinct across the
  scenario's levels.
- **The count clears the floor** (stage 0 › Sizing). If it sits exactly on the floor, name the npc node
  doing work a turn could do — a line the learner could say instead of hear, a confirmation they could
  give, an answer they could supply — and send it back.

**For an `advance: "audio"` scene, timing is a PROFILE, not per-node numbers.** Every engineered silence
in a spoken lesson lives in `server/catalog/pacing.json` — the on-ramp dwell, the caption lead, the read
pause before the slow re-speak, the gloss delay, the hand-over, the close hold, the backchannel
protection, and the stall ladder. Pick a profile with `dialogueAdvance`'s sibling `dialoguePacing`:

| profile | for |
|---|---|
| `onboarding` | hour zero, maximum room (the default when absent) |
| `guided` | the learner knows the format, still gets the slow re-speak |
| `brisk` | scaffolds mostly withdrawn, silence carries more |

**Withdrawing scaffolding across a course is a profile swap** — not a renderer change and not a
re-authoring pass. Do not restate profile numbers on nodes. A node may override exactly one value,
`captionDelayMs`, and only where that single beat genuinely needs a different caption lead; say why.

**Per-node fields.** `glossPolicy`, `slowSL` and `stallHandlers` arrive from the design (2a › Skeleton);
what each one *is* is defined once, in **What the format can do** (2a). One field is yours, because it is
catalog bookkeeping rather than content:

- `learnables` on **every** node, npc included — the catalog ids that line is made of, which is what the
  per-line difficulty band counts (docs/dialogue-difficulty-model.md §3). On a client node the same field
  is the attempt allowlist; on an npc node it is description only and credits nothing. A beat whose
  expected utterance is the learner's own name carries `[]`.
**The learner's prompt is DERIVED, never authored.** At the moment a turn opens, the server surfaces the
upcoming **client** node's own line as the prompt (`server.ts`, `/api/scene`). Two consequences for
authoring: a client node's `sl` is what the learner sees as their target, and its **`en` is that line's
translation** — the meaning, and nothing else. `en` is the field that withdraws (`"after"` → `"tap"`), and
withdrawal only works on a meaning: a learner graduates off knowing what a line means, never off being told
how to assemble it. **The one exception is a turn with no Slovene stem** (a bare `"___"`, the learner saying
their own name) — there the English is all there is, so it carries the beat alone and is written as an
instruction.

Where a beat needs the learner *told what to do*, that instruction belongs in the node's `soften` rung. An
instruction that has migrated into `en` is a signal to look at the beat itself — if the turn is not obvious from the character's
Slovene and the ladder behind it, the npc node before it is what needs fixing.

**Check that openers and closers are distinct across levels.** Each level needs its own `n1` opener and its own terminal closers — one greeting or one closing reused as every level's reads monotonously *and* collapses to one audio clip (the audio key excludes the delivery tag, so same `sl` + same voice = one clip, first-built wins — a character's `deliverySL` only lands on lines whose `sl` is unique to that voice). A repeat goes back to 2b. `lint:dialogue` warns on any delivery collision that slips through.

**Writing for the ear.** For an `advance: "audio"` scene, assume the learner is listening, not watching.
Write so that:

- **The situation is one that talk carries by itself.** Meeting someone, asking for something, sorting out
  a misunderstanding, making a plan. Situations that turn on handling objects, moving around, or noticing
  things are hard to hear.
- **People say what they are doing,** the way they actually do in life — "I've left my keys inside", "hang
  on, I'm getting my coat" — so the learner never has to picture anything to keep up.
- **There are few enough voices and threads to hold in your head.** Two speakers, one place, one thing
  going on.
- **Every line hands over clearly.** After each one, the learner knows what just happened and whether it is
  their turn.

**The test:** read the lesson through with your eyes shut. If it only makes sense once you add a subtitle,
a picture, or a sentence explaining what something looks like, the lesson is not right for this format.
Change the lesson, not the packaging — find a situation that stands up in speech.

**The exception:** lessons whose subject genuinely is visual — appearance, colour, describing a person or a
place, the language of looking and pointing. There the description *is* the material, so it belongs.
Anywhere else, reaching for a visual description is a sign the situation was chosen badly.

**Beginner scaffolding — the ladder, and what the slot may contain.** For an `advance: "audio"` beginner
level these are construction rules, not polish:

- **Nothing reaches a slot that has not been heard.** Every client `sl` is either voiced **verbatim** by an
  npc node earlier in the same level, or is a **known word swapped into a shape** voiced seconds earlier.
  Introduce anything new on the full ladder — heard inside a sentence → heard on its own → heard slowly
  (`slowSL`) → in the slot. Skipping the isolated pass leaves a beginner unable to find the word boundaries.
- **Never elicit a form that has not been modelled.** Hearing *govoriš* licenses saying *govoriš*. If the
  lesson wants a second-person form, the character says it first, with a filler in it, on the full ladder —
  that is a rung to build, not a reason to avoid the form (stage 0 › the one new shape).
- **The slot always carries Slovene; it is never empty.** An empty slot risks the learner producing nothing,
  which is the failure state — not the advanced one.
- **Keep a slot filler to ONE word, and voice the frame with a filler in it.** This looks like a detail and
  is not: at stage 11 `voice-key-phrases` may only substitute inside a declared slot, and only word for
  word, so a client line whose filler is two words (`Kako se reče thank you?`) can never be voiced from a
  delivery whose filler is one — the phrase silently loses its play button, and nothing fails to tell you.
  Same trap if the character only ever utters the frame unfilled. Decide it here, where it is free.
- **Gloss withdrawal is a `glossPolicy`.** A client line the learner produces for the first time carries
  `"after"`. The same line later carries `"tap"`, held until they ask for it.
  The Slovene stands in the slot every time. Where a line has a Slovene stem, its `en` is that line's
  translation.
- **A slot may offer a choice, and the choice branches.** With no microphone this is the only way a spoken
  scene can branch on what the learner chose to say. Prefer branches where the "wrong" answer earns *more*
  practice — the character nudges and the shape gets said twice.
- **`focusSpan` marks the shape and each of its variations**, in every caption they appear in, the
  character's included. It is a family, not one string, and it is what does the segmenting a beginner
  cannot do for themselves.
- **The character only says what is true for him** and natural for a person in this situation. He does not
  greet a stranger he has met, does not announce a language he obviously speaks, and does not talk like a
  textbook. He may quote a line *for* the learner ("Reci: …") or guess at their line aloud — both are what
  a helpful local actually does.

### 3 — Language authoring (J → LS), one subagent PER LEVEL, in parallel
Dispatch **`slovenian-author`** (dialogue mode) once per level, concurrently — each gets the situation, register, voices, and that level's node map (speaker + `intentEN` + `next`). Each returns `{ level, nodes:{id:{sl,en,deliverySL?,slowSL?,deliverySlowSL?}}, catalogDelta:{reuse,new}, concerns }`. Start on the default model. **LS never returns stall handlers** — those carry no Slovene.

For an **`"audio"` scene**, the dispatch also names which nodes you marked for `slowSL` — LS writes the chunking (where a native would actually break the phrase, a language judgment) **and a `deliverySlowSL`**, because a ` … ` separator alone does not slow the voice down. Tell LS the register, that the client nodes are what the **learner** will say aloud, that a client node's `en` is shown to the learner as their prompt, and — quoted in full — **Writing for the ear** from stage 2c.

### 4 — Sanity pass (J, C)
Quick read against the rubric: native-not-textbook? register consistent? client lines carry the learner's gender? no npc-only line minted in a delta? branches re-converge coherently? If something's off, **re-dispatch that level's LS with the specific note.**

### 5 — Independent critique (J → critic)
Dispatch **`scenario-critic`** (dialogue mode) over ALL levels' trees + deltas at once. It returns `{ verdict, fixes:[{level,nodeId,field,oldExact,newExact,reason}], deltaFindings, convergenceReviewed, notes }`. Its `fixes` are the **structured, addressed** edits the reconcile applies; its `deltaFindings` flag mint/reuse problems. If a `deltaFinding` is `block`, route it back to LS (stage 3) and re-critique.

**For a beginner `advance: "audio"` level, the critic must also rule on four things a linter cannot.**
**Heard-first:** walk the level in order and confirm every client `sl` was voiced verbatim by an earlier npc
node, or is a known word swapped into a shape voiced seconds earlier — and that **every elicited form was
modelled**, with a filler in it, on the ladder. Flag a level that elicits a form it only implied. A form in
a person the learner has not produced before is fine where the character voiced it first: that is the same
shape on a new rung, not a second shape (stage 0 › the one new shape). **Character truth:** does the
character only say things
true for him and natural for a person in this situation? That single question catches the failures a
structural gate never will — greeting a stranger he has already met, announcing a language he obviously
speaks, or a learner re-introducing themselves unprompted to someone who knows them.
**Written for the ear:** read the level as if you could only hear it. Does every beat make sense from the
words alone, and at each hand-over is it clear that the turn is the learner's and what they should say? A
beat that needs a subtitle, a picture, or a description of what something looks like does not fit the
format — say so.
**The on-ramp:** does `frameEN` frame *this* lesson — not lessons in general? Does it promise anything the
level does not deliver? Is every line legible to someone who has never seen the app before?
**The gloss is the meaning:** every client `en` is that line's translation and nothing else — the sole
exception is a turn with no Slovene stem, where the English carries the beat alone. Where an `en`
*instructs* — quotes a Slovene fragment back, says "plus", or tells the learner how to assemble the line —
return a fix rewriting it as the plain translation. **Then look at the beat it came from.** An instruction
in the gloss is a symptom: it is there because the turn was not obvious without it, and it lets a thin
heard-first rung pass by telling the learner in English what they should have been able to retrieve from
sound. For each one, say whether the beat still hands over clearly with the instruction gone — and where it
does not, name the npc node that should have made it obvious and what it is missing.

### 6 — Assemble the reconcile input (L, C)
Write the reconcile input (draft path while unapproved; shape in docs/authoring-pipeline.md): the `scenario` header, `dialogueVoices`, `dialogueAdvance` (omit for `"tap"`), `dialoguePacing` (spoken scenes; omit to keep whatever the file already carries), the `levels` (each with `levelLabel`, `title`, an optional `background` filename and `frameEN`, `objectives:[{label,descriptorEN}]`, `root`, `nodes` merged from LS's `sl/en/deliverySL/slowSL/deliverySlowSL` plus the J-owned `glossPolicy/stallHandlers/learnables`, and `catalog:{reuse,new}`), the critic's `criticFixes`, and — folding A1 in (D5i) — `a1Candidates:[{learnableId,competencyId,note}]` proposing where each NEW learnable sits in the A1 map (competency ids from server/catalog/a1-map.json). You assemble only: every `sl` came from LS, and every English string the learner reads — the on-ramp, the soften labels, the objective descriptors — came from 2a/2b.

- **Mint-once across levels:** a learnable shared by several levels goes in `new` on **exactly one** level (its first use) and `reuse` on the rest. The same id under `new` twice makes the reconcile fail on a duplicate surface — split it here.
- **`background`** (optional): a per-level portrait image filename under `public/backgrounds/` (operator-supplied art, `<scenario>-<level>.jpg` or descriptive). The reconcile writes it onto the level and **preserves it on re-run**. The reconcile input is the source of truth for a level's nodes — a re-run rewrites the file from it, so make later node changes here and re-run, not by hand-editing `server/dialogues/*.json`.

### 7 — Reconcile deterministically (L)
`npm run reconcile:dialogue -- authoring/dialogues/<scenarioId>/reconcile-input.json` (the approved input, moved into place). It normalizes kinds, dedups (fail-loud on a duplicate surface — if it fails, the semantic dedup slipped; fix the delta upstream and re-run), assigns ids + `introduces`, applies the critic's exact fixes, writes the dialogue files + the manifest, merges the catalog, and emits `a1-candidates.json`. Idempotent — safe to re-run.

### 8 — Gates (L) — all must be green, no generation
`npm run lint:dialogue && npm run lint:tree && npm run lint:a1 && npm run test:dialogue`, then `npm run lint:audio -- <scenarioId>` **for information only at this stage** (see below). Fix any failure by routing it to its stage (a duplicate surface → LS reuse; a convergence node → re-check with the critic) and re-run. `lint:tree` will LIST the convergence nodes to eyeball — confirm each reads on all paths; `lint:dialogue` may WARN on a delivery collision (a shared `sl`+voice with differing delivery) — resolve by making the line textually distinct (stage 2c/3) if the delivery matters.

**`lint:audio` — read it here, enforce it at stage 11.** A level still carrying `audio: "ready"` from a previous build while this run re-authored one of its lines is the dangerous state: a missing clip does not error at runtime, it makes the scene play **silent and too fast** (`/api/speak` 502s, the `<audio>` fires `onerror`, and the renderer's `await sceneSay(...)` resolves instantly, collapsing every pause whose length came from the clip). At this stage the run has not generated anything yet, so treat the output as the **clip budget**: it names exactly which clips are missing, and — crucially — which are **re-keys** (bytes already paid for under an old provider/voice/model tag; copy them, never re-synthesize) versus genuinely new synthesis that will bill. Carry those two counts into the stage-9 ReviewPackage so R approves a known cost. A level that is honestly `"pending"` is never a failure.

**`lint:a1` + the bands:** `lint:a1` gates on `a1-map` ref-integrity and otherwise **reports** — the per-dialogue band, and which minted items sit in the tagged superset vs the curated core. New A1 material is already tagged `a1: true` at mint (stages 3/5/7), which is all the classifier needs, so nothing is folded to green the gate. Read the band report: **the computed band is what each level ships.** Where a level was *aimed* at Basic but computes Intermediate, evaluate per [dialogue-difficulty-model.md §7](../../../docs/dialogue-difficulty-model.md) — either revise it toward already-core survival language (route to LS/2–3) so it legitimately reaches Basic, or, if it genuinely rests on a few very-high-leverage items the core lacks, **keep the computed band and carry a core-promotion recommendation** into stage 9.

### 8b — Wrap-up: catalog proposals (L + J)

Two questions, answered every run. The operator owns both calls; this stage produces proposals.

**(a) What did these levels put in the learner's ear that the catalog lacks?** Walk every `sl` on every
**npc** node just authored. Fold inflections to citation form (`babici` → `babica`) and drop what an
existing id already covers.

**(b) Does anything here belong in the core?** Consider the items minted this run and the `a1: true` items
these levels lean on. Recommend one only where it clears the bar the core exists to protect — **very high
frequency AND broad unlock leverage, essential survival language.** Name the bands promotion would
recalibrate; "none" is the usual answer and worth saying. An empty list is a common and correct answer.

**Both go to stage 9 as a short list in the terminal.** The operator reads this where they are standing and
answers in one line. One item per line: the citation form, its **English gloss** (the operator decides
without reading Slovene), where it came from, the shortest true reason, and a verdict word. Sort by verdict
and collapse the weak tail onto one line. Where a list is empty, say "none". The shape:

```
Catalog candidates — npc words with no existing id:
- `babica` grandma — L7–L10, 13 lines. Learner asked for this word themselves in L7. Catalog has no
  grandparents. worth it
- `pecica` oven — L10, the deliberately-unknown word. maybe
- `potica`, `dedek` — weak
- `teta`, `spet` — throwaway

Core promotions — both from this run's mints, currently `a1:true core:false`:
- `iti` — suppletive (`grem` vs `iti`), every modal takes it, `grem_v` already core.
- `se_vidiva` — one of the commonest spoken farewells.
Neither changes a band today.
```

These are two lists the operator says yes or no to.

### 9 — Submit the ReviewPackage (L, C) — PR semantics
Present R: the per-level objectives, **the design this lesson was built on** (the `learning-designer`'s `built_on` + `why_it_teaches_best`, what it took from the other two and what it left behind, plus one line on each design not built on — a headless run never hides that there was a fork), the trees (with English intent + LS's Slovene + delivery tags), the catalog delta (reused vs newly minted, with each new item's gloss + predictable error), the computed `introduces`, the **computed band per level** (and, for any level whose band differs from its aim, the §7 evaluation), the **stage-8b wrap-up**, in the terminal shape that stage gives it — both lists, every run, any `lint:dialogue` delivery-collision warnings and how you resolved them, the convergence nodes the critic reviewed, and the green lint/test output. State the register + voices explicitly and invite R to confirm or override.

**Attribute every learner-facing string.** The on-ramp, each stall's soften label, each tutorial line, each
objective descriptor: name the stage that wrote it (2a/2b for design copy, 3 for Slovene). **A string
attributed to C is a defect** — report it as one and say which stage should have authored it, rather than
shipping it quietly.

### 10 — Review gate (J, R)
R replies **approve** or **reject(notes)**. Do not generate audio before approve. On reject, route each note to its stage (language → LS/3; a branch → 2; a mint → LS/3 + reconcile), re-run 6–8, re-submit.

### 11 — On approve: apply promotions + generate audio (L + operator)
- **Core promotions (L):** if R approves any core-promotion recommendation from stage 9, add those ids to `server/catalog/a1-map.json` and re-run `npm run lint:a1` — the affected bands recalibrate (a Basic-aimed level that was carried at Intermediate now lands Basic). Items R does not promote stay in the tagged superset via their `a1: true` tag; nothing else changes. The operator owns the core; the run never grows it on its own.
- **Audio (G):** `npm run build:dialogue-assets -- <scenarioId> [--level n]` (lines) + `npm run build:dialogue-intros -- <scenarioId> [--level n]` (intro monologues). Each is **preflight-gated** (fails fast if a voice binding is unset — D7ii), idempotent, and billed only for new clips; the line build flips a clean level `audio: "pending" → "ready"`. **Interactive:** the operator runs these. **Headless:** run them as part of the flow (operator intent assumed). For a cheap pre-commit voice/delivery check, `build:dialogue-assets --nodes <id,id>` auditions a few lines without flipping `ready`.
- **Verify the generation landed (L) — REQUIRED, and the run is not done until it is green:** `npm run lint:audio -- <scenarioId>`. This is the only check that a level claiming `audio: "ready"` actually has its bytes; every other gate inspects JSON, not the store. **A headless run must not report success until this passes**, because the failure it catches is invisible at runtime — a missing clip makes the scene play silent and too fast without ever erroring, so a run that skipped it would report a working lesson that is broken for every learner. If it fails: generate the named clips, or re-key the ones it flags as already-paid-for, or set the level back to `audio: "pending"` so the state is at least honest. Never mark a level `"ready"` to make this pass.
- **Hand off to `voice-key-phrases` (J) — a spoken level is not finished until its Key Phrases have play buttons.** A level that reaches `audio: "ready"` has a close screen listing the lines the learner produced, and every one of them is **silent**: their lines are never synthesized, so the button can only replay the character modelling the phrase — and nothing has chosen which delivery yet. Left undone this ships quietly: the screen renders, the phrases are there, they just do nothing.
  ```
  npm run build:alignments -- <scenarioId>     # measures the clips already on disk — never synthesizes
  ```
  then invoke the **`voice-key-phrases`** skill for the levels just built. It generates nothing and bills nothing (forced alignment reads the existing bytes), so it is safe to run as part of the flow. **Interactive:** offer it; the operator approves the spans. **Headless:** run it, and carry its no-button decisions into the final report — a phrase with no honest source is a correct outcome, not a failure.
- **Ship the audio (release):** line clips land in the gitignored `assets/audio/` store, force-committed for a deploy (`git add -f assets/audio`); intro clips land in `public/intros/` and ship as normal git-tracked files. Alignments live beside them in `assets/align/` and ship the same way. See docs/DEPLOY.md for the ship + serve-env contract.
- **Restart the server** to load the new JSON (data loads only at startup — D7i).

## Scope (do not add)
No guided-live runtime, no A1 scoring engine, no auto-competency assignment (candidates are operator-confirmed), no manifest consolidation beyond the `surfaces` block. Don't touch create-scenario. Audio is always a separate operator step.
