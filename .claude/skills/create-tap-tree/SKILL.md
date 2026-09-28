---
name: create-tap-tree
description: Author a lango-slovenian scenario's tap-tree dialogues — branching npc/client trees (`advance: "tap"`) that mirror a real exchange, which the learner speaks through aloud as they tap. Works from a situation map with outcomes (the operator's pre-authored plan, like the library flowchart), has the native author finish the Slovene and the delivery, has an independent critic check it, runs the reconcile and the gates, and presents it for approval. Audio and approval belong to the operator. Use when the user wants tap trees / rehearsal trees / "dialogues like the library" for a scenario, or says "author the tap trees", "build the <scenario> dialogues from the plan". Spoken lessons (`advance: "audio"`) are the create-dialogue skill.
---

# create-tap-tree — tap-tree dialogues from a situation map

A tap tree is a **real exchange, written as it happens in life**. The character (`npc`) speaks; the learner
picks one of the buyer's, patron's or customer's replies (`client`) and **says it aloud**, mirroring that
person, then hears the character answer. Branches are the choices a real person has and the ways a real
visit can go. Nothing is staged for teaching: there is no tutor modelling a line first, no slow re-speak,
no quiet-learner ladder. A line comes round again because a real exchange needs it again.

**The worked example is the library** — `authoring/dialogues/library/reconcile-input.json`, built from the
operator's flowchart (one topic tree, every sub-situation with its outcomes). Read two of its levels before
you start. Its structure is what this skill produces, with one exception: its delivery tags are in English.
Delivery tags are now Slovene (§ Delivery).

**Roles.** C is you, the orchestrator. **R** is the operator: the person who wrote the plan, who approves, and
who runs generation. **LS** is the `slovenian-author` agent (tap-tree mode). The **critic** is the
`scenario-critic` agent (tap-tree mode). Scripts do every file write and check: `reconcile:dialogue`,
`lint:*`.

## How a tree meets the mastery loop

A tree credits nothing. It is where the learner hears a line and says it through, and it feeds the
parts of the app that do credit:

- **`learnables` on client nodes** are what the learner produces. They are what the "now try it for
  real" live session steers toward (`server/live/prompt.ts` › `focusIdsFor`), and what that session credits.
- **The catalog** follows the minting rubric (docs/rehearsal-dialogues.md › The minting rubric): mint only
  what the learner produces, reuse by lexical identity, one paradigm = one learnable.
- **The band** is computed from the core/A1 tags over **every** node, npc included
  (docs/dialogue-difficulty-model.md §3). A line with `learnables: []` is left out of the ratios.
- **Reuse across levels** is what builds mastery: every visit needs its greeting, its order, its close, so
  those lines come back in every level. The ledger (stage 0) is how you check that it happens.
- A scenario with a **live scene** (`surfaces.live`, docs/live-tutor.md › A scene with its own harness) has
  a card: its `core`, `bank` and `stock` ids. The trees are where every card line is first said, and the
  bank is ordered by the level that introduces each line.

## Two ways in

- **The plan exists** — R has a situation map with outcomes and a level plan (which situations each level
  covers, the choices, the outcomes, what each level introduces and reuses; e.g.
  `.scratch/dialogue-drafts/trznica/level-plan.md`). The content is R's. You transcribe it into trees, LS
  finishes the language, the critic checks it. **This is the normal path.**
- **Only a situation exists** — draft the map first, in English, in the plan's shape: the situations,
  their outcomes, and a cut into levels (basic → intermediate → advanced). Put it in front of R and get it
  approved **before any Slovene is written**. From there it is the first path.

## Stage 0 — Read, and compute the ledger

Read:
- the plan
- `docs/rehearsal-dialogues.md`: the data model, the tree template, § The delivery vocabulary, the minting
  rubric
- the scenario manifest `server/scenarios/<id>.json`, if it exists
- two library levels, one basic and one with outcomes (L1 and L6 show both ends)

**The ledger** — what each level's client lines produce, across the scenario's existing tap levels and
this run's draft. Run it whenever the draft changes:

```bash
node -e '
const fs=require("fs"),[,id,draft]=process.argv;const lv=[];
for(const f of fs.readdirSync("server/dialogues").filter(f=>f.startsWith(id+"-")))lv.push(JSON.parse(fs.readFileSync("server/dialogues/"+f)));
if(draft&&fs.existsSync(draft))for(const l of JSON.parse(fs.readFileSync(draft)).levels)if(!lv.some(x=>x.level===l.level))lv.push(l);
const said={};for(const l of lv)for(const n of Object.values(l.nodes))if(n.speaker==="client")for(const x of n.learnables||[])(said[x]??=new Set).add(l.level);
for(const [x,s] of Object.entries(said).sort()){const a=[...s].sort((p,q)=>p-q);console.log(x.padEnd(24),a.join(","),a.length<2?"  ← not reused":"")}
' <scenarioId> .scratch/dialogue-drafts/<scenarioId>/reconcile-input.json
```

It lists each learnable with the levels that have the learner say it. Held against the plan, it answers
three questions: is every planned learnable said on a client node, is each introduced in the level the
plan says, and does it come back later. A learnable said in one level only is a finding for the review
package, unless it belongs to the scenario's last levels.

## Stage 1 — Settings

Fixed once, for the whole scenario:

- **The scenario block.** If the manifest exists, copy its `id`, `name`, `title`, `status`, `character`,
  `role`, `setup`, `opening` and `register` into the reconcile input verbatim — the reconcile overwrites
  the manifest's copies from the input, and keeps any `surfaces` it does not own (a `live` surface
  survives).
- **Register**: ti/vi + pogovorni/knjižni. It holds on every line, the client's included.
- **Voices**: `npc` and `client` profiles from `server/catalog/voices.json`. **The client is a person with a
  gender** — the one the client voice belongs to. First-person forms follow it (*Rad bi* / *Rada bi*,
  *prišel* / *prišla*). State it in every brief.
- **The levels**: `level` (1… in band order), `levelLabel` (the target band — the written label is the
  computed one), `title`, and `objectives: [{label, descriptorEN}]` from the plan.

## Stage 2 — Skeletons (C transcribes the plan)

For each level, write the node graph: `{ id, speaker, intentEN, context?, next }`, plus, on each client
node, the plan's learnables for that line. Intent is English and says what the line does; it is not
learner-facing. The structure follows the library:

- **Root** is the character opening the exchange. The first fork often picks the **errand** — which arm
  of the situation this visit is (library L6: register / renew / lost card, three arms).
- **A fork offers 2 choices**, occasionally 3 where the situation truly has three arms. The choices are
  either **different intents** (ask where the toilet is / ask where to sit) or **the same intent said two
  ways**, one short and one fuller (*Izvolite.* / *Seveda, tukaj je moja izkaznica.*).
- **Outcomes are chosen by the learner through `context`.** Where the world, not the learner, decides what
  happens next, the learner picks the world: the **same line** offered more than once, each with a
  different `context` (*Izvolite.* — "the book is available" / "the copy isn't on the shelf" / "only a
  reading-room copy exists"), each leading to its own npc response. A different line can carry a `context`
  too, where the line alone does not say which situation it belongs to ("he has no ID with him").
- **Branches rejoin** on shared nodes: the shared close pair (`cz1`/`cz2` → `nBye`). A setback ends
  differently: its own close pair into its own terminal (`czBad1`/`czBad2` → `nByeBad`). Two terminals
  are normal where the visit can fail.
- **By band:**
  - **basic** — simple choices between things: which item, which weight, which greeting, how to leave.
    One outcome: the visit goes as hoped. `context` only where two lines need telling apart.
  - **intermediate** — the plan's outcomes (out of stock, a suggestion to accept or decline, a question
    back), each an arm with its own `context`.
  - **advanced** — several outcomes in one visit, and the learner leading more of the talk.
- **Size** follows the situation: the library runs 10–33 nodes (basic 10–16, outcome-heavy 26–33). A
  longer tree is not a harder one.
- **Every level is a whole visit** — greet, the business, close — so the core lines are said again in every
  level because the visit needs them.
- **Openers and closers differ across levels.** The same `sl` in the same voice is one audio clip, so a
  reused opener collapses to one recording and reads monotonously.

**Transcription, not design.** Everything in the skeleton comes from the plan. Where the tree needs a
beat the plan does not have — a reply to the greeting, the close — write its intent and mark it
`(added)` so R sees it in the review. Where the plan asks for something the structure cannot carry, say
so to R; do not reshape the plan.

## Stage 3 — Language (LS, one per level, in parallel)

Dispatch `slovenian-author` in **tap-tree mode**, one per level. Each brief carries:
- the settings (situation, register, voices, the client's gender)
- the level's skeleton
- **the plan's Slovene for that level, verbatim** — the card lines and any lines R wrote
- the learnable ids already in the catalog that the plan assigns to it
- § Delivery below, quoted

LS returns, per node: `sl`, `en`, `deliverySL` (npc only), and the `context` wording; optionally the level's
`intro`; the `catalogDelta`; `concerns`. **R's Slovene is kept as written** unless it is wrong or unnatural
in the line it lands in, in which case LS writes the natural line and says why in `concerns`. Those go to
R in the review package, never silently.

Then **C attaches `learnables` on every node**, npc included: the catalog ids the line is made of, joined
mechanically — an id is in LS's delta or already in `server/catalog/learnables.json` under a form the
line contains. A line made of nothing in the catalog gets `[]`. Anything that cannot be joined goes back to
LS as a concern, never as an invented id.

## Delivery

Quote this block into every LS and critic brief.

> - **Delivery tags are written in Slovene.** An English tag sits in the same prompt as the Slovene line
>   and pulls the voice's accent toward English. The tag never reaches the screen.
> - **`[toplo]` is the default** and carries essentially every npc line: `[toplo] Dober dan, izvolite?`
> - Past `[toplo]`, the tags are a **closed list** (docs/rehearsal-dialogues.md › The delivery
>   vocabulary): `[veselo]` · `[nagajivo]` · `[zaupno, tiho]` · `[oklevajoče]` · `[naveličano]` ·
>   `[poslovno]` · `[navdušeno, hitro]` · `[v zadregi]` · `[stvarno]`. Reach past the default only where a
>   line has a distinct change of tone the listener needs to hear; used on line after line, a change
>   stops being one. A tone the list lacks is a concern for R, not a new tag.
> - **A tag is a bare `-o` adverb**, one or two, lowercase, no punctuation, **at the very start** of the
>   line. Never a verb or an instruction (`[govori počasi]` is a sentence the voice will say aloud), never
>   mid-line, never a character description (`[soft spoken, whimsical librarian]` is the old style — the
>   persona lives in the words and in the voice profile).
> - **Client lines carry no `deliverySL`.** They are what the learner says; they are synthesized plainly in
>   the client voice.
> - **An `intro`** (optional) is the client's own short monologue before the tree, in the client voice.
>   Its `text` takes tags from the same list at the start of a sentence, only where the mood turns, and its
>   `en` is the translation. A level without one opens straight on the character.

## Stage 4 — Critique (critic, all levels at once)

Dispatch `scenario-critic` in **tap-tree mode** with every level's nodes, the deltas, the settings, the
plan, the ledger output, and § Delivery. It returns addressed fixes (`sl`, `en`, `deliverySL`, `context`),
delta findings, the convergence nodes it checked, and `rewrite`: beats that an exact replace cannot fix.

- The addressed fixes go into `criticFixes`; the reconcile applies them.
- `rewrite` non-empty → **one** LS dispatch for exactly those beats, with the critic's reason. What comes
  back is taken; it does not go round again. What is still wrong goes to R in the review package.

## Stage 5 — Assemble, reconcile, gate

Write the reconcile input at `.scratch/dialogue-drafts/<scenarioId>/reconcile-input.json`: `scenario`,
`dialogueVoices`, `levels` (each with `level`, `levelLabel`, `title`, `objectives`, `root`, `nodes`,
optional `intro` / `background`, and `catalog: {reuse, new}`), `criticFixes`, and `a1Candidates` for each
new learnable. Omit `dialogueAdvance` (tap is the default). A learnable used by several levels goes in `new`
on its first level only.

```bash
npm run reconcile:dialogue -- .scratch/dialogue-drafts/<scenarioId>/reconcile-input.json
npm run lint:dialogue && npm run lint:tree && npm run lint:a1 && npm run test:dialogue
npm run lint:audio -- <scenarioId>        # the clip budget — information, not a gate
```

The draft reconcile **writes the real files** (`server/dialogues/`, the manifest, the catalog) so the gates
have something to check; `git status` shows them, and a rejection is `git checkout` of those paths. Re-run
the ledger against the result.

A gate failure is an addressed problem: route it to LS (language) or back to stage 2 (structure), once,
and re-run. **A level whose computed band differs from its target** keeps its band; say why in the review
package (docs/dialogue-difficulty-model.md §7). Never reshape a tree or re-tag a learnable to move a band.

## Stage 6 — Review package (R)

Present, per level:
- the tree, printed one node per line — id, K/O, `sl` (and `context`) → next, then `en` and
  `{learnables}`:

  ```bash
  node -e 'const r=require("./.scratch/dialogue-drafts/<scenarioId>/reconcile-input.json");for(const l of r.levels){console.log("\n## L"+l.level,l.title);for(const [id,n] of Object.entries(l.nodes))console.log(`${id.padEnd(7)} ${n.speaker==="npc"?"K":"  O"} ${n.deliverySL??n.sl}${n.context?"  ("+n.context+")":""}  → [${n.next}]\n          ${n.en}  {${(n.learnables||[]).join(",")}}`)}'
  ```
- the computed band against the target
- the catalog delta, with each new item's gloss and predictable error
- everything marked `(added)`, and every line LS changed from R's Slovene, with its reason

Then, across the scenario:
- the ledger, with findings (never said, said once)
- the critic's notes and what happened to each fix
- the clip budget (new synthesis vs re-keys)
- the green gate output

R approves, or replies with notes. Notes go to LS (language) or stage 2 (structure) as a fixed brief; one
pass, then back to R.

## Stage 7 — On approve

1. Move the input to `authoring/dialogues/<scenarioId>/reconcile-input.json`, reconcile from there, run the
   gates, and commit (source, generated dialogues, manifest, catalog, a1-map).
2. **R generates the audio** — print this block; do not run it:

   ```bash
   npm run build:dialogue-assets -- <scenarioId>
   npm run build:dialogue-intros -- <scenarioId>     # only if a level has an intro
   npm run lint:audio -- <scenarioId>                # required: every "ready" level has its bytes
   ```
3. R restarts the server; scenarios, dialogues and learnables load at startup.

## Out of scope

Spoken lessons (create-dialogue). Audio generation. Core promotion (R's call, made in the plan or at review).
Changes to the live tutor, the grader or the scheduler.
