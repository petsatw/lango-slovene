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
- **`introduces`** is the list of catalog **learnable** ids this level introduces — the concrete
  "what was just introduced" set. It is the seam that makes the click-through the *primary intro path*:
  the learner meets these items in the tree, then the [handoff](#the-handoff--introduce-then-reinforce)
  hands them into a free chat biased toward exactly this set. Validated at startup (every id must resolve
  in the catalog) and gated by `npm run lint:dialogue`. See [the catalog link](#the-catalog-link--deriving-learnables-from-a-dialogue).

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

> The live-synth fallback in `/api/speak` (a cache miss) uses the plain `sl`, not `deliverySL` — so
> pregenerate before shipping if the delivery direction matters.

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
  lines carry no `deliverySL`** (the learner's own voice needs no direction).
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
