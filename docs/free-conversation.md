# Free Conversation — Philosophy & Methodology

**Status: design ethos (governing).** This is the *why* and the *how-it-holds-together* for free conversation. The concrete mechanism (data shapes, the per-turn call chain, the build steps) lives in [learnable-subsystem-spec.md](learnable-subsystem-spec.md); the decisions/stories context is in [learnable-subsystem-stories.md](learnable-subsystem-stories.md); the expert panel that pressure-tested this is preserved in [.consensus-runs/2026-06-27-free-conversation-design.md](../.consensus-runs/2026-06-27T12-36-54Z-free-conversation-design.md). Where mechanism and ethos disagree, **this doc is the intent** and the mechanism is wrong.

---

## The tension this feature exists to resolve

Free conversation must do two things that pull in opposite directions, at the same time:

1. **Stay a real conversation** — natural flow, a partner who reacts like a person, the learner doing most of the talking, no quiz, no machinery showing.
2. **Stay laser-focused on mastery** — use almost only what the learner is already familiar with, plus a *tiny* new edge — or, for a learner starting from scratch, a preset short list of essentials.

Let the first force win alone and you get a charming chatbot that teaches nothing and quietly drifts into being the greatest Slovene orator the learner can't follow. Let the second win alone and you get a flashcard deck read aloud — a quiz wearing a conversation's clothes, which the learner abandons. The whole design is the **harness that threads both forces into one rope**: focused learning, natural flow, and — downstream of both — durable mastery.

---

## The ethos (the maxims)

**Honor the topic, hold the level.** The learner (and the operator's catalog) may take the *subject* anywhere — café, paperwork, Swedish death metal, birdsong. The subject is free. The **words are governed**: the language stays inside what the learner is building (familiar + a sliver of edge), whatever the topic. You can talk about anything; you talk about it in the Slovene you actually have. When a learner pulls past their edge, the move is never "refuse the topic" and never "follow them over the cliff into fluent specialist speech" — it is *yes to the topic, at your level.*

**The app owns the pedagogy, not the model.** The conversational model is a warm partner on a short leash — handed a small index card each turn and allowed to mark the learner's report card *only* for items on that card, *only* with proof. It improvises the conversation; it does not decide what counts as learned. Teaching decisions stay in deterministic server code.

**The system is domain-blind.** It knows nothing about what the content *is* and must never assume (no "this is daily-life vocabulary"). It rests on exactly two domain-agnostic invariants (below). This is what lets the same engine run a café tutor or an all-death-metal tutor unchanged.

**The engine is invisible.** No scores, no streaks, no progress bars, no "today's words," no visible target list. The bounded focus set is an **engineering artifact, never a UX artifact** — the moment the learner perceives it, the conversation becomes a quiz and organic production dies. The felt reward is conversational momentum: *I said something real and was understood.*

**It is not a grind.** Mastery accrues through natural reuse across varied situations, not drilling. Difficulty is hidden inside the situation, not announced.

---

## The two invariants everything rests on

The catalog's *content* is whatever the operator authors — open-ended, any theme. Only two things are fixed and domain-blind, and the entire feature stands on them:

1. **The core patterns are universal glue.** The high-leverage grammatical frames and repair phrases (`Rad bi ___`, `Moram ___`, `Koliko stane?`, `Ne razumem`, numbers, greetings…) are topic-agnostic. `Rad bi to ploščo` ("I'd like this record") is the same frame as `Rad bi kavo`. The patterns carry *any* domain's vocabulary into flowing speech. This is the backbone we deliberately establish; everything topical rides on it.

2. **Every learnable is born into a situation.** A word never enters the catalog as a free-floating dictionary entry — it is created to fill an objective in some authored scene, and is stamped with that scene by birth. So items cluster by the operator's *own authored intent*, for free, regardless of theme. Two items share a conversation **if and only if** the operator authored a scene that put them together. The system never imposes its own grouping; it inherits the operator's.

Coherence, therefore = **(universal patterns) + (vocabulary clustered by the scene that authored it)**. Nothing about the design assumes what the content is.

---

## The methodology — how the harness threads the forces

### 1. Situation-first, never item-first
The cardinal rule. You do **not** assemble a conversation from a list of items the learner is "due" to review — that produces an incoherent grab-bag (the tutor lurching between unrelated words) and the lab-rat feeling that makes learners quit. Instead you pick a **coherent situation** drawn from the operator's authored universe, and let the due items **ride inside it**. The situation supplies the flow; review is opportunistic within it. Due items that don't fit the chosen situation simply **wait for a situation that fits them** — spaced repetition is forgiving; nothing is lost by deferring.

> *Conversation = what's **ripe** (spaced repetition) ∩ what **hangs together** (the situation).*
> Ripeness decides what's worth reviewing; the situation decides what can be said together; the overlap is the chat. Optimize selection for **coherence**, and let coverage be a happy byproduct — never the reverse.

### 2. The bounded short list — palette vs. report card
Each turn the server hands the model a small **focus set**: a few *due, familiar* items that fit the situation + the *1–2 edge* items. Two surfaces, deliberately different sizes:
- **Palette (large, for naturalness):** the tutor may freely reuse anything familiar that fits the scene — that's goal 2, organic reproduction, happening on its own.
- **Report card (small, governed):** only the focus-set items are *creditable*. The learner model can only be moved by items the **server** put in play this turn — never by whatever the model claims. This is the firewall against a chatty model corrupting durable progress.

### 3. "Within reach" is a dial, not a list
The model is never handed the learner's whole vocabulary (hundreds of items don't fit a prompt and can't be reliably matched against). It gets a **level ceiling** — "speak no fancier than this; everyday colloquial register" — plus the small explicit focus set. The ceiling is one scalar; it scales identically at 12 items or 12,000. *Bound the credit surface; do not starve the input* — the learner still needs a little ambient over-the-edge **hearing** even while what's **counted** stays tight.

### 4. Cold beats echo
Repeating a form the tutor just supplied is a warm-up, not proof of ownership — it counts as an *attempt*, never a *success*. Producing it **cold** — unprompted, a few turns later, because the situation called for it — is what credits mastery. The conversation is shaped so early offers become later cold demands. This keeps "mastered" honest instead of inflated by parroting.

### 5. Credit only with evidence; prefer to miss than to over-credit
A verdict must be backed by the learner's actual words; an unbackable verdict is dropped. When unsure, **abstain** — un-credited reuse gets credited on a later turn. This is deliberate **precision over recall**: a false credit prematurely "masters" an item, which stops it being surfaced, which means the system can never notice its mistake. A missed credit costs nothing but a small delay. Of the two errors, only over-crediting is unrecoverable, so the whole pipeline leans against it.

### 6. The cold start is a seed, not open chat
A learner with no history has nothing familiar to stand on, so "reuse the familiar" cannot operate. The first conversation is instead a **preset, longer, heavily-scaffolded seed** that plants the essentials — front-loading the repair phrases (`Ne razumem`, `Še enkrat, prosim`, `Kako se reče…?`) that let every later conversation rescue itself instead of collapsing into English. The seed's job is to **plant entries, not mint masteries**: a learner finishing it should have many items barely started, a couple of cold wins — not a pile of false fives.

---

## Division of labor (who does what)

- **The server (dumb on purpose):** picks the **situation** and the **focus set** (sort the learner model by ripeness + situation fit), sets the **level ceiling**, and decides **what counts** (bounded set + evidence). Its job is bookkeeping and sorting — no language understanding required, so "dumb" is the right tool. Spaced-repetition scheduling (a due-date per item) is a known, deterministic formula, not intelligence; the only missing ingredient is a *last-seen timestamp*.
- **The model (smart, leashed):** figures out **how** to weave the focus-set items into a natural, in-character conversation, recasts errors invisibly, and reports what the learner produced — within the card, with evidence.
- **The learner model (the source of truth):** an honest log of what the learner has actually done. The intelligence isn't in the picker; it's in this record. "Practice what you've started but not finished, in a situation it fits, plus a sliver of new" is already a sound tutor instinct on top of an honest log.

---

## The boundary: what this feature owns vs. what comes later

**Free conversation (the mastery loop, now) owns the *bounded mechanism*:** situation-first selection over the authored catalog, the focus-set/credit firewall, the level ceiling, cold-vs-echo, evidence-gated crediting, and the seed. With a *naive* picker (most-overdue items that fit a situation) this is already a good tutor at any catalog size.

**The "tutor that leads" (deferred) owns the *taste*:** the genuinely hard "which situation, which few of hundreds, and when" — real spaced scheduling, reading what the learner cares about, composing or generating fresh situations. This runs **off the clock** (between sessions, never in the live turn), and it plugs into the *same* selection seam the mastery loop exposes. The dumb version ships a good tutor; the smart version makes it great — but it is an optimization on top of an already-correct pick, not a prerequisite.

---

## Failure modes this design exists to prevent

- **The orator drift** — the model reaching past the learner's level into eloquent specialist speech. Stopped by the level ceiling + the small focus set.
- **The grab-bag chat** — unrelated due items stapled into one lurching conversation. Stopped by situation-first selection.
- **Phantom mastery** — counts climbing on parroting, hallucination, or items the learner never said. Stopped by cold-vs-echo, the evidence requirement, and the credit firewall (server-bounded, not model-decided).
- **The silent corruption that can't self-heal** — a falsely-mastered item stops being surfaced, so the system never catches its own error. Stopped by precision-over-recall as a standing bias.
- **The lab-rat feeling** — the learner sensing the machinery and freezing up. Stopped by keeping the focus set an invisible engineering artifact and steering only through natural questions.
- **Domain assumptions** — code that secretly assumes the content is "daily life." Stopped by resting only on the two domain-blind invariants.

---

## The creed, in one line

**Pick a real situation, stay within the learner's reach, steer invisibly, and only write down what they truly said — so the conversation flows like talk and the report card tells the truth.**

---

## Appendix A — Fast situation → ingredients retrieval (beyond the dumb server)

The dumb server sorts the learner model; that's enough for the bounded *credit* mechanism. But to make a chat *rich*, you need the other half: given a situation the learner names ("ordering at a bakery", "my weekend hike", "a death-metal gig"), pull a **dense, highly-relevant pool of learnables** for the tutor to cook with — fast. This appendix identifies methods. It is largely **tutor-leads territory (deferred)**, but the retrieval substrate can be built incrementally and several tiers are nearly free today.

**Frame it as two separable halves** (this is what makes it fast):
- **Pantry (situation → candidate pool), learner-agnostic.** "What belongs to this situation?" Depends only on the catalog, so it is **precomputable once per situation and cached/shared**, never recomputed per learner.
- **Plate (pool → focus set), learner-specific.** "What of that does *this* learner need now?" A cheap join of the pool against the learner model (familiar + edge), the level ceiling, and spaced-repetition ripeness. Milliseconds.

The expensive "understanding the situation" work lives in the pantry and is amortized offline. The demand-time path only ever does lookups + a join + a sort.

### Why pure semantic search is too weak (and what it misses)
Embedding the situation and doing vector-kNN over learnables captures **topical similarity** — it'll find *kava, čaj, espresso* for "café". But it misses three axes a real situation needs:
1. **Functional glue** — *prosim, hvala, koliko stane, ne razumem* aren't semantically near "café" the noun, but every café turn needs them.
2. **Pragmatic co-occurrence** — what actually gets said *together* in that situation, which is structure, not similarity.
3. **Register/level fit** — embeddings don't know what's within this learner's reach.

So embeddings are one signal, not the system. The fix is to fuse them with signals that *do* carry structure.

### The methods (cheapest/strongest first)

**1. Scene-graph adjacency (free, strongest cheap signal).** We already have it: every learnable was *born into a scene* (invariant #2), so there's a bipartite graph **scene ↔ learnables**. A named situation maps to one or more authored scenes; pull their learnables by lookup. This captures exactly the co-occurrence and functional glue embeddings miss — *because a human author already grouped them by communicative situation.* O(1) adjacency lookup. This is the backbone of the pantry; everything else enriches it.

**2. Precomputed facet tags (cheap, offline LLM, "understanding" baked into metadata).** Run an LLM **once per learnable** (or per scene), offline, to stamp rich facets: *situations it fits · communicative function (greet/request/repair/quantity/opinion/narration) · register · semantic domain · frequency band.* At demand you filter/sort on these by indexed lookup — the model's situational understanding is amortized into cheap columns. This is how you get something that "gets" the situation without paying any LLM latency at demand. Refresh only when the catalog grows.

**3. Embedding kNN (cheap, offline index; topical reach).** Embed each learnable (`sl` + gloss + an example usage) once; at demand embed the situation query and kNN. At our scale (thousands) even brute-force cosine in memory is sub-millisecond — no heavy vector DB needed. Use it to **reach beyond** the authored scenes (find topically-related items the author didn't co-locate), then re-anchor with the structural signals above.

**4. Behavioral co-occurrence (medium; needs usage data to accrue).** Build, offline, a learnable↔learnable matrix from real sessions: which items actually get produced together ("learners who said X also said Y" — the *frequently-bought-together* trick). Precompute a top-N neighbor list per item. At demand, expand the seed set through its neighbors. Captures emergent situational bundles authoring never anticipated; behaviorally grounded; pure list lookup at demand.

**5. Spreading activation over a learnable graph (medium; richest structure).** Unify signals 1+2+4 as edges (co-authored-in-scene · shared-facet · behavioral-co-occurrence) and, at demand, seed nodes from the situation and do **1–2-hop spreading activation with decay**. Pulls a coherent, ranked neighborhood — "gets" the situation via graph structure rather than raw similarity. Adjacency lists precomputed → demand is bounded graph walk = ms.

**6. Precomputed "situation cards" + background fill (richest; the LLM that truly gets it).** Offline, for a library of named situations (and each authored scene), have an LLM compose the *ideal* ingredient bundle once and cache it. At demand, map the user's situation to the nearest card (by facet/embedding) and serve its cached bundle instantly. A **novel** situation: serve a fast approximate bundle (signals 1+3+5) *now*, and kick off an LLM pass in the **background** that composes and caches a polished card for next time. Situations recur, so the cache hit-rate climbs; you can also pre-warm likely-next situations between sessions.

### The query side — turning a vague situation into a strong query
However the learner names the situation (picks from a list · free text · inferred from their opening lines), expand it into facets the index can hit: *"my weekend hike" → {outdoors, nature, past-tense narration, weather, walking verbs, place}.* Do this expansion **offline/cached** (LLM the first time a phrasing is seen, then reuse), so demand stays a lookup. The "intelligence" that understands a fuzzy request lives here and is cached, not paid live.

### Recommended architecture — multi-signal pantry, instant plate
**Offline / background:** maintain a per-learnable record carrying `{embedding, facets, scene-memberships, top-N co-occurrence neighbors}`, plus a `situation → cached bundle` store and a `query-phrasing → facets` cache. Rebuild incrementally as the catalog and usage grow.

**At demand (target: well under ~100ms, no live LLM call):**
1. Resolve the situation → (cache hit? serve the bundle) else fuse: scene-graph adjacency ∪ embedding-kNN ∪ co-occurrence expansion, filtered by facets, ranked by a weighted blend → the **pantry pool**.
2. **Plate it:** intersect the pool with the learner model (familiar + 1–2 edge), clamp to the level ceiling, and order by spaced-repetition ripeness → the small **focus set**.
3. Hand the tutor the focus set (governed/creditable) + the wider pool as conversational palette (reusable, not creditable). Fire the polished-card background job if it was a cache miss.

All heavy lifting is precomputed; demand is vector lookup + hash-joins + a sort.

### Build tiers (each shippable, cheapest first)
- **Tier 0 — scene-graph adjacency.** Free today; it's the authoring byproduct. A named situation → its scene's learnables. Already coherent.
- **Tier 1 — offline facet tags + embedding index.** One LLM pass per learnable + a vector build; demand becomes filter+kNN. This is where "gets the situation" arrives cheaply.
- **Tier 2 — behavioral co-occurrence.** Once real sessions accumulate; adds emergent bundles.
- **Tier 3 — situation cards + background fill + graph spreading activation.** The rich, self-improving pantry; novel situations refine themselves after first use.

### Guardrails (so the rich pool doesn't break the ethos)
- Retrieval enriches the **palette**; it does **not** widen the **credit surface**. The focus set stays small and governed (the firewall in §methodology holds regardless of how rich the pantry is).
- The level ceiling and the learner model still clamp everything — a rich pool is filtered to *within reach* before the tutor sees it.
- Background generation of *new learnables* (vs. retrieving existing ones) remains the deferred edge-finding/generation concern; this appendix is about **retrieving and ranking what already exists**, fast.

---

## Appendix B — Build roadmap (three phases of the learner's life)

Free conversation is built in the order a learner actually meets it. Each phase is a distinct design + build target; later phases assume the earlier ones exist.

### Phase 1 — The seed conversation (cold start) — **BUILT**
*Status: implemented + critic-reviewed (PASS-with-fixes applied). It reuses the free-conversation pipeline and chat surface **entirely** — same transcript bubbles, same push-to-talk — exactly as a live dialogue. The **only** new piece is a static-dialogue adapter (`server/adapters/seed-scripted.ts`, `scriptedSeedTurn`) that stands in where the model call would be and serves the predetermined lines. Data: `server/seeds.ts` + `server/seeds/getting-started.json` (the structure is reusable for future seeds). Wiring: `converse({ seedId, begin? })` swaps the model for the adapter and returns `seedDone`; `/api/config` reports `started`; the client routes a fresh learner into the seed via the existing chat path (the English gloss rides the bubble sub-line; the bubble's ▶ replay is the "hear it"). `npm run build:seed-assets` (operator-run) ships the spoken line audio in the starter pack. It plants entries only (every practiced step → an attempt) — it mints no masteries and does not judge the audio (no model in the loop).*

A learner with an empty model is routed here the moment they open free conversation. It is the one heavily-scaffolded, **bilingual, audio-supported** moment in the whole product — because the learner has never heard or read any of this. It plants the starter entries every later conversation stands on.

**What's special to the seed (and *only* the seed):**
- **English shown alongside Slovene.** Each line the learner is asked to produce is shown with its English intent in parentheses — *"Dober dan." (Good day.)* Normal free conversation never does this; the seed does, because it's first contact.
- **A play-it audio example per line.** The tutor's scripted line is spoken aloud and models the target in context; the tutor bubble's **▶ replay** (teacher voice) lets the learner hear it again — that *is* the "hear it" example, delivered through the ordinary chat bubble, not a separate control. Each line is pre-synthesized (`build:seed-assets`) and **shipped in the starter pack like the scenarios' audio** (`fetch:assets`), so playback is instant, free, offline-capable, and never billed on the learner's device.
- **It teaches the interaction operators themselves.** The seed must establish the meta-vocabulary the whole system leans on:
  - *Tutor scaffolding (comprehension-only — heard every step with a gloss, not tracked as masterable):* **"your turn"** (`Zdaj ti`), **"here is how you say…"** (`Reci…` / `Takole se reče…`).
  - *Learner-produced repair tools (tracked learnables):* **"how do you say ___?"** (`Kako se reče ___?`), **"repeat that, please"** (`Še enkrat, prosim`).
  - Plus the survival basics: greeting, *prosim*, *hvala*, *ja/ne*, the worked example *"Eno kavo, prosim."*, *"Ne razumem."*, a closing.

**How it behaves (consistent with the ethos):**
- **Plants entries only; no judging, no masteries.** There is no model in the seed loop, so the audio isn't graded — every practiced step credits its learnables as an **attempt** (unseen → tried). A learner finishing the seed has a working set of barely-started items, never a pile of false fives. Masteries are earned later, in real free conversation, where a model judges production. (Steps carry an advisory `mode` of `introduce`/`recall` for authoring intent; the current static adapter treats them the same.)
- **The credit surface is the step's authored learnables** — the bounded firewall holds for free (each turn credits only that step's 1–3 ids).
- **Delivery:** the **same** free-conversation pipeline and chat surface as a live dialogue (transcript bubbles + push-to-talk). The only swap is server-side: `converse({ seedId })` calls the static-dialogue adapter (`scriptedSeedTurn`) instead of the model. No new endpoint, no new UI.
- **Representation:** the seed is **authored content** (an ordered, scripted Slovene dialogue, `server/seeds/*.json`) that goes through an independent native-Slovene critic review, **not** freehanded. It is *not* the visual scenario engine (no scene/images/flashcards) — it's a lightweight, reusable audio-only dialogue structure.

### Phase 2 — The first conversation after the seed (design next)
Now the model holds a small familiar set (the seeded entries). This is the first *real* free conversation: an **initial list to work from** exists, so it runs the situation-first loop against a tiny pantry — reuse the handful of seeded items, nudge the weakest toward their next success, introduce the 1–2 edge items. Design focus: how to run a satisfying chat off a *small* familiar set without it feeling thin or like a re-run of the seed; when to drop the bilingual/audio scaffolding (it should fall away here — back to Slovene-immersive).

### Phase 3 — The intermediate learner (design after that)
A learner with a substantial model. Design focus: how they **master items the dumb server collects for a specified situation**, and how the tutor **dynamically works with — but is constrained by — that collected set**. This is where situation-first selection, the focus-set/credit firewall, ripeness ordering, and (eventually) the Appendix-A retrieval pantry all come together. The server collects the ingredients for the situation; the tutor cooks freely within them but cannot reach outside the governed set.
