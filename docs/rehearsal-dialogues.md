# Rehearsal dialogues — the click-through decision tree

A **rehearsal dialogue** is a fully pre-authored, branching **decision-tree** conversation paired with a
scenario. The learner clicks through it — pick your line, hear it, read the English — to *see the shape*
of a real exchange before producing it live. It is **rehearsal / comprehensible input, not assessment**:
no microphone, no server turn, no model in the loop, and **no mastery credit**. The live mic tutor stays
the only place mastery is earned.

This complements the two existing conversation surfaces (the scenario turn loop and free chat) with a
third, lighter one. The emerging division of labour — and the direction the [roadmap](ROADMAP.md#the-pieces)
is heading — is: **the click-through dialogue introduces new language; free chat reinforces it toward
mastery.** That integration isn't built yet; today the rehearsal dialogue is a standalone preview a
learner opens from a scenario.

## What the learner sees

- A **🎭 Rehearse** button on a scenario that has authored dialogues. It opens an overlay.
- **Competency-level tabs** (e.g. *1. Survival · 2. Basic A1 · 3. Full A1*) when a scenario has more than
  one level. Each level is a distinct tree with its own, non-overlapping objectives, ascending in length
  and difficulty.
- The **NPC line** (`baker`) as a left bubble, then **2 client-reply choices** as buttons. Picking one
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
  "audio": "pending",               // "pending" | "ready" — gates the client's play affordance
  "voices": { "baker": "shop-assistant", "client": "female-speaker" },  // per-speaker catalog voice profile
  "root": "b1",                     // must be a baker node
  "nodes": {
    "b1":  { "speaker": "baker",  "sl": "Dober dan, izvolite?", "en": "Good day, what can I get you?",
             "deliverySL": "[hesitant and a little apathetic] Dober dan, izvolite?",  // optional; see below
             "next": ["c1a", "c1b"] },
    "c1a": { "speaker": "client", "sl": "Dober dan. En kruh, prosim.", "en": "…", "next": ["b2"] },
    // … a client node's `next` is the single baker response; a baker node's `next` is its client choices;
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

## Runtime

- **`GET /api/config?scenarioId=`** returns `dialogues: Dialogue[]` (level-sorted; `[]` if none). The whole
  tree ships to the client — the click-through runs entirely client-side, **no server turn per choice**.
- **Client** — the rehearsal overlay in [`public/app.js`](../public/app.js): level tabs, the branching
  renderer, click-to-reveal English, and a single dialogue audio channel that supersedes the prior clip
  and plays customer-then-baker in turn.
- **`GET /api/speak?text=&voice=`** resolves a **named catalog voice profile** (`voice=shop-assistant`,
  `male-speaker`, …) in addition to `voice=character`/teacher, so rehearsal speakers voice correctly. It
  keys on the text it's given (the clean `sl`) → serves the pregenerated bytes.

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

## What is deliberately not here (yet)

- **No mastery credit.** Clicking is exposure only; production on the live mic is where mastery accrues.
  Keeping the [witness contract](free-conversation.md) intact.
- **Not yet the primary intro path**, and **not yet wired to free chat.** Making decision-tree dialogues
  the standard way to introduce new catalog items, and handing the learner off into free chat to
  reinforce them, is the next step — see [ROADMAP.md](ROADMAP.md).
