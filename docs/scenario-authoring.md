# Scenario authoring rubric

The acceptance criteria every scenario must pass — for the scenario, its objectives, the story, the
asset bible, the atomic flashcards, and the scene. The create-scenario skill self-checks against this
before submitting; the scenario-critic judges against it. Distilled from the
[expert-panel research](research/scenario-engine-expert-panel-2026-06-20/SUMMARY.md).

## Scope — what is MVP vs. PLANNED

The current loop is right for MVP: the tutor recasts an error in character, and the learner gets **one natural chance to retry** within the session; an objective completes when the model judges it produced acceptably. **Keep this.** Do not add completion-gating in MVP.

Explicitly **deferred to PLANNED** (do not design MVP content around them):
- **Cross-session mastery** (a learnable mastered by repeated correct production across contexts and days, not a single in-scene completion). Needs cross-session integration — the persistent learner model; see [ARCHITECTURE.md › Planned](ARCHITECTURE.md). MVP stays single-attempt recast + retry.
- Cross-session mastery is now **built** as the **Learnable Subsystem** ([learnable-subsystem.md](learnable-subsystem.md) · spec [learnable-subsystem-spec.md](learnable-subsystem-spec.md)): a durable per-learnable model, count-based mastery, and objectives that **may reference learnables** (café does — see `cafe.json`). Authoring itself is unchanged — you still write single-session scenarios; the durable layer wraps around them. **Not yet enforced by the linter/rubric:** requiring every scenario to cover ≥1 core pattern / reference learnables — that's the next authoring-rubric step. **Still PLANNED:** tutor-led resurfacing/selection (ROADMAP 5), fluency/latency pressure, and pronunciation scoring.

So MVP acceptance for an objective is unchanged: produced acceptably once, with a recast-and-retry chance on error. The rubric below governs **what we author**, not how completion is scored.

---

## Design principles (MVP, from the panel)

1. **An objective is ONE self-contained utterance** the learner produces in a single turn — elicitable by the tutor without depending on the other character's answer mid-utterance. A line that needs a reply before its second half is **two** objectives. (Canonical example: "ask the price" and "thank + leave" are two objectives, not one.)
2. **`targetSL` is a whole formulaic chunk a real native says here** — not a lemma, not a textbook full sentence. Test: *would a Ljubljana resident actually say this at this counter?* ("Eno kavo, prosim" ✓; "Želim si skodelico kave" ✗ — nobody says it).
3. **`hintEN` names ONE specific, predictable English-speaker error** (the case/gender/number that bites), never generic advice. It is internal — never spoken.
4. **A scenario is one real transaction with an arc:** greeting → core exchange → closing. First objective is the lowest-stakes win; the last is a one-breath closing.
5. **Mirror the real interaction order**, and reuse shared objectives (greet, pay/leave) by the **same id** across scenarios for free audio reuse and cross-context familiarity.
6. **Register is chosen and consistent.** Café/shop = informal *tikanje* (ti) + colloquial *pogovorni* register, short and elliptical ("Kaj bo?"). Office/clinic = formal *vikanje* (vi). Use the **dual** (dvojina) where two people are naturally addressed.
7. **Flows with room to retry.** The tutor scaffolds *down* on a stumble (open question → either/or → a choice that contains the answer), never the same prompt louder. Content must leave that room (see the objective rubric).

---

## Rubric — an excellent SCENARIO (MVP)

A scenario ships only if **every** box is true:

- [ ] One real transaction an adult in Ljubljana meets often, completable in one sitting (≤ ~14 turns).
- [ ] **4–6 objectives.** Fewer than 4 feels trivial; more than 6 buries the finish line.
- [ ] Clear **greeting → core → closing** arc; objectives ordered to mirror the real interaction.
- [ ] **First objective is the easy win** (a greeting/opening); **last is a one-breath closing** ("Hvala, nasvidenje").
- [ ] At least one objective is a **real exchange** — the learner says something the character must respond to (e.g. asking the price), not pure recitation. (As its own objective; the character's reply is the *next* beat.)
- [ ] Reuses ≥1 **shared objective** (greet, pay/leave) by the same id as other scenarios.
- [ ] **Register chosen and held consistent** across the whole scenario; the dual used where natural.
- [ ] Has a **story** (below) and a **scene image** (below); each objective has a **flashcard frame** (below).
- [ ] No textbook-only phrasing anywhere; the end state is a success the learner can picture doing tomorrow.
- [ ] **Paper test:** a complete beginner could finish it by following the tutor's prompts alone.

## Rubric — an excellent OBJECTIVE (MVP)

- [ ] `targetSL` is **one chunk a native actually says** here (≈2–6 words, ≤ ~7–8 syllables, one breath).
- [ ] **Self-contained in one turn** — does not bundle a question with its own answer or with a closing.
- [ ] **Elicitable** by a natural in-character tutor line (there's an obvious prompt that makes this the answer).
- [ ] **`hintEN` names the one predictable English-speaker error** (e.g. *"beginners say 'kava'; it's 'kavo', accusative after 'eno'"*).
- [ ] **Register-appropriate** for the scenario (ti/vi; colloquial vs. standard) and tagged if non-obvious.
- [ ] **High reuse value** — recurs across situations; share the id + audio where it's genuinely the same phrase.
- [ ] Leaves a **clean retry path**: there's an easier re-prompt (either/or, or a choice containing the target) the tutor can drop to on a stumble.
- [ ] Has a **flashcard frame** that conveys its meaning with nothing extraneous (below).

---

## The STORY

The story is the **comprehensible-input preview**: the learner hears it (and sees the scene + flashcards) *before* speaking, so production is primed recall, not cold panic.

**What it is:** a genuine, tiny **short story** — the kind you'd tell a five-year-old — that narrates the real situation and **naturally contains each objective's target phrase**.

Rules:
- [ ] **≤5 sentences**, roughly **one per objective/beat**, in narrative order.
- [ ] **Five-year-old-simple Slovenian**: present tense, the highest-frequency words, short clauses, no subordinate-clause gymnastics. If a child couldn't follow the shape of it, simplify.
- [ ] **Each objective's `targetSL` appears naturally** inside the story (woven into the narration, not listed).
- [ ] Written to be **spoken aloud** (native TTS) — it's heard, not read.
- [ ] Sets the stage emotionally and contextually; it does not teach grammar or translate.

Example (café, simple SL):
> Vstopiš v kavarno. Rečeš: "Dober dan." Naročiš: "Eno kavo, prosim." Še dodaš: "Z mlekom, prosim." Plačaš, rečeš "Hvala, nasvidenje" in greš.

Each objective phrase is in there, but it reads as a little story, not a drill.

## The ASSET BIBLE & REFERENCE SHEET (consistency — author this FIRST)

This is the backbone of every image, and it is **not optional**. A flashcard's entire job is to bind one phrase to one exact picture; if the coffee on the `eno kavo` card is not the *same* coffee in the scene image, and the *same* coffee the next scenario shows, the binding breaks and the card mis-teaches. Image models drift on objects (vessel, colour, plating, light), not just faces. So **consistency is achieved by anchoring to a reference sheet, never by re-describing in prose.**

How it works (author the references; generation is downstream — see [asset-pipeline.md](asset-pipeline.md)):
- **Everything is a CATALOG node.** `Scenario.scene.assets` entries are `{ ref: "<catalogId>" }` — an object, an **actor**'s figure, or a **concept** (like a location); the speaking character is `Scenario.characterRef`. There is no scenario-local asset. An object is `{ label, descriptor }` (+ `gender`); a **character is an actor** that owns no pixels — it references objects (`type`, `visualRef`) plus a voice. The ALL-CAPS `label` is the `{{TOKEN}}` a prompt uses to reference it (internal, never shown). The full relational picture is [the asset model](ARCHITECTURE.md#the-asset-model).
- **Per-asset canonical render.** Each catalog asset is rendered ONCE on a neutral background. At gen time the engine gathers the assets a prompt names, **montages their renders into one labelled reference sheet**, and anchors the image to it — so every frame and the scene inherit the same canonical assets. (No monolithic per-scenario sheet.)
- **Concepts** = composed, reusable depictions (`concepts.json`: `{ label, prompt, composedFrom, aspectRatio?, format? }`). `composedFrom` may reference objects, actors, *or other concepts*. A recurring abstract objective like greet/leave is a concept (a frame reuses it by setting its `imagePrompt` to the concept's prompt → ONE shared image); a **location** (`cafe`/`bakery`/`mesnica`) is a `scene`-format concept — a **build-once "set"** the scene composes its cast and props onto, so many scenarios can reuse one location.

Rules:
- [ ] Everything in any frame or the scene is referenced by **catalog id** (`{ ref }` / `characterRef`). Need something new? Add it to the catalog first (lowercase id, `label = ID.toUpperCase()`), then ref it. Never inline a `{ label, descriptor }`.
- [ ] **Reuse before authoring.** The student (`customer`), money (`euro_coins`), `price_tag`, `doorway` and recurring characters are shared catalog ids — identical across café/bakery/butcher by construction. Run the reuse-or-author check (referent + A/R/S + metadata; see asset-pipeline.md) before creating anything new.
- [ ] Abstract objectives (greet, the closing) are **concepts composed contrastively from catalog assets** (greet = `{{CUSTOMER}}` entering the `{{DOORWAY}}`; leave = `{{CUSTOMER}}` stepping out), **not** a single ambiguous icon.
- [ ] Descriptors/prompts name assets as braced `{{TOKEN}}`s; descriptors are minimal but discriminating (pin the look, no scene context); declare `gender` on people.

## The FRAMES = atomic flashcards (one per objective)

A frame captures ONE **atomic concept** — the phrase's unit of meaning, including the grammatical point (the "one" in *eno kavo*, the dual in *dve žemlji*) — in the **simplest representation that is UNAMBIGUOUS**.

- [ ] **Atomic, not merely object-only:** depict exactly the concept, with no near-neighbour ambiguity. A bare waving hand (hello? goodbye?) **fails**; "waving while stepping in through a doorway" (greet) passes, "over-the-shoulder wave while leaving" (goodbye) passes.
- [ ] **Disambiguate contrastively:** include only the cues that separate this concept from its nearest *confusable* concept; strip everything else.
- [ ] **Quantity / case / number that IS the lesson must be shown unambiguously:** exactly one cup for *eno kavo*; exactly two rolls for the dual *dve žemlji*; milk visibly added for *z mlekom* (vs. plain).
- [ ] **Minimal-compose from reference-sheet assets:** the smallest set of bible assets (+ minimal disambiguating context like a doorway/direction) that makes the concept unambiguous — and nothing more. For combined meanings ("z mlekom" = `COFFEE` + `MILK`) compose exactly those.
- [ ] **Neutral background, no printed label/text** (the ALL-CAPS token is internal; English never appears on a Slovenian card), **anchored to the reference sheet** so the card's assets are pixel-consistent with the scene and every other scenario. Minimal-compose does NOT mean drift-free — anchoring is what makes it consistent, and it is mandatory.

## The SCENE image (one per scenario)

The one place we show the **whole situation**: an establishing depiction of what an adult in Ljubljana actually encounters — the café counter and barista, the bakery case, the office window. Same **flat, warm children's-book illustration** house style as every other image (`IMAGE_STYLE` in `server/adapters/image-style.ts`) — "adult" refers to the *content* (an everyday grown-up errand), not a realistic/photoreal style. It differs from the frames in **composition**, not style: a full tableau vs. an atomic card. This is the establishing image that **opens the story** (the learner clicks ▸ off it into the atomic frames).

- [ ] Everyday adult Ljubljana situation, simplified to its essentials (uncluttered, not touristy).
- [ ] **Composed from the same reference sheet** as the flashcards — the scene's coffee/beef/customer are the *same* canonical assets, so a learner recognises on the card exactly what they see in the scene.
- [ ] Contains the situation's key elements (the objects/people of the transaction) in one calm establishing tableau.
- [ ] Composition contrast on purpose: the full situation here, the single atomic concept on each frame.

---

## Worked example — café (rubric-compliant)

| # | id | targetSL | hintEN (one error) | atomic concept → minimal unambiguous flashcard |
|---|------|----------|--------------------|-----------------|
| 1 | `greet` | "Dober dan." | beginners reach for "Zdravo" (informal) to a stranger | greeting on arrival → the `greet` concept: `CUSTOMER` waving while **stepping in** through the `DOORWAY` (a bare wave is ambiguous with goodbye) |
| 2 | `order_coffee` | "Eno kavo, prosim." | "kava"→ needs accusative "kavo" after "eno" | exactly one coffee → a single `COFFEE`, clearly **one** |
| 3 | `with_milk` | "Z mlekom, prosim." | "z mleko"→ instrumental "z mlekom" | coffee **with milk** → `MILK` being poured into the `COFFEE` (vs. plain) |
| 4 | `ask_price` | "Koliko stane?" | (a real exchange — barista answers with the price) | asking the cost → a price tag showing **"?"** (vs. a for-sale tag) |
| 5 | `pay_leave` | "Hvala, nasvidenje." | said as the closing, one breath | parting on leaving → the `leave` concept: `CUSTOMER` **over-the-shoulder wave while stepping out** the `DOORWAY` |

- Arc: greet → order → modify → ask price (real exchange) → close. ✓ 5 objectives, first = easy win, last = one-breath closing.
- `ask_price` and `pay_leave` are **separate** objectives: bundling them ("Koliko stane? Hvala, nasvidenje.") would put a question needing an answer in the same breath as the closing, which the one-utterance rule forbids.
- Shared ids: `greet`, `pay_leave` reuse the bakery's audio.
- Note `greet` vs `pay_leave`: same `CUSTOMER` + `DOORWAY` (the shared `greet`/`leave` concepts), disambiguated **contrastively** by direction (entering vs. leaving) — a bare wave would fail atomicity for both.
- **Asset bible:** the `cafe` **location concept** (the build-once set) + `BARISTA` (an **actor** → its figure object), `CUSTOMER`, `DOORWAY`, `COFFEE`, `MILK`, `PRICE_TAG`, `EURO_COINS` objects, plus the shared `greet`/`leave` concepts. `CUSTOMER`, `DOORWAY`, `EURO_COINS`, `greet`, `leave` are **shared** by id — identical across café/bakery/butcher, not re-described. Each flashcard minimal-composes only its disambiguating assets; the scene composes the `cafe` set + cast + props in one tableau.
- Story (≤5 sentences, child-simple) weaves all five `targetSL` in.

---

## Authoring checklist (the quick gate)

Before adding a scenario: run both rubrics top to bottom. If any objective fails "one self-contained utterance a native actually says, with one named error and a clean retry path," split/rewrite/cut it. Then confirm: the **asset bible** lists every visible thing as a labelled `AssetDef` and reuses shared assets (CUSTOMER, money, gesture icons) by label; the story is a real ≤5-sentence child-simple tale containing every `targetSL`; each objective's flashcard is the isolated bible asset(s) anchored to the reference sheet; and the one scene image is composed from that same sheet.
