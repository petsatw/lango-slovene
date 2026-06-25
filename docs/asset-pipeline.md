# Asset pipeline — catalog, rendering, and the decisions that matter

How images become canonical, reusable assets, and — more importantly — **when to generate vs. when to
just re-key**. Generation is billed and non-deterministic; most "changes" are bookkeeping that cost
nothing. The single rule that governs everything here:

> **A key change is bookkeeping, not a regeneration.** When the picture is unchanged, RE-KEY (copy the
> bytes to the new key). Only changed *content* costs a generation. Propagation to dependents is
> **decision-gated — never automatic.**

## The data model — everything is a catalog item

There is no "scenario-local" asset. Every visible thing is a catalog entry with a stable id; scenarios
reference it by id. Catalog lives in `server/catalog/*.json`, loaded by `server/catalog.ts`.

| Kind | File | Shape | Render |
|---|---|---|---|
| **object** | `objects.json` | `{ label, descriptor, gender? }` | one isolated canonical render. Props *and* figure-images (`coffee`, `counter`, `baker`, `customer`). |
| **character** (actor) | `characters.json` | `{ type:[ids], visualRef:id, voiceProfile, gender?, name? }` | **owns no pixels** — references its `visualRef` object's render, plus a voice |
| **concept** | `concepts.json` | `{ label, prompt, composedFrom:[ids], aspectRatio?, format? }` | a *composed* depiction built from other catalog nodes — objects, characters, **or other concepts**. `greet`/`leave` *and* the `cafe`/`bakery`/`mesnica` **locations** are concepts. |
| **voice** | `voices.json` | named provider-agnostic voice profile | — |

This is the **relational ontology** — the *edges* between nodes are the model; see
[ARCHITECTURE.md › The asset ontology](ARCHITECTURE.md#the-asset-ontology) for the full map.

- A scenario's `scene.assets` entries are always `{ ref: "<id>" }` (object, character, **or concept**);
  its character is `characterRef`. A character resolves, for composition, to its `visualRef` object.
- **Identity metadata** (`gender`) on people both fixes the depiction and drives Slovene agreement.
  Its absence is what let the customer drift male.
- A **concept** is the compositional node: its render is the content-addressed image at its `prompt`
  (at its `aspectRatio`), so **every frame whose `imagePrompt` equals the concept prompt shares that ONE
  image**. `composedFrom` may reference *other concepts*, so a **scene anchors on a location concept** —
  a build-once "set" (counter + fixtures) — plus the cast and props. `server/assets/compose.ts` resolves
  any id → its render, **recursively**. `format` picks the styling (`flashcard` = atomic card · `scene` =
  full tableau); `aspectRatio` the dimensions (4:3 frame · 16:9 location/scene).

## The key model — what change invalidates what

Two different keys, and knowing which inputs each depends on is the whole game.

- **Asset render key** = `sha256(provider | model | styleId | 1:1 | 1k | singleAssetSheetPrompt(label, descriptor))`
  → depends on **styleId**, the **style prefix** (`IMAGE_STYLE.prefix`, baked into `singleAssetSheetPrompt`),
  and the asset's **descriptor**. (`assetRenderKey` in `server/assets/images.ts`.)
- **Frame / concept image key** = `sha256(provider | model | styleId | fmt | AUTHORED prompt)`
  → depends on **styleId** and the **authored prompt only** — NOT the style prefix (that's added to the
  *effective* prompt at gen time, not the key) and NOT the constituent render keys. (`imageKey` in
  `server/assets/store.ts`; `getOrCreateImage` keys on the literal authored prompt.)

| You change… | Asset render keys | Frame/concept keys | What to do |
|---|---|---|---|
| an asset **descriptor** | that asset re-keys | unchanged (frames name the `{{TOKEN}}`, not the descriptor) | re-render that asset *if the look should change*; its dependents are a separate decision |
| the **style prefix** | **all** re-key | unchanged | re-render only the assets whose look should change; **`rekey --restyle`** the rest (free) |
| **styleId** | all re-key | all re-key | a deliberate global re-render — avoid unless you truly want everything regenerated |
| a **frame/concept authored prompt** | unchanged | that image re-keys | re-render it (or point it at an existing concept prompt to reuse that image) |
| a **constituent** of a concept | that constituent re-keys | concept key **unchanged** (prompt-based) | the concept will NOT auto-update — `render:concept --force` only if you decide it should |

The last row is the load-bearing one: **changing a source does not invalidate its dependents.** That is
intentional. You decide, per dependent, whether the change warrants a regeneration (see the audit's
`used-by` edges to find them).

## The toolkit (commands)

Free / no provider calls:
- `npm run audit:assets` → `assets/migration-audit.html` — the **asset graph**: every catalog node with
  its render (or "missing"), identity metadata, `built-from` / `used-by` edges, and per-image render
  state. Read this to decide what needs doing. Generates nothing.
- `npm run gallery` → `assets/catalog-gallery.html` — a clean visual index of every rendered object,
  actor, concept/location, and each scenario's scene + flashcard frames. Generates nothing.
- `npm run rekey:assets [-- --apply]` — re-key frames whose only change is the `{{TOKEN}}` brace
  notation (same picture → copy bytes to the new key).
- `npm run rekey:assets -- --harvest [--apply]` — seed a canonical asset render from a **sole-asset
  frame**'s bytes (an existing frame that already depicts one asset as-is IS that asset's render).
- `npm run rekey:assets -- --restyle [--apply]` — after a **style-prefix change**, copy each catalog
  asset's existing render bytes to its new key, for every asset whose picture is unchanged. Skips ones
  already at the new key (e.g. people you re-rendered first). This is **how you change style without
  regenerating** the assets the change doesn't actually affect.
- `npm run lint:scenario -- <id|--file>` · `npm run prompts -- <id|--file>` — validate / preview prompts.

Billed (generate images — only on explicit request):
- `npm run render:asset -- <catalogId> [<catalogId>…] [--force]` — render canonical asset(s) by id
  (object or character). `--force` deletes the existing render at that key first.
- `npm run render:concept -- <conceptId> [<conceptId>…] [--force]` — render composed concept(s):
  resolves `composedFrom` → their canonical renders → labelled montage → anchored generation. `--force`
  is required to refresh a concept after a constituent changed (its prompt key is otherwise a cache hit).
- `npm run build:assets -- <id> [--regen frame:<obj>|scene|audio:…]` — materialize a whole scenario
  (audio + frames + scene), or surgically re-roll one leaf.

Audio note: voice is speaker-role-based — teacher voice (`female-speaker`) for all learner-facing audio
(targets, story); the character's voice only for in-scene lines (opening, live tutor reply). Audio is
also content-addressed and re-keys/re-renders on the same principles.

## How to change the style without forcing new generations

1. Edit `IMAGE_STYLE.prefix` (do **not** bump `styleId` — that would re-key frames too).
2. Re-render *only* the assets whose look should actually change (e.g. `render:asset -- baker`).
3. `npm run rekey:assets -- --restyle --apply` — every other asset's bytes are copied to the new key
   for free. They keep their current pixels; the audit stays "whole."
4. Decide, per dependent concept/frame, whether to `render:concept --force` (e.g. the customer changed →
   you *may* want greet/leave refreshed — but that's your call, not automatic).

The style prefix is an **art-style** statement (palette, soft edges/linework, era) — it must not dictate
body shape or name a specific place; setting comes from each frame/scene prompt.

## The reuse-or-author decision (authoring time)

When a new frame needs an image, first check the audit graph: can an existing render serve it? Reuse iff
**(1) same referent at the right specificity** (a loaf serves "order bread"; not "order burek"),
**(2) no added Action / Relation / State** the render lacks ("slice the bread" adds an action → author a
new image, anchored on the loaf), and **(3) identity metadata holds** (the customer is the girl). This
is a judgment (a multimodal call), never prompt-string matching. Uncertain → author. Reusing a concept =
set the frame's `imagePrompt` to the concept's prompt so they share one image.

## Provenance

`manifest.jsonl` records, per image: `referenceKeys` (what it was composed from — the graph edges),
`provider` (`grok` generated · `harvest` from a frame · `local` jimp montage · `rekey`/`extract` copied),
`prompt`/`effectivePrompt`, and identifiers. The audit reads this to draw the graph and label provenance.
