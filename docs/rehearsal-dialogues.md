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
- **`voices`** maps each speaker to a catalog voice profile id (`server/catalog/voices.json`), so the two
  speakers get distinct voices. Adding a voice = one `voices.json` profile + one `PROFILE_ENV` row in the
  E3 adapter + the concrete voice id in `.env` (see [SECRETS.md](SECRETS.md)).
- **`introduces`** is the list of catalog **learnable** ids this level introduces — the concrete
  "what was just introduced" set. It is the seam that makes the click-through the *primary intro path*:
  the learner meets these items in the tree, then the [handoff](#the-handoff--introduce-then-reinforce)
  hands them into a free chat biased toward exactly this set. Validated at startup (every id must resolve
  in the catalog) and gated by `npm run lint:dialogue`. See [the catalog link](#the-catalog-link--deriving-learnables-from-a-dialogue).

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
npm run build:dialogue-assets -- <scenarioId> [--level <n>] [--regen]
```

[`server/scripts/build-dialogue-assets.ts`](../server/scripts/build-dialogue-assets.ts) walks every node,
synthesizes the speaker's line in that speaker's voice profile, and **keys on the clean `sl`** while
synthesizing **`deliverySL ?? sl`**. On a level with no failures it flips that level's `audio` to
`"ready"`, which turns on the client's play buttons. Idempotent + free on re-run (disk hits); `--regen`
forces a re-roll after a delivery note changes. Same content-addressed store, keys, and dedup as the rest
of the [asset pipeline](asset-pipeline.md) — a line identical in the same voice is one clip anywhere.

> The live-synth fallback in `/api/speak` (a cache miss) uses the plain `sl`, not `deliverySL` — so
> pregenerate before shipping if the delivery direction matters.

## Authoring

Rehearsal dialogues do **not** go through the full scenario engine. They use a **lightweight
author + critic pass**: the orchestrator specs the tree (situation, per-level objectives mapped to
[CEFR/Slovenian A1](https://centerslo.si/izpiti/izpiti-iz-znanja-slovenscine/izpit-na-vstopni-ravni)
competencies, sizing, register), the **`slovenian-author`** agent writes the native Slovene per node,
and the **`scenario-critic`** agent signs off on naturalness, register consistency, grammar targets, and
branch coherence (its recurring catch is a convergence node that only makes sense on one incoming path).
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
   textbook, no duplicate of an existing entry.
3. **Reconcile deterministically.** Merge the approved new entries into `learnables.json`, set the
   level's `introduces` to the union of reused + new ids, and run **`npm run lint:dialogue`** — the gate
   that enforces the DRY invariant (no two learnables share a canonical `sl`), restates referential
   integrity, and prints coverage. It must exit 0.

The same three-part shape as the scenario engine (author → critic → deterministic lint), extended to grow
the catalog. Because a word is minted once and referenced by id (step 1's reuse rule + step 3's dedup),
the catalog stays coherent as dialogues multiply — every later dialogue that uses *kruh* credits the same
`kruh` the learner has been building all along.

## What is deliberately not here (yet)

- **No mastery credit *from the tree*.** Clicking is exposure only; production on the live mic is where
  mastery accrues. Keeping the [witness contract](free-conversation.md) intact. The
  [handoff](#the-handoff--introduce-then-reinforce) routes the learner into free chat, where the existing
  crediting — not the tree — earns mastery.
- **No auto-selection of *which* dialogue/level comes next.** The learner (or operator) picks the level;
  the "tutor that leads" that chooses the next introduction from the learner model is
  [ROADMAP.md](ROADMAP.md) item 5, still deferred. Item 12's (a) catalog link + (b) reinforce handoff are
  built; (c) selection is not.
