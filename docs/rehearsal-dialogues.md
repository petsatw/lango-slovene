# Rehearsal dialogues — the click-through decision tree

A **rehearsal dialogue** is a fully pre-authored, branching **decision-tree** conversation paired with a
scenario. The learner clicks through it — pick your line, hear it, read the English — to *see the shape*
of a real exchange before producing it live. It is **rehearsal / comprehensible input, not assessment**:
no microphone, no server turn, no model in the loop, and **no mastery credit**. The live mic tutor stays
the only place mastery is earned.

This complements the two existing conversation surfaces (the scenario turn loop and free chat) with a
third, lighter one. The division of labour — and the direction the [roadmap](ROADMAP.md#the-pieces) set —
is: **the click-through dialogue introduces new language; free chat reinforces it toward mastery.** That
integration is now built: a level ties itself to catalog learnables via [`introduces`](#the-catalog-link--deriving-learnables-from-a-dialogue)
and hands the learner into a [biased free chat](#the-handoff--introduce-then-reinforce). What is *not* yet
built is auto-selecting which dialogue comes next (roadmap item 5).

## What the learner sees

- A **🎭 Rehearse** button on a scenario that has authored dialogues. It opens an overlay.
- **Competency-level tabs** (e.g. *1. Survival · 2. Basic A1 · 3. Full A1*) when a scenario has more than
  one level. Each level is a distinct tree with its own, non-overlapping objectives, ascending in length
  and difficulty.
- The **NPC line** (`npc`) as a left bubble, then **2 client-reply choices** as buttons. Picking one
  drops it in as a right bubble and advances to the NPC's response — branches **re-converge** onto shared
  later nodes so the tree stays finite. A terminal node offers **↻ Start over**.
- **Tap any line** to reveal its English (same click-to-reveal as the live transcript).
- **Per-line audio** once built: the customer line plays, then the NPC replies — a single audio channel,
  so the two voices never overlap. While a level's audio is unbuilt the play buttons are hidden, so a
  click-through can't trigger a billed live synthesis (the cost gate — see `audio` below).

## Data model

One file per level: `server/dialogues/<scenario>-<level>.json`, loaded + validated at startup by
[`server/dialogues.ts`](../server/dialogues.ts), **grouped by `scenarioId`** and sorted ascending by
`level` (levels must be unique within a scenario). A scenario with no dialogue file simply has none —
the feature is optional per scenario.

```jsonc
{
  "id": "bakery-l1",
  "scenarioId": "bakery",          // which scenario this pairs with
  "level": 1,                       // 1..N, ascending difficulty; unique per scenario
  "levelLabel": "Survival",         // short human label for the tab
  "title": "Buy bread — the basics",
  "objectives": [                   // DISPLAY ONLY — what this level demonstrates (no crediting)
    { "label": "Order one loaf", "descriptorEN": "Ask for one loaf using the masculine accusative." }
    // …
  ],
  "introduces": ["kruh", "en_masacc", "dve_dualacc"],  // catalog learnable ids this level INTRODUCES —
                                    // the concrete "just-introduced" set the free-chat handoff biases
                                    // toward (roadmap 12b). Every id must resolve in the learnable
                                    // catalog; may be [] for a pure-review level. See "The catalog link".
  "audio": "pending",               // "pending" | "ready" — gates the client's play affordance
  "status": "active",               // "active" (default, omit) | "draft" | "retired" — whether the level
                                    // reaches the learner. See "Staging a level" below.
  "voices": { "npc": "shop-assistant", "client": "female-speaker" },  // per-speaker catalog voice profile
  "advance": "tap",                 // "tap" (default, omit) | "audio" — how the learner moves the tree.
                                    // See "Tapped vs spoken" below.
  "background": "bakery-1.jpg",     // optional portrait scene image under public/backgrounds/ (see below)
  "root": "b1",                     // must be an npc node
  "nodes": {
    "b1":  { "speaker": "npc",  "sl": "Dober dan, izvolite?", "en": "Good day, what can I get you?",
             "deliverySL": "[hesitant and a little apathetic] Dober dan, izvolite?",  // optional; see below
             "next": ["c1a", "c1b"] },
    "c1a": { "speaker": "client", "sl": "Dober dan. En kruh, prosim.", "en": "…", "next": ["b2"] },
    // … a client node's `next` is the single npc response; an npc node's `next` is its client choices;
    //    `next: []` ends the dialogue. Every id in any `next` must exist (re-convergence = shared ids).
  }
}
```

- **`sl`** is both the on-screen caption **and** the audio cache key.
- **`deliverySL`** (optional) is the same line **with inline [eleven_v3 audio tags](https://elevenlabs.io/blog/v3-audiotags)**
  (e.g. `[hesitant]`, `[apologetic]`, `[warmly]`). When present it is what gets **synthesized**, while
  `sl` stays the caption and the key — so delivery direction steers the voice without ever showing on
  screen or changing the cache key. Absent → the clean `sl` is synthesized plainly.
  - **Delivery collides on shared lines (author around it).** Because the tag is *not* in the key, two nodes
    with the same `sl` in the same voice profile are **one clip** — the first built wins, and any different
    `deliverySL` on the others is never heard. So a character's delivery only lands on lines whose `sl` is
    unique to that voice. If a character must sound distinct on an otherwise-common line (a greeting, a
    closing), make the line **textually distinct**. `npm run lint:dialogue` emits a warning for every such
    collision (same voice + `sl`, differing delivery) so it is visible before you generate.
- **`slowSL`** (optional) is the same line **chunked and re-spoken slowly** (e.g. `Jaz sem … Slavko.`) —
  for a beat that says a line at natural speed and then again slower. Like `sl` it does double duty: the
  chunked **caption** and the **audio key** for the slow clip. Because it is different text it is
  naturally a different key — no key-model change, nothing re-keyed. It must **differ from `sl`**
  (identical text is one clip, so the "slow" version would silently be the natural one); the loader
  rejects that. `build:dialogue-assets` emits both clips.
- **`deliverySlowSL`** (optional) is `slowSL` **with inline delivery tags** — what gets synthesized for
  the slow clip, while `slowSL` stays the caption and the key. The `sl`/`deliverySL` split, applied to
  the slow line, and it exists for a **measured** reason: the ` … ` separator alone does **not** slow
  eleven_v3 down. Two authored slow lines came back at 1.00× and 0.92× the duration of their natural
  clips — one identical, one *faster*. Slower speech has to be **directed**, and the direction must not
  reach the screen. Without it, `slowSL` is synthesized as written and the "slow" clip will not be slow.
- **`learnables`** (optional, on **any** node) is the catalog ids the line **is made of** — what the
  per-line difficulty band counts (dialogue-difficulty-model.md §3), which is why an npc line carries them
  too. On a **client** node it doubles as the ids that beat expects the learner to **produce**, the
  allowlist the `"audio"` advance mode plants as **attempts**; crediting reads it only there, so tagging an
  npc line describes it and never credits the learner for hearing it. It **may be empty**: a
  beat whose expected utterance is not Slovene at all (the learner saying their own name) exercises no
  catalog item. Ignored for crediting in `"tap"` mode, which credits nothing. This is the per-beat allowlist
  `SeedStep.learnables` plays for the seed; the level-wide `introduces` is a different thing (the
  free-chat bias set).
- **`voices`** maps each speaker to a catalog voice profile id (`server/catalog/voices.json`), so the two
  speakers get distinct voices. Adding a voice = one `voices.json` profile + one `PROFILE_ENV` row in the
  E3 adapter + the concrete voice id in `.env` (see [SECRETS.md](SECRETS.md)).
- **`background`** (optional) is a portrait (9:16) image filename served from `public/backgrounds/`. With it
  the whole card becomes a fixed mobile-portrait frame the image fills; the conversation scrolls over it.
  Backgrounds are **operator-supplied** art (there is no generator for them) named `<scenario>-<level>.jpg`
  or a descriptive name, committed under `public/backgrounds/` (a git-tracked path — they ship normally).
  It is a per-level field on the reconcile input and is **preserved across reconcile re-runs**.
  - **A background shows the dialogue's own cast.** In a tapped tree the client is a **character** with a
    gender chosen by the scenario and matched by its cast voice (see
    [client-as-character](#learner-facts--what-the-course-knows-about-the-person) — a spoken lesson is the
    other case, where the client is the learner). The picture has to agree with the voices, because it is
    on screen for the whole exchange.
    **Open:** `public/backgrounds/bakery.jpg`, used by all three bakery levels, has Slavko at the counter
    as the customer, while the bakery client speaks feminine forms and is cast `female-speaker` — the
    customer should be a woman. A re-render would also drop the gibberish lettering on the shirt.
    Rendering it is **operator-gated** (AGENTS.md › Conventions).
- **`introduces`** is the list of catalog **learnable** ids this level introduces — the concrete
  "what was just introduced" set. It is the seam that makes the click-through the *primary intro path*:
  the learner meets these items in the tree, then the [handoff](#the-handoff--introduce-then-reinforce)
  hands them into a free chat biased toward exactly this set. Validated at startup (every id must resolve
  in the catalog) and gated by `npm run lint:dialogue`. See [the catalog link](#the-catalog-link--deriving-learnables-from-a-dialogue).
- **`choice`**, **`variesBy`/`variants`** (node) and **`needs`** (level) belong to
  [learner facts](#learner-facts--what-the-course-knows-about-the-person), below.

## Tapped vs spoken — one tree, two input modes

A rehearsal tree and a **spoken scene** are the same authored data; they differ only in what moves them
forward. `advance` names which, and [`server/adapters/dialogue-scripted.ts`](../server/adapters/dialogue-scripted.ts)
drives both:

| | `"tap"` (default) | `"audio"` |
|---|---|---|
| Input | the learner **picks** a client line | the learner **speaks** |
| Advances on | the tap | the audio **arriving** — never on what it says |
| Judging | none | **none** — nothing inspects the recording; there is no model in the loop |
| Crediting | nothing (the [witness contract](free-conversation.md)) | the beat's `learnables`, as **attempts** — never masteries |
| An npc node's `next` | the choices offered | the **canonical spine is `next[0]`**; further entries are alternates a surface may preview without them advancing anything |
| npc → npc | not possible — a tap needs a choice | **allowed**: a beat the learner is not asked to answer |

**A spoken spine may run npc → npc.** When an npc node's `next[0]` is another npc node, the character is
carrying himself forward — an acknowledgement, a slow re-model, a nudge onward — and no turn is demanded:
`advanceDialogue` returns the next npc line with `clientNodeId: null` and credits nothing, and the
renderer plays it and continues instead of arming the button (`handsOver: false` on the shaped beat).
Without this every line the character speaks would demand a response, and the only way to hold a
supporting beat would be to pack several sentences into one node — which puts far more words in front of
a beginner than the turn following them is worth. Authoring consequence: **one node is one caption, one
thing on screen**; if two sentences want different captions or different timing, they are two nodes.

`"audio"` is the seed adapter's contract ([`seed-scripted.ts`](../server/adapters/seed-scripted.ts))
generalized to a tree: pure, position-derived, unfailable by construction, and **crediting is the
caller's job** — the adapter returns the allowlist, the orchestrator applies it. Because it never scores,
the mastery loop is untouched: production on the live mic is still the only place mastery accrues.

A spoken scene renders on its **own surface**, not in the rehearsal overlay: `#scene` in
[`public/index.html`](../public/index.html) — full-bleed image, one caption low on screen, one mic
button, and no chrome (the header is hidden while it is up). It is driven by
[`POST /api/scene`](DATA-MODEL.md), one beat per request. Because a spoken scene is somewhere the app
*takes* the learner rather than a rehearsal they pick, `/api/practice` leaves it out of the picker, and
`build:dialogue-assets` voices only the character — the client lines are the learner's own speech.

`advance` is declared on the scenario manifest (`surfaces.dialogue.advance`) **and** on each level's
file; `lint:tree` checks the two agree, exactly as it does for `voices`. Absent ⇒ `"tap"`, so every
dialogue authored before the field keeps its behaviour. In `"audio"` mode `lint:tree` drops its
"single choice" warning — a spoken spine is linear by design.

**The spine is the whole tree, and `lint:tree` enforces that.** A spoken lesson follows `next[0]`, so a
node hanging off `next[1..]` is content the app cannot reach: authored, schema-valid, **billed for a
clip**, and never played. Reachability by graph edge says nothing about it, which is how a whole feminine
arm of the demo lesson — seven nodes — once shipped with every gate green. `lint:tree` now walks `root`
by `next[0]` alone and errors on anything it misses, and `reconcile-dialogue` runs the same walk before it
writes a file. Where a spoken lesson genuinely needs two versions of a line, they belong in that line's
[`variants`](#learner-facts--what-the-course-knows-about-the-person), which keep one spine and one clip
per form the learner can actually reach.

## Learner facts — what the course knows about the person

`learnables` is what the learner can **say**. A **fact** is what the learner **is** — one answer the
language needs before it can address them or put words in their mouth. Slovene asks for the first of these
in the opening minute: it inflects person-nouns, predicate adjectives and the l-participle (which carries
the past, the future and the conditional) for the speaker's own gender, so *Sem študent* and *Sem
študentka* are the same sentence said by two people, and the course has to know which.

Facts are declared in **`server/catalog/facts.json`** and loaded by
[`server/facts.ts`](../server/facts.ts) — an id, an English label, why the course needs it, and a closed
**ordered** set of answers. Declaring them centrally is what lets one lesson ask and a later lesson vary
without either restating the option set. They are stored on the durable learner model
(`LearnerModel.facts`, `assets/learner.json`): one learner, one device, no accounts, and the person who
gave the answer is the only person it describes.

### Asking — the `choice` beat

A spoken lesson has one input channel: the button that says "I am ready to move on". Nothing listens to
the learner, so a lesson can ask "which of these are you?" and hear nothing back. A **`choice`** on an npc
node is the channel that answers it:

```jsonc
"n3": { "speaker": "npc", "sl": "Ti si študent ali študentka?",  // both forms heard together, first
        "en": "Are you a student (male) or a student (female)?", "next": ["n4"] },
"n4": { "speaker": "npc", "sl": "Jaz sem učitelj. In ti?", "en": "I'm the teacher. And you?",
        "choice": { "fact": "gender" }, "next": ["c1"] },
"c1": { "speaker": "client", "sl": "Sem študent.", "en": "I'm a student. (male)",
        "chooseEN": "Choose which one best suits you.\n(We'll learn more about gender later.)",
        "focusSpan": "Sem študent",
        "variesBy": "gender",
        "variants": { "f": { "sl": "Sem študentka.", "en": "I'm a student. (female)",
                             "focusSpan": "Sem študentka" } },
        "next": ["n6"] },
```

The beat hands the turn over as **one button per answer** instead of one Continue, in the same place and
the same shape, and each button carries a whole line the learner can say — the Slovene at prompt weight
with its English beneath. Pressing one is the same gesture as pressing Continue; it advances the spine and
stores the answer. That is the entire affordance, and it is why the beat needs no instruction: a learner
meeting it has already pressed that button a dozen times.

**The beat that asks is an ordinary conversational turn.** The character says both forms once, so the pair
is heard together and contrasted, and then hands over by **reciprocity** — *Jaz sem učitelj. In ti?*, the
commonest handover there is — rather than by putting a question to the learner. The buttons already say
what the two answers are, so the line above them does not have to; making it *"which are you?"* would spend
the lesson's most useful turn on a quiz. `In ti?` is also the same handover the lesson reuses for the
learner's name and again at its close, so asking here teaches a shape instead of consuming one.

The options are **derived**, never authored twice: the fact supplies the answers and their order, and each
button's words come from the upcoming client node rendered for that answer. The question and its answers
are therefore one authored thing. The loader checks the whole join — the fact exists, the beat hands over
to a client node, that node varies on the same fact, and the answers put a different sentence on each
button.

**`chooseEN` is the beat's own English**, one line above the options, on screen from the moment the turn
opens. It sits on the **client** node because it stands in for that line's gloss: the line has several
forms here, so the prompt slot cannot show one of them without contradicting the other. Each option keeps
its own `en` on its own button; this is the single line that speaks for the whole beat, and a `\n` in it
reaches the screen as a line break. It is shared by every form, so it is not something a variant overrides.

It also **replaces the `soften` stall rung** on a beat that asks, and the loader rejects one there. That
rung lowers the bar by relabelling the single button, and a beat that asks has options instead of a
button — but more to the point, its English would say what `chooseEN` already says, ten seconds later. A
choice beat's English is authored in one place, and it is the place that shows immediately: a learner
meeting a new control should not have to fall silent to find out what it is for. `pulse` and `respeak`
still apply.

Two more things hold because the answer is the learner's alone. The `»` skip control is **dimmed**
(`sceneChips` reads the beat's `choice`), and `advanceDialogue` **refuses** to step without an answer —
the same rule stated on screen and behind the API, so the app never decides a fact about someone on their
behalf.

### Varying — `variesBy` and `variants`

Any node may say its line differently depending on a fact. `variants` maps a fact **value** to text
overrides; an answer with no entry keeps the line as authored, so the base is the unmarked form and only
what differs is written out. A variant may override **text only** (`sl`, `en`, `deliverySL`, `slowSL`,
`deliverySlowSL`, `focusSpan`) — the turn, the `next` and the `learnables` belong to the beat and are
shared by every form of it. `resolveNode` (in [`server/dialogues.ts`](../server/dialogues.ts)) is the one
place a form is chosen, and `/api/scene` resolves every line through it before sending, so the renderer
holds no variant logic and the caption, the audio key and the prompt cannot drift apart.

Two invariants that hold **per form**, not per node, because each form is its own caption and its own
audio key:

- `focusSpan` must occur exactly once in **that form's** `sl`. A variant that rewrites `sl` must state its
  own span: the match is a substring, and two forms of a word usually share a stem, so an inherited
  `"Sem študent"` sits inside `"Sem študentka."` and would mark two thirds of a word while passing.
- `slowSL` must differ from **that form's** `sl`.

### Where a variant costs a recording

This is the whole economics of the feature, and the reason the authoring skill asks for **few** forked
character lines:

| line | second recording? |
|---|---|
| the character about **himself** — *Jaz sem učitelj* | **no.** His gender is fixed; nothing varies. |
| the **learner's own lines** in a spoken lesson | **no.** A spoken scene voices only the character, so a client variant is a second caption and no clip at all. |
| the character **addressing the learner** — *Ti si študentka.* | **yes.** The one case that forks a clip — natural and slow, so two. |

Adding a variant never disturbs an existing clip: the audio key is `(provider, voiceTag, text)`, so
different text is automatically a different key. `build:dialogue-assets` builds **every** form, and
`lint:audio` checks every form — a level is `"ready"` only once every learner it can meet has a voice.
The alternative to the third row is real: *Kaj si?* instead of *Ti si študentka?*, *Tako je!* instead of
echoing their noun back. Those cost nothing and should carry most beats. But the affirming echo — the
character saying the learner's own word back to them — is one of the highest-value input moments a lesson
has, so "keep them few" is a budget, not a ban.

### Knowing before speaking

**A voice never says a gendered form about the learner before the learner has said which one they are.**
`lint:tree` makes that checkable: it walks the spoken spine in order and a line may vary on a fact only
once the fact has an answer — asked earlier on that spine, or declared in the level's **`needs`**:

```jsonc
"needs": ["gender"],   // an earlier lesson asked; this one may vary without stopping to ask again
```

`needs` is what lets the onboarding lesson own the question and every later lesson inherit the answer. It
is also the record of which lesson has to come first: reaching a level whose needs are unanswered plays
the base form of every line.

## Backchannels — a voice's listening noises

A backchannel (`"Mhm."`) is **not a dialogue node**. It belongs to the **voice**, not to any one tree:
the same clip serves every scene that character appears in, and it has to fire the instant the learner
stops speaking — before any processing could return. So it is declared on the voice profile and
pregenerated:

```jsonc
// server/catalog/voices.json
"slavko": { "description": "…", "backchannels": ["Mhm."] }
```

```bash
npm run build:backchannels                 # every profile that declares them
npm run build:backchannels -- slavko       # one profile   (--regen to re-roll)
```

Same content-addressed store, key, and preflight as `build:dialogue-assets`. The key is
(provider, voiceTag, text), so a surface plays one with the ordinary
`/api/speak?text=Mhm.&voice=slavko` and gets the pregenerated bytes free.

## Runtime

- **`GET /api/config?scenarioId=`** returns `dialogues: Dialogue[]` (level-sorted; `[]` if none). The whole
  tree ships to the client — the click-through runs entirely client-side, **no server turn per choice**.
- **Client** — the rehearsal overlay in [`public/app.js`](../public/app.js): level tabs, the branching
  renderer, click-to-reveal English, and a single dialogue audio channel that supersedes the prior clip
  and plays client-then-npc in turn.
- **`GET /api/speak?text=&voice=`** resolves a **named catalog voice profile** (`voice=shop-assistant`,
  `male-speaker`, …) in addition to `voice=character`/teacher, so rehearsal speakers voice correctly. It
  keys on the text it's given (the clean `sl`) → serves the pregenerated bytes.

## The handoff — introduce, then reinforce

This is the loop [roadmap item 12](ROADMAP.md) is about: **the click-through introduces; free chat
reinforces.** A level that carries an `introduces` set shows a **"💬 Now try it for real →"** button in
the rehearsal overlay. Tapping it closes the tree and opens a **free-chat session biased toward exactly
that level's introduced learnables** — where the *existing* witness crediting earns mastery.

- **Client** (`public/app.js`): `reinforceFromDialogue()` closes the overlay and calls
  `openTutor({ focus, role, context })` — the live tutor opens biased toward this level's introduced set,
  pinned to the scenario's role and primed with the scene it came from. The focus set is carried on the
  client (like the pinned role) and POSTed back on every `/api/converse` turn as `focusLearnables`.
- **Server**: `converse({ focusLearnables })` → `selectForWitness(model, level, focusIds)` pulls the
  introduced ids to the **front of the in-play target set** and **force-includes them even if unseen** —
  so a freshly-introduced item is immediately creditable. **The credit firewall is unchanged:** only the
  target set can earn a success (`creditFromEvidence` gates on it), so biasing *what* is in play never
  widens *what counts*. Rehearsal itself still credits nothing — the [witness contract](free-conversation.md)
  holds; mastery is only ever earned on the live mic.

## The catalog link — deriving learnables from a dialogue

`introduces` references shared **catalog learnables** ([`learnables.json`](../server/catalog/learnables.json)),
the same durable units the mastery loop counts. The catalog is the spine that ties the two surfaces: the
dialogue **declares** the ids it introduces; free chat **credits** those same ids. So a new dialogue that
teaches new words must first put those words in the catalog.

The rule that keeps this DRY at hundreds of dialogues: **a word is minted in the catalog once and
referenced by id everywhere** (the "born into a scene" invariant — [free-conversation.md](free-conversation.md)).
Two dialogues that both use *kruh* reference the same `kruh` id; they do **not** each mint their own.
`npm run lint:dialogue` enforces this — it rejects two learnables that share a canonical `sl`, restates
that every `introduces` id resolves, and reports which dialogue introduces which ids.

## Audio pipeline

Pregenerate with:

```bash
npm run build:dialogue-assets -- <scenarioId> [--level <n>] [--nodes <id,id,…>] [--regen]
```

`--nodes` is an **audition**: it synthesizes only those node ids (a cheap pre-approval spot-check of a voice
or a delivery tag) and does **not** flip the level's `audio` to `"ready"`. The clips land in the shared store,
so a later full build reuses them free.

[`server/scripts/build-dialogue-assets.ts`](../server/scripts/build-dialogue-assets.ts) walks every node,
synthesizes the speaker's line in that speaker's voice profile, and **keys on the clean `sl`** while
synthesizing **`deliverySL ?? sl`**. On a level with no failures it flips that level's `audio` to
`"ready"`, which turns on the client's play buttons. Idempotent + free on re-run (disk hits); `--regen`
forces a re-roll after a delivery note changes. Same content-addressed store, keys, and dedup as the rest
of the [asset pipeline](asset-pipeline.md) — a line identical in the same voice is one clip anywhere.

Every **form** of every line is built: the line as authored, plus one per
[variant](#learner-facts--what-the-course-knows-about-the-person). Each form is different text, so each is
its own key and its own clip.

> **Keep a level at `audio: "pending"` while you are developing against it.** This is not only about
> billing. `/api/speak` live-synthesizes on a cache miss — it must, since the live tutor's text is
> unpredictable — streams the result, and **persists it under the same key the pregenerated build uses**.
> But it synthesizes the plain `sl`, with no `deliverySL` direction. The real build then finds a cache hit
> and skips the line, so the delivery tags never land and the clip that is seated there permanently is the
> undirected one. A `"pending"` level costs nothing and cannot do this: the renderer's gate is
> `if (scene.audio !== "ready") return` ([`public/app.js`](../public/app.js), `sceneSay`), so the scene
> plays silent, faster, and makes no network call at all. Flip to `"ready"` only after
> `build:dialogue-assets`.

### Staging a level

`status` says whether a level reaches the learner; `audio` says whether its clips are built. They answer
different questions, and a staged level usually wants its audio built.

| `status` | | |
|---|---|---|
| `"active"` | the default — omit it | in the app |
| `"draft"` | written, not released | invisible to the learner |
| `"retired"` | was released, kept for its material and its history | no longer taught |

Only the app-facing endpoints filter (`getPublishedDialogues` in
[`server/dialogues.ts`](../server/dialogues.ts)). The lints, `script:lesson`, `playthrough:lesson` and the
asset and alignment builders read every level whatever its status — so a draft is still gated, still
printable, and still buildable, and a retired one keeps answering for the clips it owns. A scenario whose
every level is drafted or retired drops out of the picker exactly as an unauthored one does.

The manifest keeps declaring the level either way: `surfaces.dialogue.levels[]` says the file exists,
which stays true, and `lint:tree` goes on checking the two agree.

The **intro** monologue clips are a separate build (the line builder above deliberately skips them):

```bash
npm run build:dialogue-intros -- <scenarioId> [--level <n>] [--regen]
```

[`server/scripts/build-dialogue-intros.ts`](../server/scripts/build-dialogue-intros.ts) synthesizes each
level's `intro.text` (the delivery-tagged source) in the scenario's **client** voice profile — the intro is
the learner's own first-person monologue — and writes it to `public/intros/<intro.audio>`, the filename the
dialogue declares. Preflight-gated, idempotent (skips an existing clip unless `--regen`), and sequential so a
billed run can't half-complete. Unlike the line audio it writes a plain file (intros are referenced by name,
like operator-supplied backgrounds), so the clips ship as git-tracked assets under `public/intros/`.

## Authoring

Rehearsal dialogues are authored by the **`create-dialogue`** skill — the `dialogue` surface of the shared
authoring engine (**docs/authoring-pipeline.md**). It mirrors create-scenario's shape for the branching-tree
surface: the orchestrator specs the tree (situation, per-level objectives mapped to
[CEFR/Slovenian A1](https://centerslo.si/izpiti/izpiti-iz-znanja-slovenscine/izpit-na-vstopni-ravni)
competencies — see docs/a1-taxonomy.md — sizing, register), the **`slovenian-author`** agent (dialogue mode)
writes the native Slovene per node + the catalog delta, and the **`scenario-critic`** agent (dialogue mode)
signs off on naturalness, register consistency, grammar targets, and branch coherence (its recurring catch is
a convergence node that only makes sense on one incoming path), returning **structured, addressed fixes**.
Objectives are distinct across a scenario's levels and each is demonstrated on a reachable path. The
`never freehand Slovene` rule still holds — the author writes the language, not the orchestrator.

### Deriving the catalog (the repeatable part — how `introduces` gets filled)

`introduces` is not hand-typed after the fact — that doesn't scale to hundreds of dialogues. Minting the
learnables is a **gated step of the authoring pass**, a byproduct of writing the tree:

1. **Author emits a catalog delta.** Alongside the tree, `slovenian-author` returns the learnables the
   level introduces, in **canonical citation form** (vocab = nom. sg. lemma; pattern = a frame with
   `___`; chunk = the fixed phrase) with gloss + the one predictable beginner error — lifted from the
   lines it just wrote, never freehanded. It reuses an existing catalog id wherever one already covers an
   item; it mints a new id only for genuinely new language.
2. **Critic reviews the delta too.** `scenario-critic` judges the delta on the same axes as the tree —
   canonical form correct, gloss accurate, the predictable error real and correctly described, native not
   textbook, and no **re-mint of an item already in the catalog** (same lexical item modulo inflection —
   NOT a distinct lexeme that merely shares a function; `Živjo`/`Zdravo` and `ja`/`da` both coexist).
3. **Reconcile deterministically.** `npm run reconcile:dialogue -- <reconcile-input.json>` merges the new
   entries into `learnables.json` (skip existing ids; **fail loud** on a duplicate canonical `sl`; normalize
   `kind`), assigns each level's `introduces` = the ids it is the FIRST level to have the learner produce,
   computes its difficulty band, applies the critic's exact fixes, writes
   the dialogue files + the manifest, and emits candidate A1 mappings. Then the gates must all exit 0:
   **`lint:dialogue`** (the DRY invariant + `introduces` integrity + coverage), **`lint:tree`** (tree
   structure + manifest consistency), **`lint:a1`** (a1-map ref-integrity + a difficulty/coverage readout — the
   curated core is never force-filled; a per-learnable `a1` tag is the Tagged-A1 superset), **`test:dialogue`**.

The same three-part shape as the scenario engine (author → critic → deterministic reconcile + lint), extended
to grow the catalog. Because a word is minted once and referenced by id (step 1's reuse rule + the reconcile's
dedup), the catalog stays coherent as dialogues multiply — every later dialogue that uses *kruh* credits the
same `kruh` the learner has been building all along.

> **Adopted direction (not yet implemented) — see [dialogue-difficulty-model.md](dialogue-difficulty-model.md).**
> Difficulty (`levelLabel`) is a **computed band** (basic/intermediate/advanced) derived from A1-density
> *after* authoring — the author aims, the classifier labels. `lint:a1` **classifies** difficulty, reading a
> **catalog A1 tag** (a superset over the narrow `a1-map` core). Trees may offer **more than two client
> choices**, with a context carried in the choice text or a **parenthetical**, and a scroll indicator when >1
> option. The template + sizing below describe the 2-choice implementation.

### The tree template + sizing (calibrated to bakery/restaurant)

- **Sizing:** L1 Survival ≈ **16 nodes**, L2 Basic-A1 ≈ **26**, L3 Full-A1 ≈ **52**.
- **Spine:** an `npc` node → **2 client-reply choices** → each client node's single `next` is the npc's
  response → branches **re-converge** onto shared later nodes so the tree stays finite. `root` **must be an
  `npc` node**; every path ends at `next: []`.
- **`deliverySL`:** optional, **npc lines only** — the same line with **one** eleven_v3 delivery tag matching
  the character (the restaurant waiter uses a warm `[warmly] …`; the bakery uses `[hesitant]`). **Client
  lines carry no `deliverySL`** — a client line is a line the learner will say, not a performance to
  direct. (In a **spoken** scene client lines are not synthesized at all. Nothing in this app records or
  plays back the learner's own voice; where the close screen offers to play a phrase, it is replaying the
  character's clip — see [keyphrase-span-playback.md](keyphrase-span-playback.md).)
- **Register + voices:** hold the declared register across every line (a toast among friends is naturally
  `ti` and is not a break). Match the client lines to the **learner's gender** (the restaurant client Slavko
  is male: `rad bi`, `vzel bom`, `zame`).
- **Convergence coherence** is the one thing a script can't judge: a shared `next` target must read on **every**
  incoming path. `lint:tree` LISTS every multi-parent node as a review candidate — eyeball each; the critic is
  the real check.
- **Vary across levels.** A scenario's levels each get their own opener and closer — do **not** reuse one
  greeting (`Dober dan, izvolite?`) as every level's `n1`, or one closing (`Hvala, nasvidenje.`) as every
  terminal client line. Identical openers/closers read monotonously *and* collapse to a single audio clip
  (losing per-line delivery). Give each level a distinct, natural variant; recombine existing catalog
  closing chunks rather than minting near-duplicates. The critic reviews cross-level variety.

### The minting rubric (what becomes a catalog learnable)

- **Mint a learnable iff the LEARNER is expected to PRODUCE it.** Candidates come from the **client** lines.
  NPC-only receptive lines (`Izvolite`, `Še kaj?`, `Dober tek!`) are **not** learnables — never mint them.
- **Reuse an existing id** only when it is the **same lexical item** — the same lemma/frame/phrase, just
  inflected/cased/spelled differently (`kavo`→`kava`, `Rada bi`→`rad_bi`). **Mint a new one** for genuinely
  new language, INCLUDING a distinct lexeme that merely shares a function with an existing one — those
  coexist, never collapse them (`Živjo` and `Zdravo`; `ja` and `da`; `to_bo_vse` *To bo vse.* is distinct
  from *To je vse.*). Reuse is by lexical identity, never by "same communicative job."
- Mint in **citation form** — vocabulary = nom. sg. lemma; pattern = a frame with `___`; chunk = the fixed
  phrase — with a `gloss` and the **one predictable beginner error**. Propose a snake_case id; the reconcile
  owns final id assignment.
- **A frame that inflects is cited with its alternants, never in one person's form.** `Sem / Si / Je ___.`,
  not `Sem ___.` — the same slash convention `Rad / Rada bi ___.` and `Grem v / na ___.` already use for
  gender and preposition. Every person, number, case and tense of the same verb **reuses the one entry**;
  a paradigm is never split across ids. One conjugation cited alone reads to the next author as a
  different item, and they mint a second entry for the second person. **The id carries the same weight as
  the citation form** — an id naming one use (`sem_ime`, "sem + name") tells a later author the catalog has
  nothing for the other uses, so name the frame, not the use it was first met in.
- **A phrase addressed to "you" is cited ONCE, in the form the learner will actually say it.** The other
  register is not a second learnable, for the same reason every conjugation of a verb is not: politeness is
  one system, carried by `vikanje`, and a lesson teaches it directly.
  Which form that is depends on who the phrase is said to. Things you say to friends are cited in **ti** —
  `Kje živiš?`, `Kako si?`, `Kaj delaš?`. Things you only ever say to a stranger are cited in **vi**, because
  a learner who produces the familiar form there will not be understood as intending it —
  `Ali govorite angleško?`, `Ponovite, prosim.`, `Ali imate ___?`. Pick by usage, never by a default register.
  The other register then **reuses** the entry, exactly as `kavo` reuses `kava` — same lexical item,
  inflected. A line in the register the entry is not cited in is reuse, not unminted language.
  Plural that is genuinely **plural** is untouched by this: `Ali ste odprti?` addresses a business and its
  staff, so it stays plural — the rule is about vi-as-politeness, not about the plural.
- **The slash in a citation form marks an alternation — read which one it marks.** It carries at least
  three: **gender** (`študent / študentka`, `Rad / Rada bi ___.`, `Koliko sem dolžen / dolžna?` — 12
  entries), **preposition** (`Grem v / na ___.`, `v_na_lok`, `z_s_instr`), and **number or agreement**
  (`na_sliki` *je / so*, `trije_stirje`, `stevilo_enote_desetice`). A gendered pair is deliberately **one**
  learnable: the two forms are one lexical item, and choosing between them is exactly the `predictableError`
  the entry records. Deriving "this is gendered" from the presence of a slash gets six entries wrong — read
  the gloss.

### Register a new scenario — the checklist

1. **Pick the situation + register + role + voices.** Choose or add the `npc`/`client` voice profiles (a new
   voice = one `server/catalog/voices.json` profile + one `PROFILE_ENV` row in the E3 adapter + the id in
   `.env` — see [SECRETS.md](SECRETS.md)).
2. **Run `create-dialogue`** — spec the levels (label, title, objectives, sizing), author via the agents,
   reconcile, pass the four gates, present PR-style, get approval.
3. **Confirm the A1 candidates** the reconcile emitted; fold them into `server/catalog/a1-map.json`; re-run
   `lint:a1`.
4. **Operator: generate audio** — `npm run build:dialogue-assets -- <id>` (preflight-gated; flips levels to
   `audio: "ready"`).
5. **Restart the server** — new JSON loads only at startup.

### Voices + env matrix, and the preflight

Each speaker maps to a catalog voice profile, bound to a concrete ElevenLabs voice id via an env var:

| voice profile | env var | used by |
|---|---|---|
| `female-speaker` | `ELEVENLABS_VOICE_ID` | teacher/narration; restaurant `npc`; bakery `client` |
| `male-speaker` | `ELEVENLABS_VOICE_ID_MALE` | restaurant `client` (Slavko) |
| `shop-assistant` | `ELEVENLABS_VOICE_ID_SHOP_ASSISTANT` | bakery `npc` |
| `slavko` | `ELEVENLABS_VOICE_ID_MALE` | Slavko the dragon — the companion character |

> **Slavko is deliberately bound to `male-speaker`'s env var.** He *is* the voice the restaurant client
> already speaks in, so every clip already synthesized for him stays a cache hit (the audio key carries
> the voice **id**, not the profile name) and nothing is re-keyed or re-generated. Giving him his own
> env var later is a one-line change that re-keys **all** of his audio. He is also the one profile that
> declares [backchannels](#backchannels--a-voices-listening-noises).

`build:dialogue-assets` runs a **preflight** before synthesizing: every voice profile the target references
must resolve to a configured voice id, and the API key must be set — otherwise it **fails fast**, listing
every missing binding, so a run can't half-complete (as a quota stop once did). The build is **idempotent**
and **free on re-run** (disk hits); it bills only for newly-synthesized clips, synthesizes `deliverySL ?? sl`,
keys on the clean `sl`, and flips a completed level from `audio: "pending"` to `"ready"`.

## What is deliberately not here (yet)

- **No mastery credit *from the tree*.** Clicking is exposure only; production on the live mic is where
  mastery accrues. Keeping the [witness contract](free-conversation.md) intact. The
  [handoff](#the-handoff--introduce-then-reinforce) routes the learner into free chat, where the existing
  crediting — not the tree — earns mastery.
- **No auto-selection of *which* dialogue/level comes next.** The learner (or operator) picks the level;
  the "tutor that leads" that chooses the next introduction from the learner model is
  [ROADMAP.md](ROADMAP.md) item 5, still deferred. Item 12's (a) catalog link + (b) reinforce handoff are
  built; (c) selection is not.
