---
name: create-dialogue
description: Author a rehearsal-dialogue package for a lango-slovenian scenario — the branching npc/client trees (N levels), their catalog learnables, and the scenario manifest — take it through an independent critic and the four deterministic gates, and present it PR-style for approval. Audio and the approval itself belong to the operator. Use when the user wants to add or extend a scenario's click-through rehearsal dialogue (café, bakery, pharmacy, …) or says "create a dialogue", "author the rehearsal trees", "add levels to <scenario>". This is the `dialogue` surface of the authoring engine (see docs/authoring-pipeline.md); it mirrors create-scenario's author→critic→reconcile→gated-generation shape for the branching-tree surface the MVP practices.
---

# create-dialogue — the rehearsal-dialogue orchestrator (the `dialogue` surface)

You are **C, the Creator/Orchestrator** for the rehearsal-dialogue surface. This skill IS the operating
procedure. You assemble each stage's brief from what the stage before it returned, dispatch the subagents,
drive the deterministic **reconcile** script for every file write, run the gates, and put the result in
front of R.

**R is the operator** — one person: the human who started this run, who answers the stage-8b lists, who
approves at stage 10, and who runs generation. "R" and "the operator" are the same party throughout this
file.

Read **docs/authoring-pipeline.md** (the engine model + the J/L/G lanes) and
**docs/rehearsal-dialogues.md** (the data model, the tree template + sizing, the minting rubric, the
voice/env matrix) before you start — they are authoritative and win over anything here.

## The three lanes (never blur them)

- **J — Judgment (content):** the scene, the per-level objectives, the branching graph (ids + who speaks +
  the English intent per node + where branches re-converge), and **every word the learner reads or hears**.
  Done by `lesson-designer` ×3, `learning-designer`, `slovenian-author` (LS), `review-lesson-script`,
  `scenario-critic` and — where the reading and the critic show the lesson is badly wrong —
  `lesson-editor` (E).
- **L — Logic:** id assignment, catalog merge, `introduces` computation, file writes, the structural +
  catalog + a1 lints. Done by **scripts** (`reconcile-dialogue`, `lint:*`), never by hand.
- **G — Generation:** per-speaker audio bytes. `build:dialogue-assets` / `build:dialogue-intros` —
  **operator-run, on approval only** (AGENTS.md › Conventions; authoring-pipeline.md › D7). Trees ship
  `audio: "pending"` out of this skill, every run.

**Golden rule:** the designers propose how the lesson teaches; the learning-designer returns the design
that gets built, complete; C transcribes it and moves it through the pipeline; LS writes the language; a
reader hears it as a conversation; the critic rules; where the lesson is badly wrong the editor fixes it
outright; the reconcile assembles/mints/writes; R approves and generates.

## One pass — each stage decides once, and the run moves forward

The pipeline is a line: designs → language → reading → critique → editorial repair where it is called for
→ reconcile → gates → R. **Each stage is entered once and owns its decision.** Whatever it hands on is
what the next stage works with.

Authorship travels with the run and lands in one place at a time. The designers own how the lesson
teaches, and their work is finished the moment LS writes it. From there the lesson belongs to whoever
holds it: LS writes the language, the reader reports how it lands, the critic rules, and **the editor
holds final authorship**.

**Stage 5b — `lesson-editor`** is where a lesson gets repaired. It has wide discretion: it may rewrite
any line in either language, cut or add a beat, move where a word is introduced, or reorder the spine, to
make the lesson work for the learner. Serious problems found by `review-lesson-script` or by the critic
are its remit, and it gets one pass, like every other stage.

Keeping one author at a time is what keeps a run converging. When a lesson can return to an earlier stage,
each pass repairs the previous pass's damage and the lesson drifts while the work looks like progress.

**C owns the finish line.** A lesson is done when nothing reads as `broken`, the friction that remains is
either inherent to teaching or named as such, and the deterministic gates are green. When that holds, it
goes to R. A blind reader asked for findings will always return findings — including ones its last fix
created — so a silent reader is a mirage rather than a target, and C calls the finish from the state of
the lesson instead of from a reader's verdict.

### The two things C owns, and the line that separates them from J

- **C never writes a string the learner reads or hears.** Not the on-ramp, not a stall's soften label, not
  a tutorial line, not an objective descriptor. If a learner-facing string has no author, re-dispatch the
  stage that owns it. Do not fill it as C.
- **C fixes the one new shape** (stage 1). A shape is a sentence *frame*, never a string, and it is derived
  from the objectives R gave — it is a budget decision, not content.
- **C attaches `learnables`** (stage 2c). These are catalog ids, never prose. The join is mechanical: an id
  is either in LS's `catalogDelta` for that level or already in `server/catalog/learnables.json` under a
  citation form the line contains. Anything C cannot join to one of those two sources is a gap — route it
  to LS (stage 3) or to stage 8b(a); do not invent an id and do not leave the line untagged silently.

Everything else on a node — `sl`, `en`, `glossPolicy`, `slowSL`, `stallHandlers`, `focusSpan`, `frameEN`,
`tutorial`, objective labels — has an author upstream of C.

### C composes briefs; C does not steer them

A brief C composes carries what the stage before it returned and what R asked for — not C's preference for
a scene, a device, a phrasing or a tone. Steering looks like: an example that is really a suggestion, or a
constraint R never set. Where C believes a direction is right, it goes to R as a recommendation at stage 9;
where R has set one, it is followed exactly.

**Shuffling the reasons list is de-biasing, not steering.** An author reading a stable list pulls every
lesson toward its first few entries, so the three briefs get three different orders. The check: no two of
the three briefs may open on the same entry.

## What the input is

Manifest-shaped: a scenario package — situation / register / role / voices — plus the levels to author.
The tree is the canonical **scene-script** (authoring-pipeline.md › D3): the same nodes a future
guided-live mode will consume, so keep npc lines as clean scene beats and client choices as clean expected
productions.

## Interactive vs headless

| | **interactive** | **headless** |
|---|---|---|
| What it means | R is present and answers during the run | R is not reachable during the run |
| Stage 2b | R sees the three sketches and may override the choice | the learning-designer's design stands; stage 9 reports the two not built on |
| Stage 8b | R answers the two lists in one line | the lists go into the package unanswered |
| Stage 10 | R approves or rejects; the loop continues | **the run ends here.** The deliverable is the gated package plus the exact commands stage 11 would run |
| Stage 11 | R runs it | never reached |

**A headless run never generates audio, never promotes into the core, and never reports a spoken lesson as
finished.** Approval and generation are both R's; a run with no R present stops at the gate.

## Guardrails (every stage)

- **Trees ship `audio: "pending"`.** Nothing in this skill synthesizes.
- **Catalog: mint once by id, dedup by canonical `sl`.** Reuse existing ids; the reconcile FAILS on a
  duplicate surface — fix the delta upstream, never by weakening the guard.
- **The deterministic gates are the only hard stops.** Where the run's aim meets a convention (growing the
  A1 core, a lesson that lands a band above its aim), ship the convention-honoring output and carry a
  firm, specific recommendation into the ReviewPackage — see
  [dialogue-difficulty-model.md §7](../../../docs/dialogue-difficulty-model.md#7-operating-headlessly--conventions-hold-deviations-become-recommendations).
- **Scope discipline.** No guided-live runtime, no A1 engine, no auto-competency assignment. Don't touch
  create-scenario.

---

## Procedure

**The decision line** — quoted by name into the 2a and 2b briefs:

> For every decision, ask what the best expert in that field would do and why they would reject your
> current choice; if you can name that reason, don't make the choice. Optimize for what that expert
> would judge correct, never for what satisfies the stated constraints most cheaply.

Work on a DRAFT under `.scratch/dialogue-drafts/<scenarioId>/` — nothing is written into `authoring/` or
`server/` until R approves (PR semantics). On approval the reconcile input moves to
`authoring/dialogues/<scenarioId>/reconcile-input.json`, where it is committed source; everything else in
the draft dir is working material and stays behind.

### Terms this file uses

- **Citation form** — the form the catalog mints in: vocabulary = nominative singular lemma; pattern = a
  frame with `___`; chunk = the fixed phrase (rehearsal-dialogues.md › The minting rubric). `babici` →
  `babica`; `žepu` → `žep`; `Rada bi` → `rad_bi`.
- **Unit** — a word or a frame: the size of thing that goes in a slot.
- **Substantive node** — an npc node carrying new information or prompting something different. A node
  that re-says a phrase slowly, confirms, praises or nudges the learner onward is real and playable but is
  **not** part of the turns : nodes ratio (AGENTS.md › Lesson shape).
- **Predictable error** — the one mistake a beginner reliably makes with that catalog item. One per minted
  learnable; it is a property of the item, not of the line.
- **`tutorial`** — an optional per-level list `[{ target, text }]` teaching the four run controls, shown
  before the level's first line. `target` is one of `slower` · `back` · `skip` · `quit`
  (`server/dialogues.ts` › `TutorialTarget`); `text` is one short English sentence saying what that control
  does. Learner-facing prose, so it is authored at 2a, never by C.

### 0 — Lesson ingredients (L) — before any authoring

Answers to **AGENTS.md › How the lessons teach**. Read it first; it is the law this stage applies. This
whole stage is extraction from files already on disk — **no script emits it; C reads the dialogue JSON**.
Nothing here is judged.

**Which levels to read.** This scenario's `advance: "audio"` dialogues with a `level` below this one, the
**five highest** of them (`server/dialogues.ts` groups by `scenarioId` and sorts ascending by `level`; it
is the ordering the close screen's Next-lesson button walks forward — `nextLevel` in `server/server.ts`).
Fewer than five exist → take all that exist. None exist (this is level 1, or every prior level is
`advance: "tap"`) → the ledger and the cloud are **empty, and the brief says so in as many words**. An
empty ledger is a normal first lesson, not a fault.

**The computed ledger:**

- **Said before** — every catalog id appearing in `learnables` on a **`client`** node of those levels, with
  which levels produced it. Client nodes only: those are what the learner said aloud, the same rule the
  runtime credits by. Mark which entries are **facts about the learner** — their name, where they are
  from, what they speak. Those are what the character may remember and raise; he has no reason to bring up
  the rest.
- **Heard-only set** — ids appearing on `npc` nodes that have never been in a slot.
- **Held lines** — what earlier levels left unglossed (`glossPolicy: "held"`). This level's material may
  make one of them land.
- **Not yet reused** — from Said before, every id the learner produced **only** in the lesson that
  introduced it and in no lesson since.

**The cloud** — from the same levels, handed over loose so a designer can build turns out of sound the
learner can already pick out:

- **The inventory**, as one flat pool of units:
  - every **catalog item** those levels used, npc and client alike, as `id` + citation form + gloss;
  - every **word the catalog has no id for**, folded to citation form.

  Put every unit from every level into **one list in random order**. Pooled this way each item sits at its
  true frequency, and a designer reaches for what serves the objective rather than for what a per-level
  grouping put on top.
- **A one-line synopsis of each level's objectives** — what it set out to teach.
- **A one-sentence narrative summary of each level** — what happened in it, so a designer can see which
  devices are already used.
- **The freedom block** (stage 2a), verbatim.

### 1 — Parse the brief, and fix the shape (J from R; the shape by C)

Fix from the brief — or, if the scenario exists, read its manifest and existing levels first and take them
from there:

- **The situation** — the scenario's standing setting: who the character is, what kind of place this is,
  what the learner is doing there. It belongs to the scenario and holds across every level. (What each
  designer invents fresh at 2a is the **scene**: the particular moment, the reason these two are talking
  today, what is in the room with them. Situation is the spine; scene is per-lesson.)
- **Register** — `ti`/`vi` + `pogovorni`/`knjižni`.
- **Tutor role** — a Slovene role noun (`natakarica`) or a named character id (`slavko`).
- **Voices** — `npc` + `client` catalog voice profiles.
- **Learner gender** — it fixes the first-person forms the client lines may take.
- **Advance mode.**
- **The levels to author** — each `levelLabel`, `title`, and its ordered **objectives** as EN meanings +
  the grammar point each teaches.
- A kebab/lowercase `scenarioId`.

Extending an existing scenario: new levels must not re-introduce covered learnables.

**The one new shape (C).** A shape is a sentence frame with a slot: `___ sem ___`, `Imam ___`,
`Ali si ___?`, `Rad bi ___`. Two utterances are the SAME shape when one is the other with a different
filler in the slot, **or the same frame carried by a different person, number, case or tense of the same
verb**. *Sem Slavko / Sem zmaj / Ti si človek* is one shape. *Govorim slovensko / ne govorim dobro
angleško* is one shape. `Imam ___` is a different shape from `Sem ___` — different verb, different frame.
A shape is NOT a string and NOT a paradigm cell.

**How to derive it:** it is the frame this level's objectives require the learner to **produce**. Read them
in order; the first that names a production names the shape. **If two objectives need two different frames,
the level is over budget** — do not pick one. Name both frames and hand the split back to R before
dispatching 2a.

**This is a budget, not a licence.** Every surface form the learner is asked for still has to have been
heard first, with a filler in it, on the full ladder. A person swap costs a rung of the ladder; it does not
cost the lesson its new shape.

**The advance mode picks the shape of the package** (docs/rehearsal-dialogues.md › Tapped vs spoken):

| | `advance: "tap"` — a rehearsal tree | `advance: "audio"` — a spoken scene |
|---|---|---|
| Shape | branching: npc → **≥2 client choices** → re-convergence, sized per the template | a **linear spine**, `next[0]` at every fork; extra entries are alternates a surface previews |
| Client nodes | canned lines the learner **picks** | what the learner is expected to **say**; each carries `learnables` (the attempt allowlist, possibly `[]`) |
| Band denominator | **every** node — a worked example is read end to end | **client nodes only** — the band is what the learner must produce |
| Arc | a real transaction: greeting → core exchange → closing | whatever the situation genuinely is; a relationship opener is as valid as an errand |
| Extra node fields | — | `slowSL` + `deliverySlowSL`, `glossPolicy`, `stallHandlers`, `focusSpan` |
| Timing | the learner's own finger | a **pacing profile** (`server/catalog/pacing.json`) — see 2c |

Set `dialogueAdvance` in the reconcile input to match. Absent ⇒ `"tap"`.

### The audio-only brief — Writing for the ear

**Quote this verbatim, first, into every content brief for an `advance: "audio"` level** — ahead of the
stage's own instructions, before anything else the brief carries. It goes to the three `lesson-designer`s
(2a), the `learning-designer` (2b), `slovenian-author` (3) and `scenario-critic` (5). **A tapped tree never
carries it** — a rehearsal tree is read as much as heard, and this standard would rule out situations that
are perfectly good tapped.

It is stated as properties of a spoken lesson rather than as instructions, so the same words serve a role
that chooses the scene, a role that writes the lines, and a role that rules on them.

> **The learner is listening, not watching.** One caption is on screen and nothing else can be relied on.
> A spoken lesson holds up when:
>
> - **The situation is one that talk carries by itself.** Meeting someone, asking for something, sorting
>   out a misunderstanding, making a plan. Situations that turn on handling objects, moving around, or
>   noticing things are hard to hear.
> - **People say what they are doing** — "I've left my keys inside", "hang on, I'm getting my coat" — so
>   the learner never has to picture anything to keep up.
> - **Two speakers, one place, one thread.**
> - **Every line hands over clearly.** After each one the learner knows what just happened and whether it
>   is their turn.
>
> **The test:** read the lesson through with your eyes shut. If it only makes sense once you add a
> subtitle, a picture, or a sentence explaining what something looks like, it does not fit the format. The
> fix is the lesson, never the packaging: a scene that has to be looked at gets replaced, not annotated.
>
> **The exception, and the test for it:** the subject *is* visual when the **learnable being taught** names
> appearance, colour, or the language of looking and pointing — describing a person or a place. There the
> description is the material and it belongs. Anywhere else a visual description is a sign the scene was
> chosen badly. The test is what the objective asks the learner to **produce**, not what the scene happens
> to contain.

What each role does with it — say which, in that role's brief:

| role | what it decides here |
|---|---|
| `lesson-designer` (2a) | picks a scene that passes it, and applies the visual exception |
| `learning-designer` (2b) | keeps the merged design passing it — a beat grafted from another design is where this breaks |
| `slovenian-author` (3) | writes lines in which people say what they are doing, and hands over cleanly |
| `review-lesson-script` (4b) | runs the eyes-shut test — it is given the lesson with the eyes already shut |
| `scenario-critic` (5) | weighs what that reading found against everything else it can see |

`lesson-designer` already carries the eyes-shut test in its own definition. The quotation is still the
brief's first block: it is the one standard all four roles are held to, and it is stated once, here.

### Writing for two learners — quote into every spoken brief

Slovene inflects a speaker's own words for their gender, so a spoken lesson is written for two learners at
once. **Quote this block into the same briefs as the audio-only brief** — the three `lesson-designer`s, the
`learning-designer`, `slovenian-author` and `scenario-critic`. It is stated as costs, so the same words
serve the role that shapes the scene, the role that writes the lines, and the role that rules on them.

> **The app knows the learner's gender**, because the onboarding lesson asks and it is stored. Lines may
> therefore be written in two forms (`variesBy` + `variants`), and the learner only ever meets theirs.
>
> Two of the three cases are free. One costs a second recording:
>
> - **A speaker about themselves** — *Jaz sem učitelj*, *Rada bi šla*. Free: that speaker's gender is
>   fixed by who they are. Write these without a second thought; they are how a learner hears the
>   feminine forms at all when the character is a woman.
> - **The learner's own lines.** Free: a spoken lesson never synthesizes them, so a variant is a second
>   caption and no clip.
> - **The character addressing the learner** — *Ti si študentka?*, *Koliko si stara?* **This is the one
>   case that forks a clip**, and both forms have to be recorded before the level can ship.
>
> **Keep the third kind few.** Most beats do not need one: ask *Kaj si?* rather than *Ti si študentka?*,
> answer *Tako je!* rather than echoing their noun back. Reach for a variant where the gendered line is
> doing teaching that nothing else can do — above all the **affirming echo**, the character saying the
> learner's own word back to them, which is one of the highest-value input moments a lesson has. Few is a
> budget, not a ban: spend it on the moment that earns it.
>
> Where the lesson is **teaching the pair itself**, both forms are the material — the character models
> each in turn and then asks. That is the shape the onboarding lesson uses, and those lines are his
> question rather than an address in a gender he has not been told.

What each role does with it — say which, in that role's brief:

| role | what it decides here |
|---|---|
| `lesson-designer` (2a) | whether the design leans on a gendered line from the character, and whether that line earns the second recording |
| `learning-designer` (2b) | keeps the merged design inside the same budget — a beat grafted from another design is where a fork appears unnoticed |
| `slovenian-author` (3) | writes the neutral phrasing where one exists, and both forms where the lesson wants the echo |
| `scenario-critic` (5) | names every character line that varies, and says for each whether it is worth a clip |

### 2a — Three designs (J), three authors, in parallel

**The objective is always given** — by R directly, or by the syllabus the brief carries. The three designs
are three ways to teach *one* objective; they never propose different lessons.

Dispatch **`lesson-designer`** three times, concurrently and **blind to each other**.

Every brief carries, identically:

- **The audio-only brief** (above), quoted verbatim and **first**, for a spoken level. Name what this role
  decides with it: it picks a scene that passes the eyes-shut test, and it applies the visual exception.
- **Writing for two learners** (above), quoted verbatim, for a spoken level — so a design that turns on a
  gendered line is costed while it is still a design.
- **The shape** (stage 1) — the whole of what is fixed for a designer.
- **The settings** (stage 1) — advance mode, register, the two voices and which is the learner, the
  learner's gender, the role, and the standing situation.
- **The computed ledger** (stage 0) — said before · heard-only · held · not yet reused. Say plainly where
  a list is empty.
- **The cloud** (stage 0) — the shuffled inventory, the objective synopses, the narrative summaries.
- **The decision line**, quoted verbatim.
- **This block**, quoted verbatim:

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

- **What the format can do — both modes.** Quoted verbatim into every brief:

  > - `glossPolicy` says when the learner sees a node's English: `"tap"` (click to reveal), `"after"` (it
  >   follows the Slovene on its own), or `"held"` (the situation carries the meaning here).
  > - **One node is one caption — one thing on screen.** Two sentences that want different captions or
  >   different timing are two nodes.
  > - **A phrase is said twice only to lift it out of what surrounds it.** Where the target is buried in a
  >   sentence of three or more other words, the isolated repeat rides the same node — said inside the
  >   sentence, then again alone, is one node, and counts once toward length and the split. Where the
  >   phrase already stands alone or carries one or two words of company, it is heard once and moves on.

- **What the format can do — `advance: "audio"` only.** Quote this block **only when the level is
  spoken**; a tapped tree has none of these fields and a brief that carries them invites a design that
  cannot be built:

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
  > - There is no microphone. The turn cannot be failed and nothing inspects what the learner says.
  > - A spoken level is a linear spine; `next[0]` is the path. A "branch" lives in the slot, not the tree.
  >   `lint:tree` errors on any node off that spine — it would never be played and would still bill for a
  >   clip.
  > - **The learner meets sound and one caption.** A delivery tag (`[brightly, as if meeting again]`) is
  >   authoring metadata that reaches the synthesiser and stops there, and the caption glosses what is
  >   said. So a beat carries its meaning in the words, the voice, and the silence around them — a scene
  >   that changes frame says so in Slovene the learner already owns, or it happens in a lesson that has
  >   the words for it. Design each beat so it reads with the tag deleted.
  > - `focusSpan` marks the shape inside a caption. It must occur **exactly once** in that node's `sl`.
  > - The four run controls (🐢 « » ✕) are on screen throughout, and a level may teach them with
  >   `tutorial: [{ target: "slower"|"back"|"skip"|"quit", text }]` before its first line.
  > - A beat may **ask the learner one thing about themselves** — `choice: { fact }`, on an npc node. It
  >   hands the turn over as one button per answer instead of one Continue, each button carrying a whole
  >   line the learner can say, and it stores the answer. The upcoming client line supplies the buttons
  >   through its own `variants`. This is a lesson's only way to learn anything about the person, since
  >   nothing listens. Skip is dimmed there; the beat cannot be stepped past.
  > - **Write that beat as a conversational turn, not a question to the learner.** Model the forms first —
  >   both in one line, so they are heard as a pair — then hand over by reciprocity (*Jaz sem učitelj. In
  >   ti?*) or by any ordinary offer. The buttons already say what the answers are, so the line above them
  >   is free to teach a shape rather than spend the turn asking *"which are you?"*.
  > - What the learner is being asked to DO with the buttons is `chooseEN` on the **client** node — one
  >   line above the options, on screen the moment the turn opens (a `\n` in it is a line break). It
  >   replaces the `soften` stall rung, which the loader rejects on a beat that asks: the same English,
  >   ten seconds later, in the same place. `pulse` and `respeak` still apply.
  > - Any line may then be said differently for that answer: `variesBy: "<fact>"` plus
  >   `variants: { "<value>": { sl?, en?, deliverySL?, slowSL?, deliverySlowSL?, focusSpan? } }`. A value
  >   with no entry keeps the line as authored. Text only — the turn, the `next` and the `learnables`
  >   belong to the beat. A variant that rewrites `sl` states its own `focusSpan` and its own `slowSL`.
  > - Facts are declared in `server/catalog/facts.json`; `gender` is the one that exists. A level that
  >   varies on a fact an earlier lesson already asked for declares `needs: ["gender"]` instead of asking
  >   again.

- **The reasons to repeat and improvise** (below), **shuffled independently for each brief**, with the
  three tests after the list, unshuffled, and the sentence that it is not a strict list.
- For a beginner spoken level, the **scaffolding ladder** (2c), quoted in full.
- **The two sizing paragraphs** (below).
- **The questions the designer answers** (below) — asked as questions, never pre-answered.

#### The reasons to repeat and improvise

In-fiction reasons the shape comes back. Play is always lighthearted and never at the learner's expense.

- **He asks about a second thing.**
- **Reciprocity — "In ti?"** The most common turn in conversation. It makes the learner's line an answer
  rather than a recitation, and it is free: he already said the shape about himself to model it.
- **Consequence.** The scene forks on what the learner said — which coffee arrives, which door, whether he
  keeps speaking Slovene. The line gets confirmed because it mattered. The anti-exercise reason.
- **He writes it down.** A form, an order pad, a phone contact. Reading back is what people actually do —
  *Ana? Z enim n?* Confirmation without putting an error in the ear.
- **Affirming echo.** He is pleased and says the learner's own line back, correctly. A native voicing what
  the learner just produced is the highest-value input moment in the lesson, and it costs nothing.
- **Task arity.** The job itself has three items — three fields, three people to introduce. The reps come
  from the task, not from his curiosity.
- **He's self-deprecating and invites the mirror.**
- **He is unsure he heard correctly.**

**Not a strict list** — say so in the brief. A reason that is not here is fine if it passes all three:

1. **It works purely as sound.** Stagecraft that has to be watched — an interruption, a passing bus,
   someone walking up — buys a repeat without teaching anything.
2. **It exists outside the lesson.** A person would do this with a fluent speaker.
3. **Constructive variation over rote.** If the shape can be varied for a rep, a variant is used instead of
   rote repetition.

#### What each designer answers (put these in the brief as questions)

- **The scene** — where they are today, why the two of them are talking, what the character is doing, who
  and what is in the room. Each design answers this fresh, and the three answers are the main axis along
  which they differ.
- **The variation plan** — how the shape gets worked, and how many turns that yields. Moves: answer it ·
  negate it · swap the filler · add a qualifier · hear it said back.
- **Which not-yet-reused ids come back** — each is a candidate: include it if there is a natural way to use
  it *differently* from last time. Where several fit, prefer the one longest unused. Where one is left out,
  give a reason that names a **conflict**: it would break the register, it would need a form this lesson
  has not modelled, or the only available use repeats last lesson's with no new angle. **"No room" and
  "didn't fit" are not reasons** — a reason has to name the thing that took the room.
- **The closing line** — what the character says as this conversation ends. It uses this lesson's material
  and reads as a person finishing a conversation.

#### Sizing — quote both paragraphs into every brief

Size against the level's band (AGENTS.md › Lesson shape). Beginner: 9–18 nodes, one new shape. Where in
the band it lands follows from how much play the shape offers, never from a length target. **Length is not
difficulty** (dialogue-difficulty-model.md › Decided specifics) — a longer design is not a better one.

**The split is a floor, not a target.** Beginner: at least two learner turns for every three substantive
npc nodes. Clear it, then improve on it wherever the rest of the lesson allows. The floor exists because a
beginner needs the situation set and the language modelled before they can say anything — it is what that
scaffolding costs, not what to aim for. The learner's own voice is the main event; every node above the
floor has to earn its place against a turn.

#### What each designer returns — a design sketch

English intent only, no Slovene, no per-node Slovene fields.

- **Premise** — one line: what happens.
- **Opening** — how the scene starts and what puts the new shape in play.
- **Ladder trace** — the new shape's exposures in order: heard in a sentence → heard alone → heard slowly →
  in the slot.
- **Retrieval schedule** — the distinct productions of the shape, and what sits between them.
- **Reasons used** — which, and where each fires.
- **Slot shape + fillers** — where the shape is a `pattern`, which of the three slot shapes is being worked
  (fill in the blank · fill in the blanks · sentence stem — docs/learnable-subsystem.md › the pattern kind)
  and which fillers pass through it.
- **Skeleton** — the node graph itself as `{ id, speaker, intentEN, next }`, plus per node its
  `glossPolicy`, whether it carries a `slowSL`, and its `stallHandlers` **with their English soften
  labels**. Then the count: **turns : substantive nodes**, against the floor. Prose alone ("4 turns : 6
  nodes") leaves the graph to be invented downstream, which is where a design stops being the design that
  was chosen.
- **Objectives** — `[{label, descriptorEN}]`, in the learner's language.
- **Reuse** — stale ids picked up and how each is used differently; ids left out with a conflict named.
- **Branch** — if any, and what each arm earns.
- **`tutorial`** — if this level teaches a run control, the steps with their English text; otherwise say
  none.
- **Closing line** — its job in this lesson.
- **Thinnest point** — where it is most likely to fail character truth or the ear.
- **The on-ramp (`frameEN`)** — the English lines shown before any Slovene, **written LAST**, after
  everything above is settled. It frames *this* lesson: where the learner is, what is about to happen, what
  they will be asked for, and that nothing is at stake yet. It is the only place the lesson may speak
  English freely, and it is what earns the right to withhold English once the character starts speaking —
  **a lesson may only withhold English on its first beat if it has first framed the situation.** An on-ramp
  written first frames a lesson that does not exist yet, and the lesson then bends to fit it.

Nothing is written to disk; the sketches live in C's context.

### 2b — Choose the lesson (J → learning-designer)

Dispatch **`learning-designer`** once, with all three sketches, the shape and the settings. For a spoken
level the brief opens with **the audio-only brief**, quoted verbatim, naming what this role decides with
it: the merged design still has to pass the eyes-shut test — a beat grafted from one design into another is
exactly where that breaks, and it is the only stage where a beat changes hands. Then the decision line and
this, verbatim:

> Your role is that of an optimizer and decision maker to guide the most masterful design.
>
> Gating functions and auditing for quality will occur later and be performed by other roles, you have
> the freedom to make sure this lesson is optimal.

It returns a **complete, buildable design** — not a verdict naming a winner:

```
{ built_on, why_it_teaches_best, taken_from_others:[{from,what,why_it_fits}], left_behind:[{what,why}],
  what_to_watch, nodes:[{id,speaker,intentEN,next,glossPolicy,slowSL,stallHandlers}], objectives,
  frame_en, tutorial, closing_line }
```

`frame_en` is the on-ramp being built — taken whole from one design, or assembled from named lines with a
reason per line. **If it comes back incomplete, send it back** — a missing piece is a gap in this stage,
not work for C.

**Interactive:** show R the three sketches and the returned design. R may confirm it, or name a different
sketch. **If R names a sketch the learning-designer did not build on, re-dispatch `learning-designer` with
R's pick as a fixed constraint** — it returns a complete design built on that sketch. Never transcribe a
raw sketch: a sketch is not a buildable design, and completing one is authoring.

**Headless:** the returned design stands, and stage 9 reports the two designs not built on.

### 2c — Transcribe the chosen design (J)

The design arrives complete — nodes, objectives, on-ramp, tutorial, closing line. This stage **transcribes
it** into the per-level shape the reconcile input takes and checks it against the format. It does not
construct it.

**If you are about to write something that did not come from a designer, LS or the critic, stop.** That is
a gap in the stage that owns it. C fixes nothing itself.

2b has not been read or ruled on yet, so this stage — and only this stage — may still ask it to complete
what it returned: **a design that is missing a piece, or fails a check below, goes back to 2b once.** That
is completion of an unfinished hand-off, not a redesign, and it is the last point at which the shape is
free to change. After stage 3 the run only goes forward; a problem found later is the editor's (5b).

**Checks:**

- **The graph is well-formed for its advance mode** (stage 1's table), against the template in
  docs/rehearsal-dialogues.md: `root` is an `npc` node, every path ends at `next: []`, and a tapped tree's
  branches re-converge onto shared later nodes.
- **Every objective is demonstrated on a reachable path**, and the objectives are distinct across the
  scenario's levels.
- **The count clears the floor** (2a › Sizing). **Below the floor goes back to 2b.** Sitting *exactly* on
  the floor is a pass — the floor is the minimum, and a gate that rejects a compliant design is a broken
  gate. Where it sits exactly on the floor, name the npc node doing work a turn could do (a line the
  learner could say instead of hear, a confirmation they could give) and carry that note into the
  stage-9 ReviewPackage.
- **Openers and terminal closers are distinct across levels.** Each level needs its own `n1` opener and its
  own terminal closers. One greeting reused as every level's reads monotonously *and* collapses to a single
  audio clip — the audio key excludes the delivery tag, so same `sl` + same voice = one clip, first-built
  wins. A repeat goes back to 2b; `lint:dialogue` warns on any delivery collision that slips through.

**Audio timing is a PROFILE, not per-node numbers.** Every engineered silence in a spoken lesson lives in
`server/catalog/pacing.json` — the on-ramp dwell, the caption lead, the read pause, the gloss delay, the
hand-over, the close hold, the backchannel protection, and the stall ladder. Pick one with
`dialoguePacing`:

| profile | for |
|---|---|
| `onboarding` | hour zero, maximum room (the default when absent) |
| `guided` | the learner knows the format, still gets the slow re-speak |
| `brisk` | scaffolds mostly withdrawn, silence carries more |

Withdrawing scaffolding across a course is a **profile swap** — not a renderer change and not a
re-authoring pass. Do not restate profile numbers on nodes. A node may override exactly one value,
`captionDelayMs`, and only where that beat genuinely needs a different caption lead; say why.

**Per-node fields.** `glossPolicy`, `slowSL`, `stallHandlers`, `focusSpan` and `tutorial` arrive from the
design. C attaches `learnables` on **every** node, npc included — the catalog ids that line is made of,
which is what the per-line band counts (dialogue-difficulty-model.md §3), under the mechanical join rule at
the top of this file. On a client node the same field is the attempt allowlist; on an npc node it is
description only and credits nothing. A beat whose expected utterance is the learner's own name carries
`[]`.

**The learner's prompt is DERIVED, never authored.** At the moment a turn opens the server surfaces the
upcoming **client** node's own line as the prompt (`server.ts`, `/api/scene`). So a client node's `sl` is
what the learner sees as their target, and its **`en` is that line's translation** — the meaning, nothing
else. `en` is the field that withdraws (`"after"` → `"tap"`), and withdrawal only works on a meaning: a
learner graduates off knowing what a line means, never off being told how to assemble it. **The one
exception is a turn with no Slovene stem** (a bare `"___"`, the learner saying their own name) — there the
English is all there is, so it carries the beat alone and is written as an instruction. Anywhere a beat
needs the learner *told what to do*, that instruction belongs on a `soften` rung.

#### Beginner scaffolding — the ladder, and what the slot may contain

For an `advance: "audio"` beginner level these are construction rules, not polish:

- **Nothing reaches a slot that has not been heard.** Every client `sl` is either voiced **verbatim** by an
  npc node earlier in the same level, or is a **known word swapped into a shape** voiced seconds earlier.
  Introduce anything new on the ladder — heard → heard slowly (`slowSL`) → in the slot.
- **The learner must hear the target standing clear of its neighbours**, because that is what lets them
  find where it starts and stops. **How much work that takes depends on how buried it is.** A target
  carried inside a sentence of three or more other words gets an isolated pass — the phrase again, alone,
  on the same node — so it can be picked out. A target that already **stands alone, or sits with one or
  two words of company, arrives clear the first time and is said once.** *Živjo!* is heard once. *Adijo!*
  is heard once. *Sem Slavko.* is heard once. A line that repeats itself with nothing buried in it reads
  as a stumble or a tic, and the learner spends the beat working out what changed between the two copies.
- **Never elicit a form that has not been modelled.** Hearing *govoriš* licenses saying *govoriš*. If the
  lesson wants a second-person form, the character says it first, with a filler in it, on the full ladder —
  a rung to build, not a reason to avoid the form.
- **The slot always carries Slovene; it is never empty.** An empty slot risks the learner producing
  nothing, which is the failure state.
- **Keep a slot filler to ONE word, and voice the frame with a filler in it.** At stage 11
  `voice-key-phrases` may only substitute inside a declared slot, and only word for word, so a client line
  whose filler is two words can never be voiced from a delivery whose filler is one — the phrase silently
  loses its play button and nothing fails to tell you. Same trap if the character only ever utters the
  frame unfilled. Decide it here, where it is free.
- **Gloss withdrawal is a `glossPolicy`.** A client line the learner produces for the first time carries
  `"after"`; the same line later carries `"tap"`. The Slovene stands in the slot every time.
- **A slot may offer a choice, and the choice branches.** With no microphone this is the only way a spoken
  scene branches on what the learner chose to say. Prefer branches where the "wrong" answer earns *more*
  practice — the character nudges and the shape gets said twice.
- **`focusSpan` marks the shape and each of its variations**, in every caption they appear in, the
  character's included. It is a family, not one string, and it does the segmenting a beginner cannot do for
  themselves. It must occur exactly once in that node's `sl`.
- **The character only says what is true for him** and natural for a person in this situation. He does not
  greet a stranger he has met, does not announce a language he obviously speaks, and does not talk like a
  textbook. He may quote a line *for* the learner ("Reci: …") or guess at their line aloud — both are what
  a helpful local actually does.

### 3 — Language authoring (J → LS), one subagent PER LEVEL, in parallel

Dispatch **`slovenian-author`** (dialogue mode) once per level, concurrently. For a spoken level the brief
opens with **the audio-only brief**, quoted verbatim, naming what this role decides with it: LS writes lines
in which people say what they are doing, and every line hands over cleanly. It then carries **writing for
two learners**, quoted verbatim: LS reaches for the neutral phrasing where one exists, and writes both
forms where the lesson wants the echo. Each brief then gets the
situation, register, voices, and that level's node map (`speaker` + `intentEN` + `next`). Each returns
`{ level, nodes:{id:{sl,en,deliverySL?,slowSL?,deliverySlowSL?}}, catalogDelta:{reuse,new}, concerns }`.
**LS never returns stall handlers** — those carry no Slovene.

For an `"audio"` scene the dispatch also names which nodes are marked for `slowSL` — LS writes the chunking
(where a native would actually break the phrase, a language judgment) **and a `deliverySlowSL`**, because a
` … ` separator alone does not slow the voice down. Tell LS the register, that client nodes are what the
**learner** will say aloud, and that a client node's `en` is shown to the learner as their prompt.

### 4 — Routing read (C)

C reads the returned levels for: native-not-textbook; register held; a client line that is gendered
carrying its `variants` rather than one gender's form alone; no npc-only line minted in a delta; branches
re-converging coherently.

**This stage has no verdict, and nothing goes back.** It is routing, not judgment. Where C can state a
specific, addressed note ("`c3`'s `sl` is `vi` in a `ti` register"), it **carries that note forward into
the stage-5 critic brief** as its own observation. Anything C cannot name that precisely goes forward
untouched — the critic is the judge, and a vague note from C is C editorializing content.

### 4b — Read it as a conversation (J → `review-lesson-script`) — spoken levels only

The lesson now exists as lines. Before anyone judges it against a standard, someone reads it the way the
student meets it: as talk in a room, with nothing else.

Write the levels into the draft reconcile input now — the `scenario` header, `dialogueVoices`,
`dialogueAdvance`, and each level's `level`, `title`, `root` and `nodes`. This is the same file stage 6
completes; it is filled in two passes because the reading needs the nodes and the reading should happen
before the critique. Then invoke **`review-lesson-script`** per level:

```bash
npm run script:lesson -- --from .scratch/dialogue-drafts/<scenarioId>/reconcile-input.json --level <n>
```

Run the reader once per answer to any fact the level asks or declares in `needs` (`--as gender=f`), because
each answer is a different student hearing a different conversation. Keep each report whole — the per-beat
lines and the findings — and carry it into stage 5.

**C does not act on the report.** It is evidence for the critic, not a verdict, and C editing off the back
of it would be C steering content. Nothing is re-dispatched here: the report goes to the critic at stage 5,
and if what it found is bad enough to need a rewrite, the critic says so and the editor does it at 5b.

A **tapped** tree skips this stage. Its student reads as much as listens, and the tool prints one arm of a
branching tree — a partial page the reader would judge as if it were the whole lesson.

### 5 — Independent critique (J → critic)

Dispatch **`scenario-critic`** (dialogue mode) over ALL levels' trees + deltas at once. For a spoken level
the brief opens with **the audio-only brief**, quoted verbatim, naming what this role decides with it: the
eyes-shut test has already been run for the critic by stage 4b, and the critic weighs what it found against
everything else it can see. It then carries **writing for two learners**,
quoted verbatim: the critic names every character line that varies and says for each whether it earns its
second recording. Its own definition carries the adjacent spoken
axes (load asymmetry, the prompt-is-the-client-line rule, the stall ladder, the on-ramp, slow lines, chunk
breaks) but not this test, so the quotation is the only place it gets it. It returns
`{ verdict, fixes:[{level,nodeId,field,oldExact,newExact,reason}], deltaFindings, convergenceReviewed,
notes, needsEditor:{ required, why, whatToFix } }`. Its `fixes` are the structured, addressed edits the
reconcile applies; its `deltaFindings` flag mint/reuse problems.

**The critic also decides whether the editor is needed**, and this is the one call that routes the rest of
the run. Ask it directly, in the brief:

> An addressed fix replaces exact text in one field of one node. Some problems cannot be repaired that
> way — a beat whose meaning depends on a stage direction nobody hears, a question the lesson never lets
> the learner answer, a close that lands on a repeat of the opening, a word demanded in a slot whose only
> exposure was four beats ago. Those need a beat rewritten, cut, split, or moved.
>
> Set `needsEditor.required` when any finding is of that kind, or when a `deltaFinding` is `block`, and
> say in `whatToFix` what must end up true of the lesson — not how to write it. Nothing goes back to the
> designers, so if you leave a real problem unnamed here it ships.

### 5b — Editorial repair (J → `lesson-editor`) — only when stage 5 asks for it

`needsEditor.required` is false → skip this stage; the critic's addressed fixes are enough.

Otherwise dispatch **`lesson-editor`** once for the level. Give it: the full node set with the critic's
`fixes` already folded in, stage 4b's report whole (every fact answer), the critic's verdict including
`whatToFix`, the level's **ear inventory** in order, the settings, the one new shape, the clip-fork budget
and how much of it is spent, and the turn floor with the current count.

It returns the whole edited node set, a reason per change, its dissents from findings it judged wrong, its
`appNotes`, and its recount. **Take what it returns.** It is the last author in the run: C does not
re-read the lesson to see whether the edit improved it, does not dispatch another reader, and does not
send it back. What comes out of 5b goes to the reconcile.

If it reports in `concerns` that something could not be fixed, that is a finding for R at stage 9 — not a
reason to run the stage again.

**For a beginner `advance: "audio"` level, the critic must also rule on five things a linter cannot:**

- **Heard-first:** walk the level in order and confirm every client `sl` was voiced verbatim by an earlier
  npc node, or is a known word swapped into a shape voiced seconds earlier — and that **every elicited form
  was modelled**, with a filler in it, on the ladder. Flag a level that elicits a form it only implied. A
  form in a person the learner has not produced before is fine where the character voiced it first: that is
  the same shape on a new rung, not a second shape.
- **Character truth:** does the character only say things true for him and natural for a person in this
  situation? That single question catches what a structural gate never will — greeting a stranger he has
  already met, announcing a language he obviously speaks, a learner re-introducing themselves to someone
  who knows them.
- **Written for the ear — rule on stage 4b's reading.** Quote the whole report into the brief, each level's
  under that level, and say what it is: someone who was given this lesson as talk in a room and nothing
  else. That reading is the eyes-shut test, already run; the critic's job is to say what follows from it.
  Rule on **every** beat the report marked `friction` or `broken` — return a fix where the lines can be
  changed, a note where the finding is real and the fix is a design decision above this stage, and a
  reasoned dissent where the reading is wrong. A finding left unmentioned reads as agreement and gets lost.
  Where a fix lands, say what it does for the beat, not just for the sentence: a beat that needs looking at
  is a lesson to change, not a caption to add.
  The report is **evidence, not a verdict** — it is one reader who saw only the words, so it cannot see the
  heard-first ladder, the catalog, or the recording budget. Where it flags something the other checks
  below explain, say so and let the finding go. Where it flags something they do not, it stands.
- **The on-ramp:** does `frameEN` frame *this* lesson — not lessons in general? Does it promise anything
  the level does not deliver? Is every line legible to someone who has never seen the app?
- **Both learners get the lesson:** stage 4b read the level through once as each answer, so whether both
  conversations follow is already in the report. What is left here is cost and correctness: is every
  character line that varies worth the recording it forks, and is every one that does **not** vary correct
  for both learners? A line that
  addresses the learner in one gender without varying is the failure this check exists for.
- **The gloss is the meaning:** every client `en` is that line's translation and nothing else — the sole
  exception is a turn with no Slovene stem. Where an `en` *instructs* — quotes a Slovene fragment back, says
  "plus", tells the learner how to assemble the line — return a fix rewriting it as the plain translation.
  **Then look at the beat it came from.** An instruction in the gloss is a symptom: it lets a thin
  heard-first rung pass by telling the learner in English what they should have retrieved from sound. Say
  whether the beat still hands over clearly with the instruction gone, and where it does not, name the npc
  node that should have made it obvious and what it is missing.

### 6 — Assemble the reconcile input (L, C)

Complete the reconcile input (draft path while unapproved; shape in docs/authoring-pipeline.md › The
reconcile input contract, and the header comment of `server/scripts/reconcile-dialogue.ts`). For a spoken
scenario its header and its nodes are already in place from 4b — this stage fills in the rest and folds the
critic's fixes onto what is there:

- the `scenario` header
- `dialogueVoices`
- `dialogueAdvance` (omit for `"tap"`)
- `dialoguePacing` (spoken scenes; omit to keep whatever the file already carries)
- `levels` — each with `levelLabel`, `title`, optional `background`, `frameEN`, optional `tutorial`,
  `objectives:[{label,descriptorEN}]`, `root`, `nodes` (LS's `sl/en/deliverySL/slowSL/deliverySlowSL` plus
  the design's `glossPolicy/stallHandlers/focusSpan` and C's `learnables`), and `catalog:{reuse,new}`
- `criticFixes`
- `a1Candidates:[{learnableId,competencyId,note}]` for each NEW learnable, proposing where it sits in the
  A1 map (competency ids from `server/catalog/a1-map.json`)

Rules:

- **C assembles only:** every `sl` came from LS; every English string the learner reads — the on-ramp, the
  soften labels, the tutorial text, the objective descriptors — came from 2a/2b.
- **Mint-once across levels:** a learnable shared by several levels goes in `new` on **exactly one** level
  (its first use) and `reuse` on the rest. The same id under `new` twice makes the reconcile fail on a
  duplicate surface — split it here.
- **`background`** (optional): a per-level portrait filename under `public/backgrounds/`
  (`<scenario>-<level>.jpg` or descriptive), operator-supplied art. The reconcile writes it onto the level
  and preserves it on re-run.
- The reconcile input is the **source of truth** for a level's nodes. Later node changes go here and get a
  re-run — never hand-edit `server/dialogues/*.json`.

### 7 — Reconcile deterministically (L)

After approval, and after the input has moved into place:

```
npm run reconcile:dialogue -- authoring/dialogues/<scenarioId>/reconcile-input.json
```

It normalizes kinds, dedups (fail-loud on a duplicate surface — fix the delta upstream and re-run), assigns
ids + `introduces`, applies the critic's exact fixes, writes the dialogue files + the manifest, merges the
catalog, and emits `a1-candidates.json`. Idempotent — safe to re-run.

While the package is still a proposal, run it against the draft input under `.scratch/` so stages 8–9 have
real gate output to show; the committed run is the one above.

### 8 — Gates (L) — all must be green, no generation

```
npm run lint:dialogue && npm run lint:tree && npm run lint:a1 && npm run test:dialogue
```

then `npm run lint:audio -- <scenarioId>` **for information only at this stage**.

**A gate failure is the editor's to repair** (5b) — a duplicate surface, a node off the spine, a
`focusSpan` that matches twice, a `slowSL` equal to its `sl`. Hand it the failing output verbatim with the
current nodes and take back what it returns. Where 5b has already run, this is a second, narrowly scoped
dispatch: the gate names exactly what is wrong, so the edit is addressed rather than open.

**`lint:tree` lists the convergence nodes to eyeball.** A convergence node **reads on all paths** when,
taking each incoming parent in turn, parent-line → node-line is true, responsive, and not a repeat. The
test: read each parent/node pair aloud. If the node answers something a parent never said, or says again
what one parent already said, it does not read on that path — route it to the critic.

**`lint:dialogue` may WARN on a delivery collision** (a shared `sl` + voice with differing delivery).
Resolve by making the line textually distinct (2c/3) if the delivery matters.

**`lint:audio` here is the clip budget.** The run has generated nothing, so read its output as cost: which
clips are missing, and which of those are **re-keys** (bytes already paid for under an old provider/voice/
model tag — copy them, never re-synthesize) versus genuinely new synthesis that will bill. Carry both counts
into the ReviewPackage so R approves a known cost. A level that is honestly `"pending"` is never a failure
here.

**`lint:a1` + the bands.** It gates on `a1-map` ref-integrity and otherwise **reports** — the per-dialogue
band, and which minted items sit in the tagged superset vs the curated core. New A1 material is tagged
`a1: true` at mint, which is all the classifier needs. **The computed band is what each level ships.**

Where a level aimed at Basic computes Intermediate, pick the true reading (dialogue-difficulty-model.md §7).
**The test is whether the above-core items can be swapped for already-core survival language without losing
the objective:**

- **They can** → the lesson is leaning on language it does not need. Route to LS/2–3, revise toward core,
  re-run. It legitimately reaches Basic.
- **They cannot** — the objective *is* those items → keep the computed band and carry a core-promotion
  recommendation into stage 9, naming each item and why it clears the core's bar.

Never revise the aim to match the band, and never tag an item core to move a band.

### 8b — Wrap-up: catalog proposals (L + J)

Two lists, produced every run. **R answers both**, yes or no.

**(a) What did these levels put in the learner's ear that the catalog lacks?** Walk every `sl` on every
**npc** node just authored. Fold to citation form and drop what an existing id already covers.

**(b) Does anything here belong in the core?** From this run's mints and the `a1: true` items these levels
lean on, recommend one only where it clears the bar the core exists to protect — **very high frequency AND
broad unlock leverage AND essential survival language.** Name the bands promotion would recalibrate. An
empty list is a common and correct answer.

Print both in the terminal, every run, in this shape — one item per line, sorted by verdict, weak tail
collapsed onto one line, `none` where a list is empty:

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

### 9 — Submit the ReviewPackage (L, C) — PR semantics

Present R:

- the per-level objectives
- **the design this lesson was built on** — `built_on` + `why_it_teaches_best`, what it took from the other
  two, what it left behind, and one line on each design not built on (a headless run never hides the fork)
- the trees (English intent + LS's Slovene + delivery tags)
- the catalog delta (reused vs newly minted, each new item's gloss + its predictable error)
- the computed `introduces`
- the **computed band per level**, and for any level whose band differs from its aim, the §7 reading and
  which branch of the test it took
- the **stage-8b lists**, in the terminal shape that stage gives them
- the **clip budget** from `lint:audio`: re-keys vs new synthesis
- any `lint:dialogue` delivery-collision warnings and how they were resolved
- the convergence nodes the critic reviewed
- **how the lesson read as a conversation** (spoken levels): stage 4b's findings and what the critic did
  with each — fixed, noted, or dissented from. R is being asked to approve a lesson someone will sit
  through, so what a first reading of it caught belongs in front of them
- **what the editor changed** (where 5b ran): its reasons, its dissents, and anything it reported as
  unfixable
- **`appNotes`** — findings about the app rather than this lesson: how long a caption is held, what the
  button says, what the tortoise does, when the stall ladder fires. They surface in every lesson review
  and they are fixed in the renderer or the pacing profile, so they reach R as a standing list rather than
  bending a lesson around them. Say which recur from previous runs.
- any floor note from 2c
- the green lint/test output
- the register + voices, stated explicitly, with an invitation to confirm or override

**Attribute every learner-facing string.** The on-ramp, each stall's soften label, each tutorial line, each
objective descriptor: name the stage that wrote it (2a/2b for design copy, 3 for Slovene). **A string
attributed to C is a defect** — report it as one and say which stage should have authored it, rather than
shipping it quietly.

### 10 — Review gate (J, R)

R replies **approve** or **reject(notes)**. **R's notes go to the editor** (5b) as a fixed brief — R is the
one authority whose direction sets what the lesson must become — and the run continues at 6–8 with what
the editor returns. One editorial pass per rejection, then back to R.

**A headless run ends here**, with the package and the stage-11 command block printed for R to run.

### 11 — On approve (R runs it; C verifies)

- **Core promotions.** Where R approved a stage-9 core-promotion recommendation, add those ids to
  `server/catalog/a1-map.json` and re-run `npm run lint:a1` — the affected bands recalibrate. Items R did
  not promote stay in the tagged superset via `a1: true`. **The core grows only by R's word.**

- **Audio — R runs these.** C prints the block; C does not run it.

  ```
  npm run build:dialogue-assets -- <scenarioId> [--level n]   # lines
  npm run build:dialogue-intros -- <scenarioId> [--level n]   # intro monologues
  ```

  Each is preflight-gated (fails fast on an unset voice binding), idempotent, and billed only for new
  clips; the line build flips a clean level `audio: "pending"` → `"ready"`. For a cheap pre-commit
  voice/delivery check, `build:dialogue-assets --nodes <id,id>` auditions a few lines without flipping
  `ready`.

- **Verify the generation landed — REQUIRED, and the work is not done until it is green:**
  `npm run lint:audio -- <scenarioId>`. This is the only check that a level claiming `audio: "ready"`
  actually has its bytes; every other gate inspects JSON, not the store. The failure it catches is
  invisible at runtime — a missing clip makes the scene play **silent and too fast** without ever erroring
  (`/api/speak` 502s, the `<audio>` fires `onerror`, and `await sceneSay(...)` resolves instantly,
  collapsing every pause whose length came from the clip). On failure: R generates the named clips, or
  re-keys the ones flagged as already-paid-for, or the level goes back to `audio: "pending"` so the state
  is at least honest. **Never mark a level `"ready"` to make this pass.**

- **Key Phrases — a spoken level is not finished until they have play buttons.** A level at `audio:
  "ready"` has a close screen listing the lines the learner produced, and every one is silent: their lines
  are never synthesized, so the button can only replay the character modelling the phrase, and nothing has
  chosen which delivery yet. Left undone it ships quietly — the screen renders, the phrases are there, they
  do nothing.

  ```
  npm run build:alignments -- <scenarioId>     # measures clips already on disk — never synthesizes
  ```

  then invoke the **`voice-key-phrases`** skill for the levels just built. It generates nothing and bills
  nothing. R approves the spans; a phrase with no honest source gets no button, which is a correct outcome.

- **Ship the audio (R).** Line clips land in the gitignored `assets/audio/` store and are force-committed
  for a deploy (`git add -f assets/audio`); intro clips land in `public/intros/` and alignments in
  `assets/align/`, both git-tracked. See docs/DEPLOY.md for the ship + serve-env contract.

- **Restart the server (R)** — scenarios, dialogues and learnables load only at startup.

## Scope (do not add)

No guided-live runtime, no A1 scoring engine, no auto-competency assignment (candidates are
operator-confirmed), no manifest consolidation beyond the `surfaces` block. Don't touch create-scenario.
**Audio generation, core promotion, the server restart and the deploy are all R's** — this skill authors,
gates, and hands over.
