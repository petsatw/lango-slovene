# Restaurant scenario — authoring brief (MVP content)

The MVP ships **two** canned scenarios: **bakery** (already built) and **restaurant** (this brief). The
restaurant scenario is the first thing the team will look at, so it must be crisp and correct.

Source: the operator's "Zmaj Slavko v restavraciji" infographic (6 panels + a vocabulary key). We take
**three** panels as the three ascending levels, mirroring bakery (Survival → Basic A1 → Full A1). Author
via the **gated procedure** — orchestrator specs → `slovenian-author` writes the tree → `scenario-critic`
signs off → `lint:dialogue` reconciles the derived learnables. **Never transcribe the panel bubbles
verbatim** — several contain grammar slips; the author fixes them.

## Panel → level

| Panel | Level |
|---|---|
| 1 · Breakfast in a coffee shop | **L1 Basic** — order, folded with ↓ |
| 6 · Paying the bill | folded into **L1** (completes the visit) |
| 3 · Pizza with friends | **L2 Intermediate** |
| 4 · Romantic dinner | **L3 Advanced** (enriched, optional toast from Panel 5) |
| 5 · Birthday | optional toast graft into L3, else a future scenario |
| 2 · Business lunch | **EXCLUDED** (operator: not restaurant-core) |

## Voices & character
- **NPC** (natakar / natakarica): `female-speaker` — the default female voice (operator: **not**
  shop-assistant; restaurant drops the moody-baker persona).
- **Client** (Slavko, the learner-character): `male-speaker` — a distinct voice so the two never collide.
  **Write the client's lines masculine** (`rad bi`, `vzel bom`, `jaz bom` — matches Panel 4's "Vzel bom
  carpaccio"). This contrasts bakery, whose customer is feminine.

## Required small refactor (MVP disentangling)
The dialogue schema hard-codes the NPC speaker as `"baker"` (`DialogueSpeaker = "baker" | "client"`,
plus the root/voices checks in `server/dialogues.ts`). Generalize to **`"npc" | "client"`** so scenarios
are generic, and migrate the three bakery files (`speaker: "baker"→"npc"`, `voices.baker→voices.npc`,
and the `app.js` bubble/voice lookup + `build-dialogue-assets`). Small, mechanical, and it's the right
"scenarios aren't bakery-specific" move for the MVP.

## The three levels

Each level is a branching decision tree (NPC line → 2 client choices → re-converge), sized like bakery
(L1 ~16 nodes, L2 ~26, L3 ~52). Objectives are distinct across levels and each is demonstrated on a
reachable path. **Watch convergence-node coherence** — the recurring bakery bug (a shared `next` target
that only makes sense on one incoming path). Derive each level's `introduces` set from its own approved
lines; reuse existing catalog ids wherever they already cover an item (bakery already gave us `rad_bi`,
`placam_s_kartico`, greetings, `kava`/`caj`/`voda`/`rogljicek`).

### L1 Basic — "Naročilo in plačilo" (order & pay)
The complete minimal visit. Greet → order a drink + a simple dish with `Rad bi ___` → *Še kaj? / To bo
vse.* → ask for the bill (*Račun, prosim.*) → pay (*Lahko plačam s kartico?*) → thank & leave.
- **Objectives:** greet a waiter · order a drink + dish (accusative) · decline more / close the order ·
  ask for the bill · pay by card · thank for the service.
- **Concepts (from the key):** *Food & drinks* — kava, čaj, voda, sok, rogljiček/kruh. *Useful
  expressions* — Dober dan!, Kaj želite naročiti?, Za mene, prosim…, Še kaj?, To bo vse., Račun, prosim.,
  Lahko plačam s kartico?, Hvala! *Places/roles* — natakar/natakarica, miza, meni, račun.
- **Likely reuse:** dober_dan, rad_bi, prosim, hvala, ja, ne, kava, caj, voda, rogljicek,
  placam_s_kartico, hvala_nasvidenje.
- **Likely new (derive + critic):** `za_mene` ("Za mene ___, prosim."), `racun` ("Račun, prosim."),
  `sok`, `natakar` and/or `natakarica`, `miza`, `to_bo_vse` (if distinct from bakery's "to je vse"),
  `postrezba`-lite. Keep it lean — L1 is survival.

### L2 Intermediate — "Pica s prijatelji" (pizza with friends)
A group orders; each person states their own choice. Deliberate (*Kaj bom jaz?*) → *Jaz bom ___* with a
pizza variety → friends order different ones → react (*Super izbira! Na zdravje!*).
- **Objectives:** deliberate a choice · state a first-person choice (`Jaz bom + acc`) · name a pizza
  variety with adjective agreement · react/agree to others' choices · toast.
- **Concepts:** *Food* — pica, testenine, solata; pizza varieties (veganska, klasična/margarita,
  pikantna, štirje siri). *Expressions* — Za mene prosim…, Na zdravje!, Super izbira!
- **New grammar:** `jaz_bom` ("Jaz bom ___." — first-person intent + accusative), food adjective–noun
  agreement (veganska **pica**, pikantno **pico**), reacting/agreeing.
- **Evolve/fix:** Panel slips to correct in authoring — "pikantno pica" → "pikantno **pico**"; "štiri
  sire" → natural "**s štirimi siri**" (or "kvatro formadži"). Critic must catch these.

### L3 Advanced — "Večerja s priporočili" (dinner with recommendations)
A fuller dinner. *Dober večer* (+ optional compliment) → ask a recommendation (*Kaj priporočate za
predjed?*) → understand a compound answer (*Naša priporočila so … ali …*) → choose a course (*Vzel bom
___, prosim*) → starter then main → warm close (*Hvala za čudovit večer / Postrežba je odlična!*),
optional birthday toast (*Na tebe!*).
- **Objectives:** open in the evening register · ask for a recommendation (formal vi) · comprehend a
  two-option recommendation · choose a course with `Vzel/Vzela bom ___` · order across courses (predjed →
  glavna jed) · close warmly / compliment the service · (optional) toast.
- **Concepts:** *Food* — juha, meso, riba, sladica, carpaccio, predjed (starter), glavna jed. *Expressions*
  — Dober večer!, Kaj priporočate?, Postrežba je odlična!, Na zdravje!/Na tebe! *Places/roles* — meni,
  natakar, terasa.
- **New grammar:** `priporocate` ("Kaj priporočate ___?"), `vzel_bom` ("Vzel / Vzela bom ___." future,
  l-participle + accusative), courses vocab, formal/warm register.
- **Evolve:** expand Panel 4 into a real branching tree with re-convergence (starter → main → maybe
  dessert → thanks). Highest coherence risk — check every shared `next` against every path.

## Assets
Audio is **operator-triggered and billed** — do NOT auto-generate. After the trees pass author + critic +
`lint:dialogue`, the operator runs `npm run build:dialogue-assets -- restaurant` to flip each level's
`audio` to `ready`. Until then the level ships `audio: "pending"` (click-through + translate only, no
play buttons) — same cost gate as bakery.

## Definition of done (restaurant content)
Three `server/dialogues/restaurant-{1,2,3}.json` (speaker `npc`/`client`, voices npc=female-speaker /
client=male-speaker, `introduces` populated) + a `restaurant` scenario registered so it appears in the
Practice-scenarios list · derived learnables added to the catalog (author→critic→`lint:dialogue` green) ·
`test:dialogue` + `lint:dialogue` pass · the speaker-enum generalization applied and bakery migrated.
Audio stays `pending` until the operator builds it.
